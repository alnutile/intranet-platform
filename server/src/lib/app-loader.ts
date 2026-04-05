import fs from "fs";
import path from "path";
import { Router } from "express";
import { requireAuth, requireAppAccess } from "../middleware/auth";
import { db } from "../db";

export interface AppManifest {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface LoadedApp {
  manifest: AppManifest;
  dir: string;
}

const APPS_DIR = path.resolve(process.cwd(), "apps");

export function listApps(): LoadedApp[] {
  if (!fs.existsSync(APPS_DIR)) return [];
  return fs
    .readdirSync(APPS_DIR)
    .map((d) => {
      const manifestPath = path.join(APPS_DIR, d, "manifest.json");
      if (!fs.existsSync(manifestPath)) return null;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as AppManifest;
      return { manifest, dir: path.join(APPS_DIR, d) };
    })
    .filter((x): x is LoadedApp => x !== null);
}

/**
 * Dynamically load each sub-app's server router and mount it under
 * /api/apps/:appId with auth + per-app access control.
 */
export async function mountApps(root: Router) {
  const apps = listApps();
  for (const app of apps) {
    const serverEntry = findServerEntry(app.dir);
    if (!serverEntry) continue;
    try {
      const mod = await import(serverEntry);
      const router: Router | undefined = mod.default ?? mod.router;
      if (!router) {
        console.warn(`[apps] ${app.manifest.id} has no default export router`);
        continue;
      }
      root.use(
        `/api/apps/${app.manifest.id}`,
        requireAuth,
        requireAppAccess(app.manifest.id),
        router
      );
      console.log(`[apps] mounted ${app.manifest.id}`);
    } catch (err) {
      console.error(`[apps] failed to mount ${app.manifest.id}:`, err);
    }
  }
}

function findServerEntry(appDir: string): string | null {
  const candidates = [
    "server/index.ts",
    "server/index.js",
    "server.ts",
    "server.js",
  ];
  for (const c of candidates) {
    const p = path.join(appDir, c);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Returns the apps a given user can see. Admins see everything.
 */
export function appsForUser(userId: number, role: "admin" | "member"): AppManifest[] {
  const all = listApps().map((a) => a.manifest);
  if (role === "admin") return all;
  const rows = db
    .prepare("SELECT app_id FROM app_access WHERE user_id = ?")
    .all(userId) as { app_id: string }[];
  const allowed = new Set(rows.map((r) => r.app_id));
  return all.filter((m) => allowed.has(m.id));
}
