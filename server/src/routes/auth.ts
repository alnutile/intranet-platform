import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  isRegistrationLocked,
  setSetting,
  userCount,
} from "../lib/auth";
import { requireAuth } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(200),
  inviteToken: z.string().optional(),
});

function setSessionCookie(res: any, sessionId: string, expiresAt: number) {
  res.cookie("sid", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt * 1000),
    path: "/",
  });
}

// GET /api/auth/status — tells the client whether registration is open
// (i.e. zero users yet) or locked.
router.get("/status", (_req, res) => {
  res.json({
    bootstrapped: userCount() > 0,
    registrationLocked: isRegistrationLocked(),
  });
});

router.post("/register", (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const { email, name, password, inviteToken } = parsed.data;

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "email already registered" });

  const isFirstUser = userCount() === 0;
  let role: "admin" | "member" = "member";
  let invite: any = null;

  if (isFirstUser) {
    role = "admin";
  } else {
    if (!inviteToken)
      return res.status(403).json({ error: "registration is invite-only" });
    invite = db
      .prepare(
        `SELECT token, email, expires_at, used_at
         FROM invites WHERE token = ?`
      )
      .get(inviteToken);
    if (!invite) return res.status(400).json({ error: "invalid invite" });
    if (invite.used_at) return res.status(400).json({ error: "invite already used" });
    if (invite.expires_at < Math.floor(Date.now() / 1000))
      return res.status(400).json({ error: "invite expired" });
    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase())
      return res.status(400).json({ error: "invite is bound to a different email" });
  }

  const info = db
    .prepare(
      "INSERT INTO users(email, name, password_hash, role) VALUES (?, ?, ?, ?)"
    )
    .run(email, name, hashPassword(password), role);
  const userId = Number(info.lastInsertRowid);

  if (isFirstUser) {
    // Lock public registration the moment we have an admin.
    setSetting("lock_registration", "1");
  }
  if (invite) {
    db.prepare(
      "UPDATE invites SET used_at = strftime('%s','now'), used_by = ? WHERE token = ?"
    ).run(userId, invite.token);
  }

  const session = createSession(userId);
  setSessionCookie(res, session.id, session.expiresAt);
  res.json({ id: userId, email, name, role });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const row = db
    .prepare(
      "SELECT id, email, name, role, password_hash FROM users WHERE email = ?"
    )
    .get(parsed.data.email) as any;
  if (!row || !verifyPassword(parsed.data.password, row.password_hash))
    return res.status(401).json({ error: "invalid credentials" });
  const session = createSession(row.id);
  setSessionCookie(res, session.id, session.expiresAt);
  res.json({ id: row.id, email: row.email, name: row.name, role: row.role });
});

router.post("/logout", (req, res) => {
  const sid = req.cookies?.sid;
  if (sid) destroySession(sid);
  res.clearCookie("sid");
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

export default router;
