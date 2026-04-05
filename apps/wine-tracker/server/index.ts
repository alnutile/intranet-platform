import { Router } from "express";
import { z } from "zod";
import { db } from "../../../server/src/db";
import { appUploader } from "../../../server/src/lib/uploads";

const router = Router();
const upload = appUploader("wine-tracker");

const wineSchema = z.object({
  name: z.string().min(1).max(200),
  winery: z.string().max(200).optional().nullable(),
  vintage: z.coerce.number().int().min(1800).max(2100).optional().nullable(),
  varietal: z.string().max(200).optional().nullable(),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

router.get("/wines", (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, winery, vintage, varietal, rating, notes, photo_filename, created_at
       FROM app_wine_tracker_wines
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .all(req.user!.id);
  res.json(rows);
});

router.post("/wines", upload.single("photo"), (req, res) => {
  // Multer puts form fields on req.body as strings; coerce via zod.
  const parsed = wineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const d = parsed.data;
  const file = (req as any).file as Express.Multer.File | undefined;
  const info = db
    .prepare(
      `INSERT INTO app_wine_tracker_wines
       (user_id, name, winery, vintage, varietal, rating, notes, photo_filename)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user!.id,
      d.name,
      d.winery ?? null,
      d.vintage ?? null,
      d.varietal ?? null,
      d.rating ?? null,
      d.notes ?? null,
      file ? file.filename : null
    );
  res.json({ id: info.lastInsertRowid });
});

router.delete("/wines/:id", (req, res) => {
  db.prepare("DELETE FROM app_wine_tracker_wines WHERE id = ? AND user_id = ?").run(
    Number(req.params.id),
    req.user!.id
  );
  res.json({ ok: true });
});

export default router;
