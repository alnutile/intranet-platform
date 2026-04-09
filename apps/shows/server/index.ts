import { Router } from "express";
import { z } from "zod";
import { db } from "../../../server/src/db";
import { getPrompt } from "../../../server/src/lib/prompts";

const router = Router();

const DEFAULT_ENRICH_PROMPT = `Given the title of a TV show or movie, provide:
1. A TLDR summary (2-3 sentences, no spoilers, make it sound appealing)
2. Where to watch it (streaming service or network — e.g. Netflix, HBO, Hulu, Apple TV+, Prime Video, Disney+, Peacock, Paramount+, theatrical, etc.). If you're not sure, say "Unknown"
3. The release year or year range (e.g. "2019" or "2019-2023")
4. 3-6 genre/mood tags (e.g. "thriller", "sci-fi", "dark comedy", "limited series", "feel-good", "documentary")

Return ONLY valid JSON:
{ "tldr": "...", "channel": "...", "year": "...", "tags": ["tag1", "tag2", ...] }

No markdown, no explanation.

Title: `;

// ─── Poster lookup via Wikipedia ────────────────────────────────────────────

async function fetchPoster(title: string): Promise<string | null> {
  try {
    // Search Wikipedia for the show/movie page
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(title + " TV series OR film")}&srlimit=1`;
    const searchResp = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
    const searchData = await searchResp.json() as any;
    const pageTitle = searchData?.query?.search?.[0]?.title;
    if (!pageTitle) return null;

    // Get the page's main image (thumbnail)
    const imageUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=400`;
    const imageResp = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
    const imageData = await imageResp.json() as any;
    const pages = imageData?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as any;
    return page?.thumbnail?.source || null;
  } catch {
    return null;
  }
}

// ─── AI enrich ──────────────────────────────────────────────────────────────

async function enrichShow(title: string): Promise<{
  tldr: string | null;
  channel: string | null;
  year: string | null;
  image_url: string | null;
  tags: string;
}> {
  // Run AI and image fetch in parallel
  const [aiResult, imageUrl] = await Promise.all([
    enrichWithAI(title),
    fetchPoster(title),
  ]);

  return { ...aiResult, image_url: imageUrl };
}

async function enrichWithAI(title: string): Promise<{
  tldr: string | null;
  channel: string | null;
  year: string | null;
  tags: string;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { tldr: null, channel: null, year: null, tags: "[]" };

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: getPrompt("shows.enrich", DEFAULT_ENRICH_PROMPT) + title,
        },
      ],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      tldr: parsed.tldr || null,
      channel: parsed.channel || null,
      year: parsed.year || null,
      tags: JSON.stringify(parsed.tags || []),
    };
  } catch (err) {
    console.error("[shows] AI enrich failed:", err);
    return { tldr: null, channel: null, year: null, tags: JSON.stringify(["untagged"]) };
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

const addSchema = z.object({
  title: z.string().min(1).max(300),
});

router.post("/", async (req, res) => {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "title is required" });

  const { title } = parsed.data;
  const enriched = await enrichShow(title);

  const info = db
    .prepare(
      `INSERT INTO app_shows_shows (user_id, title, tldr, channel, year, image_url, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user!.id, title, enriched.tldr, enriched.channel, enriched.year, enriched.image_url, enriched.tags);

  res.json({
    id: info.lastInsertRowid,
    title,
    ...enriched,
    watched: 0,
  });
});

router.get("/", (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM app_shows_shows ORDER BY watched ASC, created_at DESC")
    .all();
  res.json(rows);
});

router.patch("/:id/watched", (req, res) => {
  const { watched } = req.body;
  db.prepare("UPDATE app_shows_shows SET watched = ? WHERE id = ?").run(
    watched ? 1 : 0,
    Number(req.params.id)
  );
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM app_shows_shows WHERE id = ?").run(
    Number(req.params.id)
  );
  res.json({ ok: true });
});

// Re-enrich a show (admin can trigger after editing the prompt)
router.post("/:id/enrich", async (req, res) => {
  const row = db
    .prepare("SELECT id, title FROM app_shows_shows WHERE id = ?")
    .get(Number(req.params.id)) as any;
  if (!row) return res.status(404).json({ error: "not found" });

  const enriched = await enrichShow(row.title);
  db.prepare(
    "UPDATE app_shows_shows SET tldr = ?, channel = ?, year = ?, image_url = ?, tags = ? WHERE id = ?"
  ).run(enriched.tldr, enriched.channel, enriched.year, enriched.image_url, enriched.tags, row.id);

  res.json({ id: row.id, title: row.title, ...enriched });
});

export default router;
