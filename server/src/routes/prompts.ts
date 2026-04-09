import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { getPrompt, setPrompt, deletePrompt, listPrompts } from "../lib/prompts";

const router = Router();

// All prompt routes require auth; writes require admin.
router.use(requireAuth);

// List all prompts, or filter by plugin: GET /api/prompts?plugin=wine-tracker
router.get("/", (req, res) => {
  const plugin = typeof req.query.plugin === "string" ? req.query.plugin : undefined;
  res.json(listPrompts(plugin));
});

// Get a single prompt by key. Returns { key, prompt_text } or 404.
router.get("/:key", (req, res) => {
  const text = getPrompt(req.params.key, "");
  if (!text) return res.status(404).json({ error: "no custom prompt set" });
  res.json({ key: req.params.key, prompt_text: text });
});

// Create or update a prompt. Admin only.
router.put("/:key", requireAdmin, (req, res) => {
  const schema = z.object({ prompt_text: z.string().min(1).max(50000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  setPrompt(req.params.key, parsed.data.prompt_text, req.user!.id);
  res.json({ ok: true, key: req.params.key });
});

// Delete a prompt (revert to plugin default). Admin only.
router.delete("/:key", requireAdmin, (req, res) => {
  deletePrompt(req.params.key);
  res.json({ ok: true });
});

export default router;
