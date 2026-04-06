#!/usr/bin/env node
/**
 * First-run bootstrap. Idempotent — safe to run on every container start.
 *
 * 1. Creates `data/` and `storage/uploads/` if missing.
 * 2. Creates a `.env` from `.env.example` on first run, generating a random
 *    SESSION_SECRET so the admin doesn't have to think about it.
 * 3. Leaves existing `.env` files alone.
 *
 * Migrations run automatically when the server boots — we don't run them
 * here because we want setup to be pure filesystem work and not pull in
 * better-sqlite3's native binding twice.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
    console.log(`[setup] created ${path.relative(root, p)}`);
  }
}

ensureDir(path.join(root, "persist", "uploads"));
// Legacy paths for local dev without Docker.
ensureDir(path.join(root, "data"));
ensureDir(path.join(root, "storage", "uploads"));

const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

if (!fs.existsSync(envPath)) {
  if (!fs.existsSync(examplePath)) {
    console.warn("[setup] no .env.example found; skipping .env generation");
  } else {
    const secret = crypto.randomBytes(48).toString("base64url");
    const tmpl = fs.readFileSync(examplePath, "utf8");
    const rendered = tmpl.replace(
      /^SESSION_SECRET=.*$/m,
      `SESSION_SECRET=${secret}`
    );
    fs.writeFileSync(envPath, rendered);
    console.log("[setup] wrote .env with a random SESSION_SECRET");
  }
} else {
  console.log("[setup] .env already exists — leaving it alone");
}

console.log("[setup] done");
