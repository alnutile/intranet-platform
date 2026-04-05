import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, requireAppAccess } from "../middleware/auth";
import { clearRequireCacheUnder } from "./module-cache";
import { db } from "../db";

/**
 * Plugin loader with true runtime mount / unmount / reload.
 *
 * ─── How hot-mount works ──────────────────────────────────────────────────
 * At boot we install a **stable outer router** for every known plugin at
 * `/api/apps/<id>`. The outer router is never removed from the Express
 * stack. Internally it forwards to a **swappable inner router** held in
 * `mountedRouters[id]`. Installing or reloading a plugin just replaces that
 * reference — all existing Express wiring stays put.
 *
 *   /api/apps/:id ─► outerRouter (stable)
 *                       │
 *                       └─► innerRouter (swappable at runtime)
 *
 * A plugin without a server router (client-only, BYO-backend) gets an
 * innerRouter that 404s. That's fine — clients talk to Supabase / a public
 * API / etc. directly.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface AppManifest {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  /** Path to the pre-built client bundle, relative to the plugin dir. */
  entry?: string;
}

export interface LoadedApp {
  manifest: AppManifest;
  dir: string;
}

const APPS_DIR = path.resolve(process.cwd(), "apps");

/** Inner routers, keyed by appId. Mutated at runtime by install/uninstall. */
const mountedRouters: Record<string, Router> = {};

/** Has the stable outer router for this app already been wired into Express? */
const outerWired = new Set<string>();

/** The root Express app — captured by `mountAllApps` for later mount calls. */
let rootApp: any = null;

// ─── Discovery ─────────────────────────────────────────────────────────────

export function listApps(): LoadedApp[] {
  if (!fs.existsSync(APPS_DIR)) return [];
  return fs
    .readdirSync(APPS_DIR)
    .filter((d) => !d.startsWith(".") && !d.startsWith("_"))
    .map((d) => {
      const manifestPath = path.join(APPS_DIR, d, "manifest.json");
      if (!fs.existsSync(manifestPath)) return null;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as AppManifest;
        return { manifest, dir: path.join(APPS_DIR, d) };
      } catch {
        return null;
      }
    })
    .filter((x): x is LoadedApp => x !== null);
}

export function getApp(appId: string): LoadedApp | null {
  return listApps().find((a) => a.manifest.id === appId) ?? null;
}

/** Apps this user can see. Admins see everything. */
export function appsForUser(
  userId: number,
  role: "admin" | "member"
): AppManifest[] {
  const all = listApps().map((a) => a.manifest);
  if (role === "admin") return all;
  const rows = db
    .prepare("SELECT app_id FROM app_access WHERE user_id = ?")
    .all(userId) as { app_id: string }[];
  const allowed = new Set(rows.map((r) => r.app_id));
  return all.filter((m) => allowed.has(m.id));
}

// ─── Mount / unmount primitives ────────────────────────────────────────────

function findServerEntry(appDir: string): string | null {
  const candidates = ["server/index.ts", "server/index.js", "server.ts", "server.js"];
  for (const c of candidates) {
    const p = path.join(appDir, c);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Load (or reload) a plugin's inner router from disk and swap it into the
 * mountedRouters map. If the plugin has no server code, install a 404 stub.
 */
export async function mountApp(appId: string): Promise<void> {
  const app = getApp(appId);
  if (!app) throw new Error(`unknown app: ${appId}`);
  ensureOuterRouter(appId);

  const serverEntry = findServerEntry(app.dir);
  if (!serverEntry) {
    mountedRouters[appId] = emptyRouter();
    console.log(`[apps] mounted ${appId} (client-only)`);
    return;
  }

  // Bust require cache for anything under this plugin's directory (for the
  // CJS case). DO NOT clear cache for shared platform modules — singletons
  // like the SQLite connection live there.
  clearRequireCacheUnder(app.dir);

  // ESM-side: Node caches modules by URL. Appending a cache-busting query
  // string forces a fresh load on every mount call, which is what we need
  // for true runtime reload under tsx / Node ESM.
  const importUrl = pathToFileURL(serverEntry).href + `?v=${Date.now()}`;

  try {
    const mod = await import(importUrl);
    const router: Router | undefined = mod.default ?? mod.router;
    if (!router) {
      console.warn(`[apps] ${appId} has no default export router`);
      mountedRouters[appId] = emptyRouter();
      return;
    }
    mountedRouters[appId] = router;
    console.log(`[apps] mounted ${appId}`);
  } catch (err) {
    console.error(`[apps] failed to mount ${appId}:`, err);
    mountedRouters[appId] = errorRouter(err);
  }
}

/** Replace an app's inner router with a 410 Gone stub. */
export function unmountApp(appId: string): void {
  mountedRouters[appId] = goneRouter();
  // Drop its require-cache entries so a future reinstall re-reads from disk.
  const app = getApp(appId);
  if (app) clearRequireCacheUnder(app.dir);
  console.log(`[apps] unmounted ${appId}`);
}

export async function reloadApp(appId: string): Promise<void> {
  await mountApp(appId);
}

/**
 * Boot-time mount for every plugin currently on disk. Called once from
 * server/src/index.ts. Also records bundled apps in `installed_apps` so the
 * admin UI can distinguish "shipped with the platform" from "installed later".
 */
export async function mountAllApps(root: any): Promise<void> {
  rootApp = root;
  const apps = listApps();
  for (const app of apps) {
    // Seed bundled apps on first boot.
    db.prepare(
      "INSERT OR IGNORE INTO installed_apps(id, source) VALUES (?, 'bundled')"
    ).run(app.manifest.id);
    await mountApp(app.manifest.id);
  }
}

// ─── Outer-router shim ────────────────────────────────────────────────────

function ensureOuterRouter(appId: string) {
  if (outerWired.has(appId)) return;
  if (!rootApp) {
    throw new Error("mountAllApps must be called before mountApp");
  }

  // The outer router is stable for the lifetime of the process. All it does
  // is delegate to whichever inner router is currently in mountedRouters.
  const outer = Router();
  outer.use(
    requireAuth,
    requireAppAccess(appId),
    (req: Request, res: Response, next: NextFunction) => {
      const inner = mountedRouters[appId];
      if (!inner) return res.status(404).json({ error: "app not mounted" });
      return inner(req, res, next);
    }
  );
  rootApp.use(`/api/apps/${appId}`, outer);
  outerWired.add(appId);
}

function emptyRouter(): Router {
  const r = Router();
  r.use((_req, res) => res.status(404).json({ error: "this plugin has no server routes" }));
  return r;
}

function goneRouter(): Router {
  const r = Router();
  r.use((_req, res) => res.status(410).json({ error: "plugin uninstalled" }));
  return r;
}

function errorRouter(err: unknown): Router {
  const r = Router();
  const msg = err instanceof Error ? err.message : String(err);
  r.use((_req, res) => res.status(500).json({ error: `plugin failed to load: ${msg}` }));
  return r;
}
