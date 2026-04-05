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
import adminAppsRoutes from "./routes/admin-apps";
import healthRoutes from "./routes/health";
import { mountAllApps, getApp } from "./lib/app-loader";
import { buildAllPlugins } from "./lib/plugin-builder";
import { UPLOAD_ROOT } from "./lib/uploads";

async function main() {
  runMigrations();

  // Build any plugin whose client bundle is missing or stale. This covers
  // both the bundled sample apps on first boot and any plugin whose source
  // changed on disk between restarts.
  await buildAllPlugins(path.resolve(process.cwd(), "apps"));

  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(loadUser);

  app.use("/api/health", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/invites", inviteRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/apps", appRoutes);
  app.use("/api/admin/apps", adminAppsRoutes);

  // Mount every plugin's stable outer router under /api/apps/<id>.
  // The inner routers can be swapped at runtime by the installer.
  await mountAllApps(app);

  // Plugin client bundles. Served only to authenticated users who have
  // access to the plugin. The client dynamically imports these as ESM.
  app.use(
    "/plugin-assets/:appId",
    requireAuth,
    (req, res, next) => requireAppAccess(req.params.appId)(req, res, next),
    (req, res, next) => {
      const app = getApp(req.params.appId);
      if (!app) return res.status(404).json({ error: "unknown app" });
      const distDir = path.join(app.dir, "client", "dist");
      express.static(distDir, {
        // ESM imports need the correct mime type.
        setHeaders: (resp, filePath) => {
          if (filePath.endsWith(".js")) resp.setHeader("Content-Type", "text/javascript");
        },
      })(req, res, next);
    }
  );

  // User-uploaded files, authenticated + access-checked per plugin.
  app.use(
    "/uploads/:appId",
    requireAuth,
    (req, res, next) => requireAppAccess(req.params.appId)(req, res, next),
    (req, res, next) => express.static(path.join(UPLOAD_ROOT, req.params.appId))(req, res, next)
  );

  // Static host client in production.
  const clientDist = path.resolve(__dirname, "../public");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api\/|\/uploads\/|\/plugin-assets\/).*/, (_req, res) => {
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
