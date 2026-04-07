import { Router } from "express";
import fs from "fs";
import { z } from "zod";
import { db } from "../../../server/src/db";
import { appUploader } from "../../../server/src/lib/uploads";

const router = Router();
const upload = appUploader("recipes", { maxBytes: 15 * 1024 * 1024 });

// ─── AI: extract recipe from image ─────────────────────────────────────────

router.post("/scan", upload.single("photo"), async (req, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: "no photo provided" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const base64 = fs.readFileSync(file.path).toString("base64");
    const mediaType = file.mimetype as any;

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            {
              type: "text",
              text: `Extract the recipe from this image. Return ONLY valid JSON:
{
  "title": "Recipe name",
  "description": "Brief description",
  "prep_time": "15 min",
  "cook_time": "30 min",
  "servings": "4",
  "ingredients": ["1 cup flour", "2 eggs", ...],
  "instructions": ["Step 1...", "Step 2...", ...],
  "cuisine": "Italian",
  "tags": ["pasta", "quick"]
}
No markdown, no explanation, just JSON.`,
            },
          ],
        },
      ],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const extracted = JSON.parse(cleaned);

    res.json({ ...extracted, photo_filename: file.filename });
  } catch (err: any) {
    console.error("[recipes] scan failed:", err);
    res.status(500).json({
      error: "AI scan failed: " + (err.message || "unknown"),
      photo_filename: file.filename,
    });
  }
});

// ─── AI: parse pasted text into structured recipe ───────────────────────────

router.post("/parse", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string")
    return res.status(400).json({ error: "text is required" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Clean up and structure this recipe text into a proper recipe. Return ONLY valid JSON:
{
  "title": "Recipe name",
  "description": "Brief appetizing description",
  "prep_time": "15 min",
  "cook_time": "30 min",
  "servings": "4",
  "ingredients": ["1 cup flour", "2 eggs", ...],
  "instructions": ["Preheat oven to 350°F.", "Mix dry ingredients.", ...],
  "cuisine": "Italian",
  "tags": ["pasta", "quick"]
}
No markdown, no explanation, just JSON.

Here is the recipe text:
${text}`,
        },
      ],
    });

    const out = msg.content[0].type === "text" ? msg.content[0].text : "";
    const cleaned = out.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    res.json(JSON.parse(cleaned));
  } catch (err: any) {
    console.error("[recipes] parse failed:", err);
    res.status(500).json({ error: "AI parse failed: " + (err.message || "unknown") });
  }
});

// ─── AI: generate a cover image description (used with a placeholder) ───────
// Claude can't generate images directly, so we generate a detailed description
// and use a placeholder service. In a future version this could call DALL-E.

router.post("/generate-cover", async (req, res) => {
  const { title, description, cuisine } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Generate a short, vivid one-sentence visual description of what the finished dish "${title}" (${cuisine || "home cooking"}) would look like plated beautifully. This will be used as alt text / image description. Be specific about colors, textures, garnishes. Just the description, nothing else.`,
        },
      ],
    });

    const imageDesc = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    res.json({ image_description: imageDesc });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CRUD ───────────────────────────────────────────────────────────────────

const recipeSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(2000).optional().nullable().default(null),
  prep_time: z.string().max(50).optional().nullable().default(null),
  cook_time: z.string().max(50).optional().nullable().default(null),
  servings: z.string().max(50).optional().nullable().default(null),
  ingredients: z.string().default("[]"),
  instructions: z.string().default("[]"),
  cuisine: z.string().max(100).optional().nullable().default(null),
  tags: z.string().optional().nullable().default(null),
  source_text: z.string().max(10000).optional().nullable().default(null),
  photo_filename: z.string().optional().nullable().default(null),
  cover_filename: z.string().optional().nullable().default(null),
});

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, description, prep_time, cook_time, servings,
              cuisine, tags, photo_filename, cover_filename, created_at
       FROM app_recipes_recipes
       ORDER BY created_at DESC`
    )
    .all();
  res.json(rows);
});

router.get("/:id", (req, res) => {
  const row = db
    .prepare("SELECT * FROM app_recipes_recipes WHERE id = ?")
    .get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

router.post("/", upload.single("cover"), (req, res) => {
  const parsed = recipeSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return res.status(400).json({ error: issues.join("; ") || "invalid input" });
  }
  const d = parsed.data;
  const file = (req as any).file as Express.Multer.File | undefined;
  const coverFilename = d.cover_filename || (file ? file.filename : null);

  const info = db
    .prepare(
      `INSERT INTO app_recipes_recipes
       (user_id, title, description, prep_time, cook_time, servings,
        ingredients, instructions, cuisine, tags, source_text,
        photo_filename, cover_filename)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user!.id,
      d.title,
      d.description ?? null,
      d.prep_time ?? null,
      d.cook_time ?? null,
      d.servings ?? null,
      d.ingredients,
      d.instructions,
      d.cuisine ?? null,
      d.tags ?? null,
      d.source_text ?? null,
      d.photo_filename ?? null,
      coverFilename
    );
  res.json({ id: info.lastInsertRowid });
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare("SELECT id FROM app_recipes_recipes WHERE id = ?")
    .get(id);
  if (!existing) return res.status(404).json({ error: "not found" });

  const fields: string[] = [];
  const values: any[] = [];
  for (const [k, v] of Object.entries(req.body)) {
    if (v !== undefined && k !== "id" && k !== "user_id" && k !== "created_at") {
      fields.push(`${k} = ?`);
      values.push(v ?? null);
    }
  }
  if (fields.length === 0) return res.status(400).json({ error: "nothing to update" });
  fields.push("updated_at = strftime('%s','now')");
  values.push(id);
  db.prepare(
    `UPDATE app_recipes_recipes SET ${fields.join(", ")} WHERE id = ?`
  ).run(...values);
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM app_recipes_recipes WHERE id = ?").run(
    Number(req.params.id)
  );
  res.json({ ok: true });
});

export default router;
