import { Router } from "express";
import { z } from "zod";
import { db } from "../../../server/src/db";
import { getPrompt } from "../../../server/src/lib/prompts";

const router = Router();

const DEFAULT_PARSE_PROMPT = `Parse this into a shopping list. Return ONLY valid JSON — an array of items:
[
  { "name": "Milk", "quantity": "1 gallon", "category": "Dairy" },
  { "name": "Bananas", "quantity": "1 bunch", "category": "Produce" }
]

Categories should be standard grocery sections: Produce, Dairy, Meat, Bakery, Frozen, Pantry, Beverages, Snacks, Household, Personal Care, Other.
If quantity isn't mentioned, leave it null.
No markdown, no explanation, just the JSON array.

Here is the input:
`;

// ─── Stores ─────────────────────────────────────────────────────────────────

router.get("/stores", (_req, res) => {
  const stores = db
    .prepare(
      `SELECT s.*,
              (SELECT COUNT(*) FROM app_shopping_list_items WHERE store_id = s.id AND bought = 0) as pending_count,
              (SELECT COUNT(*) FROM app_shopping_list_items WHERE store_id = s.id) as total_count
       FROM app_shopping_list_stores s
       ORDER BY s.sort_order, s.name`
    )
    .all();
  res.json(stores);
});

const storeSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
});

router.post("/stores", (req, res) => {
  const parsed = storeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const d = parsed.data;
  const maxOrder = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) as m FROM app_shopping_list_stores")
    .get() as { m: number };
  const info = db
    .prepare("INSERT INTO app_shopping_list_stores(name, icon, color, sort_order) VALUES (?, ?, ?, ?)")
    .run(d.name, d.icon ?? "Store", d.color ?? "#2563EB", maxOrder.m + 1);
  res.json({ id: info.lastInsertRowid });
});

router.put("/stores/:id", (req, res) => {
  const parsed = storeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const fields: string[] = [];
  const values: any[] = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); }
  }
  if (fields.length === 0) return res.status(400).json({ error: "nothing to update" });
  values.push(Number(req.params.id));
  db.prepare(`UPDATE app_shopping_list_stores SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

router.delete("/stores/:id", (req, res) => {
  db.prepare("DELETE FROM app_shopping_list_stores WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

// ─── Items ──────────────────────────────────────────────────────────────────

router.get("/stores/:storeId/items", (req, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM app_shopping_list_items
       WHERE store_id = ?
       ORDER BY bought ASC, sort_order ASC, created_at DESC`
    )
    .all(Number(req.params.storeId));
  res.json(rows);
});

const itemSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.string().max(50).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
});

router.post("/stores/:storeId/items", (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const d = parsed.data;
  const info = db
    .prepare(
      "INSERT INTO app_shopping_list_items(store_id, name, quantity, category) VALUES (?, ?, ?, ?)"
    )
    .run(Number(req.params.storeId), d.name, d.quantity ?? null, d.category ?? null);
  res.json({ id: info.lastInsertRowid });
});

// Batch add (from AI parse)
router.post("/stores/:storeId/items/batch", (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: "items must be an array" });
  const storeId = Number(req.params.storeId);
  const ins = db.prepare(
    "INSERT INTO app_shopping_list_items(store_id, name, quantity, category) VALUES (?, ?, ?, ?)"
  );
  const tx = db.transaction((list: any[]) => {
    const ids: number[] = [];
    for (const item of list) {
      const info = ins.run(storeId, item.name, item.quantity ?? null, item.category ?? null);
      ids.push(Number(info.lastInsertRowid));
    }
    return ids;
  });
  const ids = tx(items);
  res.json({ ids });
});

// Toggle bought
router.put("/items/:id/toggle", (req, res) => {
  const item = db
    .prepare("SELECT id, bought FROM app_shopping_list_items WHERE id = ?")
    .get(Number(req.params.id)) as any;
  if (!item) return res.status(404).json({ error: "not found" });
  const newBought = item.bought ? 0 : 1;
  db.prepare(
    "UPDATE app_shopping_list_items SET bought = ?, bought_at = CASE WHEN ? = 1 THEN strftime('%s','now') ELSE NULL END WHERE id = ?"
  ).run(newBought, newBought, item.id);
  res.json({ bought: newBought });
});

// Toggle favorite
router.put("/items/:id/favorite", (req, res) => {
  const item = db
    .prepare("SELECT id, is_favorite FROM app_shopping_list_items WHERE id = ?")
    .get(Number(req.params.id)) as any;
  if (!item) return res.status(404).json({ error: "not found" });
  const newFav = item.is_favorite ? 0 : 1;
  db.prepare("UPDATE app_shopping_list_items SET is_favorite = ? WHERE id = ?").run(newFav, item.id);
  res.json({ is_favorite: newFav });
});

// Re-add a bought item (buy again)
router.post("/items/:id/rebuy", (req, res) => {
  const item = db
    .prepare("SELECT * FROM app_shopping_list_items WHERE id = ?")
    .get(Number(req.params.id)) as any;
  if (!item) return res.status(404).json({ error: "not found" });
  const info = db
    .prepare(
      "INSERT INTO app_shopping_list_items(store_id, name, quantity, category, is_favorite) VALUES (?, ?, ?, ?, ?)"
    )
    .run(item.store_id, item.name, item.quantity, item.category, item.is_favorite);
  res.json({ id: info.lastInsertRowid });
});

// Clear all bought items from a store
router.post("/stores/:storeId/clear-bought", (req, res) => {
  db.prepare(
    "DELETE FROM app_shopping_list_items WHERE store_id = ? AND bought = 1"
  ).run(Number(req.params.storeId));
  res.json({ ok: true });
});

router.delete("/items/:id", (req, res) => {
  db.prepare("DELETE FROM app_shopping_list_items WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

// ─── AI parse ───────────────────────────────────────────────────────────────

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
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: getPrompt("shopping_list.parse", DEFAULT_PARSE_PROMPT) + text,
        },
      ],
    });

    const out = msg.content[0].type === "text" ? msg.content[0].text : "";
    const cleaned = out.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    res.json({ items: JSON.parse(cleaned) });
  } catch (err: any) {
    console.error("[shopping-list] parse failed:", err);
    res.status(500).json({ error: "AI parse failed: " + (err.message || "unknown") });
  }
});

// Favorites for a store (for buy-again suggestions)
router.get("/stores/:storeId/favorites", (req, res) => {
  const rows = db
    .prepare(
      `SELECT DISTINCT name, quantity, category
       FROM app_shopping_list_items
       WHERE store_id = ? AND is_favorite = 1
       ORDER BY name`
    )
    .all(Number(req.params.storeId));
  res.json(rows);
});

export default router;
