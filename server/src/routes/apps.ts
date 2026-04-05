import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { appsForUser, listApps } from "../lib/app-loader";

const router = Router();

// The apps this user is allowed to see (admin → all).
router.get("/", requireAuth, (req, res) => {
  res.json(appsForUser(req.user!.id, req.user!.role));
});

// Full catalog, admin only (used to render the access-grant matrix).
router.get("/all", requireAdmin, (_req, res) => {
  res.json(listApps().map((a) => a.manifest));
});

export default router;
