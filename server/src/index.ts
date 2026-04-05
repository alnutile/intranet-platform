import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { runMigrations } from "./db/migrate";
import { loadUser, requireAuth, requireAppAccess } from "./middleware/auth";
import authRoutes from "./routes/auth";
import inviteRoutes from "./routes/invites";
import userRoutes from "./routes/users";
import appRoutes from "./routes/apps";
import { mountApps } from "./lib/app-loader";
import { UPLOAD_ROOT } from "./lib/uploads";

async function main() {
  runMigrations();

  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(loadUser);

  app.use("/api/auth", authRoutes);
  app.use("/api/invites", inviteRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/apps", appRoutes);

  // Mount each sub-app's router under /api/apps/:id with access control.
  await mountApps(app);

  // Serve user-uploaded files, but only to authenticated users.
  // Per-app access is enforced by matching the first path segment against
  // the caller's app grants.
  app.use(
    "/uploads/:appId",
    requireAuth,
    (req, res, next) => requireAppAccess(req.params.appId)(req, res, next),
    (req, res, next) => express.static(path.join(UPLOAD_ROOT, req.params.appId))(req, res, next)
  );

  // Static client in production.
  const clientDist = path.resolve(__dirname, "../public");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api\/|\/uploads\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  const port = Number(process.env.PORT || 3001);
  app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
