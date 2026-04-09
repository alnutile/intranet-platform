import { db } from "../db";

/**
 * Get a prompt by key. Returns the DB-stored version if it exists,
 * otherwise the hardcoded fallback.
 *
 * Key convention: "plugin_id.action"
 *   e.g. "wine_tracker.scan", "recipes.parse_text", "shopping_list.parse"
 */
export function getPrompt(key: string, fallback: string): string {
  const row = db
    .prepare("SELECT prompt_text FROM prompts WHERE key = ?")
    .get(key) as { prompt_text: string } | undefined;
  return row?.prompt_text ?? fallback;
}

/**
 * Save or update a prompt in the database.
 */
export function setPrompt(key: string, text: string, userId: number): void {
  db.prepare(
    `INSERT INTO prompts (key, prompt_text, updated_at, updated_by)
     VALUES (?, ?, strftime('%s','now'), ?)
     ON CONFLICT(key) DO UPDATE SET
       prompt_text = excluded.prompt_text,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`
  ).run(key, text, userId);
}

/**
 * List all prompts for a given plugin (by prefix).
 */
export function listPrompts(pluginId?: string): Array<{
  key: string;
  prompt_text: string;
  updated_at: number;
  updated_by: number | null;
}> {
  if (pluginId) {
    const prefix = pluginId.replace(/-/g, "_");
    return db
      .prepare("SELECT * FROM prompts WHERE key LIKE ? ORDER BY key")
      .all(`${prefix}.%`) as any[];
  }
  return db.prepare("SELECT * FROM prompts ORDER BY key").all() as any[];
}

/**
 * Delete a prompt (revert to hardcoded fallback).
 */
export function deletePrompt(key: string): void {
  db.prepare("DELETE FROM prompts WHERE key = ?").run(key);
}
