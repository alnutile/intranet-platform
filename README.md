# Intranet Platform

An open-source, self-hosted intranet foundation for running your own **private "vibe-coded" sub-apps** behind a single auth layer.

> The idea: you host one thing. Inside it you ship as many little personal apps as you like (wine tracker, book log, home inventory, recipe box, whatever you dream up with AI). Each sub-app gets its own database tables, storage, routes, and UI — but users only ever log in once, and only the people you invite can see anything at all.

## Features

- **Closed-by-default registration** — the very first person to hit `/register` becomes the admin. After that, public registration is locked. New users only get in via an invite token.
- **Invite system** — admins generate invite links from the admin panel.
- **SQLite** via `better-sqlite3` — zero-config, one file on disk (`data/app.db`).
- **Sub-app architecture** — drop a folder into `apps/<name>/` with a manifest, schema, server routes, and React pages. It gets auto-mounted.
- **Per-app access control** — admin picks which users can see which apps.
- **File storage** — uploads land in `storage/uploads/<app>/`, served via authenticated routes.
- **shadcn-style UI** — Tailwind + Radix primitives, inlined (no CLI codegen) so it's easy to extend.
- **Sample app: Wine Tracker** — demonstrates photo upload, schema, list/detail views.

## Stack

- Frontend: Vite + React 18 + TypeScript + Tailwind + Radix UI + React Router
- Backend: Express + better-sqlite3 + bcryptjs + cookie sessions + multer
- Everything runs as one Node process in production.

## Quick start

```bash
npm install
npm run migrate      # creates data/app.db and runs core + app migrations
npm run dev          # starts server (3001) and Vite client (5173)
```

Then open http://localhost:5173 and register — you'll become the admin.

## Project layout

```
server/                 Express API, auth, session, sub-app loader
  src/
    index.ts            Entry point
    db/                 SQLite connection + migrations
    routes/             auth, invites, users, apps, uploads
    middleware/         requireAuth, requireAdmin, requireAppAccess
    lib/                app-loader (scans apps/ and mounts them)
client/                 Vite React app
  src/
    pages/              Login, Register, Dashboard, Admin, app host
    components/ui/      shadcn-style Button, Input, Card, etc.
    lib/                api client, auth context
apps/                   Sub-apps live here
  wine-tracker/
    manifest.json       id, name, icon, routes
    migrations/         SQL files prefixed with app id
    server/index.ts     Express router exported as default
    client/index.tsx    React component exported as default
storage/uploads/        User-uploaded files (per app subfolder)
data/app.db             SQLite database (gitignored)
```

## Writing a new sub-app

1. Create `apps/my-app/manifest.json`:
   ```json
   { "id": "my-app", "name": "My App", "icon": "Sparkles" }
   ```
2. Add migrations in `apps/my-app/migrations/001_init.sql`. Prefix tables with `app_myapp_` to avoid collisions.
3. Export an Express router from `apps/my-app/server/index.ts`.
4. Export a React component from `apps/my-app/client/index.tsx`.
5. Run `npm run migrate` and restart. The app auto-appears in the dashboard for users you grant access.

That's the whole contract. Vibe-code the rest.

## License

MIT
