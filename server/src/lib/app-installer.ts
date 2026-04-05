import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "../db";
import { runMigrations } from "../db/migrate";
import { mountApp, unmountApp, getApp, listApps } from "./app-loader";
import { buildPluginClient } from "./plugin-builder";

const execFileP = promisify(execFile);

const APPS_DIR = path.resolve(process.cwd(), "apps");
const STAGING_DIR = path.join(APPS_DIR, ".staging");

const GITHUB_URL_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/;
const APP_ID_RE = /^[a-z][a-z0-9-]{1,40}$/;

export interface InstallOptions {
  repo: string;
  ref?: string;
  force?: boolean;
}

export interface InstallResult {
  id: string;
  name: string;
  fromStaging: string;
  finalDir: string;
}

/**
 * Install a plugin from a GitHub repository. End-to-end:
 *   1. validate URL
 *   2. shallow-clone into a staging dir
 *   3. read + validate manifest.json
 *   4. atomically move to apps/<id>
 *   5. run any new migrations
 *   6. build the client bundle
 *   7. hot-mount the server router
 *   8. record in installed_apps
 */
export async function installFromGit(opts: InstallOptions): Promise<InstallResult> {
  if (!GITHUB_URL_RE.test(opts.repo)) {
    throw new Error("only https://github.com/<owner>/<repo> URLs are allowed");
  }

  fs.mkdirSync(STAGING_DIR, { recursive: true });
  const stagingName = crypto.randomBytes(8).toString("hex");
  const stagingPath = path.join(STAGING_DIR, stagingName);

  // execFile with argv array — no shell, no interpolation.
  const args = ["clone", "--depth", "1"];
  if (opts.ref) args.push("--branch", opts.ref);
  args.push(opts.repo, stagingPath);

  try {
    await execFileP("git", args, { timeout: 120_000 });
  } catch (err: any) {
    throw new Error(`git clone failed: ${err.message || err}`);
  }

  try {
    const manifestPath = path.join(stagingPath, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      throw new Error("repository has no manifest.json at its root");
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    if (typeof manifest.id !== "string" || !APP_ID_RE.test(manifest.id)) {
      throw new Error(
        "manifest.id must match /^[a-z][a-z0-9-]{1,40}$/ (lowercase letters, digits, dashes)"
      );
    }
    if (typeof manifest.name !== "string" || !manifest.name.trim()) {
      throw new Error("manifest.name is required");
    }

    const finalDir = path.join(APPS_DIR, manifest.id);
    if (fs.existsSync(finalDir)) {
      if (!opts.force) {
        throw new Error(`app "${manifest.id}" is already installed; pass force to overwrite`);
      }
      // For a forced reinstall, unmount first and replace the directory.
      unmountApp(manifest.id);
      fs.rmSync(finalDir, { recursive: true, force: true });
    }

    // Refuse to install if a plugin's client entry (pre-built or source) isn't present.
    const hasSource = findAny(stagingPath, [
      "client/src/main.tsx",
      "client/src/main.ts",
      "client/src/index.tsx",
      "client/src/index.ts",
      "client/index.tsx",
      "client/index.ts",
    ]);
    const hasPrebuilt = fs.existsSync(path.join(stagingPath, "client/dist/index.js"));
    if (!hasSource && !hasPrebuilt) {
      throw new Error(
        "plugin has no client entry (expected client/src/main.tsx or a pre-built client/dist/index.js)"
      );
    }

    fs.renameSync(stagingPath, finalDir);

    // Build client (no-op if already up to date).
    try {
      await buildPluginClient(finalDir);
    } catch (err) {
      // Roll back on build failure so we don't leave a broken plugin on disk.
      fs.rmSync(finalDir, { recursive: true, force: true });
      throw new Error(`plugin client build failed: ${(err as Error).message}`);
    }

    // Run any new migrations. runMigrations() is idempotent and tracks per-file.
    runMigrations();

    // Hot-mount.
    await mountApp(manifest.id);

    db.prepare(
      `INSERT OR REPLACE INTO installed_apps(id, source, repo, ref, installed_at)
       VALUES (?, 'git', ?, ?, strftime('%s','now'))`
    ).run(manifest.id, opts.repo, opts.ref ?? null);

    return {
      id: manifest.id,
      name: manifest.name,
      fromStaging: stagingPath,
      finalDir,
    };
  } catch (err) {
    // Always clean up staging on failure.
    if (fs.existsSync(stagingPath)) {
      fs.rmSync(stagingPath, { recursive: true, force: true });
    }
    throw err;
  }
}

export interface UninstallOptions {
  id: string;
  /** If true, also drop `app_<id>_*` tables and remove storage/uploads/<id>/. */
  purge?: boolean;
}

export async function uninstallApp(opts: UninstallOptions): Promise<void> {
  const app = getApp(opts.id);
  if (!app) throw new Error(`app "${opts.id}" is not installed`);

  unmountApp(opts.id);
  fs.rmSync(app.dir, { recursive: true, force: true });
  db.prepare("DELETE FROM installed_apps WHERE id = ?").run(opts.id);

  if (opts.purge) {
    purgeAppData(opts.id);
  }
}

function purgeAppData(appId: string) {
  // Drop every table whose name starts with app_<normalizedId>_
  const prefix = `app_${appId.replace(/-/g, "_")}_`;
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ?")
    .all(`${prefix}%`) as { name: string }[];
  const tx = db.transaction(() => {
    for (const t of tables) {
      db.exec(`DROP TABLE IF EXISTS "${t.name}"`);
    }
    // Clean up any per-user access grants for this app.
    db.prepare("DELETE FROM app_access WHERE app_id = ?").run(appId);
    // Drop any migration records so a future reinstall starts fresh.
    db.prepare("DELETE FROM migrations WHERE id LIKE ?").run(`${appId}/%`);
  });
  tx();

  // Remove uploads.
  const uploadsDir = path.resolve(process.cwd(), "storage/uploads", appId);
  if (fs.existsSync(uploadsDir)) {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  }
}

export async function reloadAllApps(): Promise<void> {
  for (const app of listApps()) {
    await mountApp(app.manifest.id);
  }
}

function findAny(root: string, relPaths: string[]): boolean {
  return relPaths.some((p) => fs.existsSync(path.join(root, p)));
}
