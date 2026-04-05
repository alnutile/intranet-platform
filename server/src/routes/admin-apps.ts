import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { installFromGit, uninstallApp, reloadAllApps } from "../lib/app-installer";
import { listApps, mountApp } from "../lib/app-loader";
import { db } from "../db";

const router = Router();

router.use(requireAdmin);

const installSchema = z.object({
  repo: z.string().url(),
  ref: z.string().optional(),
  force: z.boolean().optional(),
});

router.post("/install", async (req, res) => {
  const parsed = installSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  try {
    const result = await installFromGit(parsed.data);
    res.json({ ok: true, id: result.id, name: result.name });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "install failed" });
  }
});

const uninstallSchema = z.object({
  id: z.string(),
  purge: z.boolean().optional(),
});

router.post("/uninstall", async (req, res) => {
  const parsed = uninstallSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  try {
    await uninstallApp(parsed.data);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "uninstall failed" });
  }
});

const reloadSchema = z.object({ id: z.string().optional() });

router.post("/reload", async (req, res) => {
  const parsed = reloadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  try {
    if (parsed.data.id) {
      await mountApp(parsed.data.id);
    } else {
      await reloadAllApps();
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "reload failed" });
  }
});

router.get("/installed", (_req, res) => {
  const disk = listApps().map((a) => a.manifest);
  const rows = db
    .prepare("SELECT id, source, repo, ref, installed_at FROM installed_apps")
    .all() as Array<{ id: string; source: string; repo: string | null; ref: string | null; installed_at: number }>;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const merged = disk.map((m) => ({
    ...m,
    source: byId.get(m.id)?.source ?? "bundled",
    repo: byId.get(m.id)?.repo ?? null,
    ref: byId.get(m.id)?.ref ?? null,
    installed_at: byId.get(m.id)?.installed_at ?? null,
  }));
  res.json(merged);
});

export default router;
