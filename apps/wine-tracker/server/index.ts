import { Router } from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { db } from "../../../server/src/db";
import { appUploader } from "../../../server/src/lib/uploads";

const router = Router();
const upload = appUploader("wine-tracker");

// ─── AI scan ────────────────────────────────────────────────────────────────

router.post("/scan", upload.single("photo"), async (req, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: "no photo provided" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY not set — add it to your environment variables",
    });
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const imageBuffer = fs.readFileSync(file.path);
    const base64 = imageBuffer.toString("base64");
    const mediaType = file.mimetype as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `You are looking at a wine bottle label or wine-related image.
Extract as much information as you can and return ONLY a JSON object with these fields (use null for anything you can't determine):

{
  "name": "the wine name",
  "winery": "producer / winery name",
  "vintage": 2020,
  "varietal": "grape variety, e.g. Cabernet Sauvignon",
  "grape": "same as varietal, or a blend description",
  "region": "wine region, e.g. Napa Valley, Barossa Valley",
  "country": "country of origin",
  "color": "red" | "white" | "rosé" | "sparkling" | "dessert" | "orange",
  "notes": "any other interesting details you can read from the label"
}

Return ONLY valid JSON, no markdown, no explanation.`,
            },
          ],
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    // Parse the JSON — Claude sometimes wraps in ```json, strip that.
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const extracted = JSON.parse(cleaned);

    res.json({
      ...extracted,
      photo_filename: file.filename,
    });
  } catch (err: any) {
    console.error("[wine-tracker] scan failed:", err);
    res.status(500).json({
      error: "AI scan failed: " + (err.message || "unknown error"),
      // Still return the filename so the user can fill the form manually.
      photo_filename: file.filename,
    });
  }
});

// ─── CRUD ───────────────────────────────────────────────────────────────────

const wineSchema = z.object({
  name: z.string().min(1).max(200),
  winery: z.string().max(200).optional().nullable(),
  vintage: z.coerce.number().int().min(1800).max(2100).optional().nullable(),
  varietal: z.string().max(200).optional().nullable(),
  grape: z.string().max(200).optional().nullable(),
  region: z.string().max(200).optional().nullable(),
  country: z.string().max(200).optional().nullable(),
  color: z
    .enum(["red", "white", "rosé", "sparkling", "dessert", "orange"])
    .optional()
    .nullable(),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  price: z.coerce.number().min(0).optional().nullable(),
  purchase_date: z.string().max(20).optional().nullable(),
  photo_filename: z.string().optional().nullable(),
});

router.get("/wines", (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, winery, vintage, varietal, grape, region, country,
              color, rating, notes, price, purchase_date, photo_filename, created_at
       FROM app_wine_tracker_wines
       ORDER BY created_at DESC`
    )
    .all();
  res.json(rows);
});

router.get("/wines/:id", (req, res) => {
  const row = db
    .prepare(
      `SELECT id, name, winery, vintage, varietal, grape, region, country,
              color, rating, notes, price, purchase_date, photo_filename, created_at
       FROM app_wine_tracker_wines
       WHERE id = ?`
    )
    .get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

router.post("/wines", upload.single("photo"), (req, res) => {
  const parsed = wineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const d = parsed.data;
  const file = (req as any).file as Express.Multer.File | undefined;
  const photoFilename = d.photo_filename || (file ? file.filename : null);

  const info = db
    .prepare(
      `INSERT INTO app_wine_tracker_wines
       (user_id, name, winery, vintage, varietal, grape, region, country,
        color, rating, notes, price, purchase_date, photo_filename)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user!.id,
      d.name,
      d.winery ?? null,
      d.vintage ?? null,
      d.varietal ?? null,
      d.grape ?? null,
      d.region ?? null,
      d.country ?? null,
      d.color ?? null,
      d.rating ?? null,
      d.notes ?? null,
      d.price ?? null,
      d.purchase_date ?? null,
      photoFilename
    );
  res.json({ id: info.lastInsertRowid });
});

router.put("/wines/:id", (req, res) => {
  const parsed = wineSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const d = parsed.data;

  // Build SET clause dynamically from provided fields.
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Object.entries(d)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`);
      values.push(val ?? null);
    }
  }
  if (fields.length === 0) return res.status(400).json({ error: "nothing to update" });

  values.push(Number(req.params.id));
  db.prepare(
    `UPDATE app_wine_tracker_wines SET ${fields.join(", ")}
     WHERE id = ?`
  ).run(...values);
  res.json({ ok: true });
});

router.delete("/wines/:id", (req, res) => {
  db.prepare("DELETE FROM app_wine_tracker_wines WHERE id = ?").run(
    Number(req.params.id)
  );
  res.json({ ok: true });
});

export default router;
