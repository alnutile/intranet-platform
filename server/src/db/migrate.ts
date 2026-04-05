import fs from "fs";
import path from "path";
import { db } from "./index";

const ROOT = process.cwd();
const APPS_DIR = path.join(ROOT, "apps");
const CORE_SCHEMA = path.join(ROOT, "server/src/db/schema.sql");

function applied(id: string): boolean {
  // The migrations table may not exist yet on a totally fresh db, so we wrap.
  try {
    const row = db.prepare("SELECT id FROM migrations WHERE id = ?").get(id);
    return !!row;
  } catch {
    return false;
  }
}

function markApplied(id: string) {
  db.prepare("INSERT OR IGNORE INTO migrations(id) VALUES (?)").run(id);
}

export function runMigrations() {
  // 1. Core schema — idempotent (CREATE TABLE IF NOT EXISTS). Always run.
  const coreSql = fs.readFileSync(CORE_SCHEMA, "utf8");
  db.exec(coreSql);

  // 2. Sub-app migrations. Each file applied once, tracked by "appId/filename".
  if (!fs.existsSync(APPS_DIR)) return;
  const apps = fs.readdirSync(APPS_DIR).filter((d) => {
    return fs.existsSync(path.join(APPS_DIR, d, "manifest.json"));
  });

  for (const appId of apps) {
    const migDir = path.join(APPS_DIR, appId, "migrations");
    if (!fs.existsSync(migDir)) continue;
    const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const id = `${appId}/${file}`;
      if (applied(id)) continue;
      const sql = fs.readFileSync(path.join(migDir, file), "utf8");
      const tx = db.transaction(() => {
        db.exec(sql);
        markApplied(id);
      });
      tx();
      console.log(`[migrate] applied ${id}`);
    }
  }
}

if (require.main === module) {
  runMigrations();
  console.log("[migrate] done");
}
