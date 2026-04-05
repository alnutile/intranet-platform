import { Request, Response, NextFunction } from "express";
import { getUserBySession, User } from "../lib/auth";
import { db } from "../db";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const sid = req.cookies?.sid as string | undefined;
  const user = getUserBySession(sid);
  if (user) req.user = user;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "unauthorized" });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "unauthorized" });
  if (req.user.role !== "admin") return res.status(403).json({ error: "forbidden" });
  next();
}

export function requireAppAccess(appId: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "unauthorized" });
    if (req.user.role === "admin") return next();
    const row = db
      .prepare("SELECT 1 FROM app_access WHERE user_id = ? AND app_id = ?")
      .get(req.user.id, appId);
    if (!row) return res.status(403).json({ error: "no access to this app" });
    next();
  };
}
