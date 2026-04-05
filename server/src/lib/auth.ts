import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "../db";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface User {
  id: number;
  email: string;
  name: string;
  role: "admin" | "member";
  created_at: number;
}

export function hashPassword(pw: string): string {
  return bcrypt.hashSync(pw, 10);
}

export function verifyPassword(pw: string, hash: string): boolean {
  return bcrypt.compareSync(pw, hash);
}

export function createSession(userId: number): { id: string; expiresAt: number } {
  const id = crypto.randomBytes(32).toString("hex");
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  db.prepare("INSERT INTO sessions(id, user_id, expires_at) VALUES (?, ?, ?)").run(
    id,
    userId,
    expiresAt
  );
  return { id, expiresAt };
}

export function getUserBySession(sessionId: string | undefined): User | null {
  if (!sessionId) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > strftime('%s','now')`
    )
    .get(sessionId) as User | undefined;
  return row ?? null;
}

export function destroySession(sessionId: string) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db.prepare(
    "INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

export function isRegistrationLocked(): boolean {
  return getSetting("lock_registration") === "1";
}

export function userCount(): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  return row.c;
}
