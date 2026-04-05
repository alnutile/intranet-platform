import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { db } from "../db";
import { requireAdmin } from "../middleware/auth";

const router = Router();

const createSchema = z.object({
  email: z.string().email().optional(),
  ttlHours: z.number().int().min(1).max(24 * 30).optional(),
});

router.post("/", requireAdmin, (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const token = crypto.randomBytes(24).toString("base64url");
  const ttl = (parsed.data.ttlHours ?? 24 * 7) * 3600;
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  db.prepare(
    "INSERT INTO invites(token, email, created_by, expires_at) VALUES (?, ?, ?, ?)"
  ).run(token, parsed.data.email ?? null, req.user!.id, expiresAt);
  res.json({ token, expiresAt, email: parsed.data.email ?? null });
});

router.get("/", requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT token, email, created_at, expires_at, used_at, used_by
       FROM invites ORDER BY created_at DESC`
    )
    .all();
  res.json(rows);
});

router.delete("/:token", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM invites WHERE token = ?").run(req.params.token);
  res.json({ ok: true });
});

export default router;
