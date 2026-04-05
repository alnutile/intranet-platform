import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/", requireAdmin, (_req, res) => {
  const users = db
    .prepare("SELECT id, email, name, role, created_at FROM users ORDER BY created_at ASC")
    .all();
  res.json(users);
});

const accessSchema = z.object({
  appIds: z.array(z.string()),
});

// Replace the full set of app grants for a user.
router.put("/:id/access", requireAdmin, (req, res) => {
  const parsed = accessSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const userId = Number(req.params.id);
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "user not found" });
  const tx = db.transaction((ids: string[]) => {
    db.prepare("DELETE FROM app_access WHERE user_id = ?").run(userId);
    const ins = db.prepare("INSERT INTO app_access(user_id, app_id) VALUES (?, ?)");
    for (const id of ids) ins.run(userId, id);
  });
  tx(parsed.data.appIds);
  res.json({ ok: true });
});

router.get("/:id/access", requireAdmin, (req, res) => {
  const rows = db
    .prepare("SELECT app_id FROM app_access WHERE user_id = ?")
    .all(Number(req.params.id)) as { app_id: string }[];
  res.json(rows.map((r) => r.app_id));
});

router.delete("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id)
    return res.status(400).json({ error: "cannot delete yourself" });
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.json({ ok: true });
});

export default router;
