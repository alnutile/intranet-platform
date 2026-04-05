# Intranet Platform

An open-source, self-hosted **WordPress-style plugin host** for your own
private React apps. One self-hosted wrapper, one login, as many little
personal apps as you like — wine tracker, book log, home inventory, recipe
box — each a plugin you either write yourself, install from a GitHub URL,
or (soon) generate from a prompt.

> Unlike WordPress, this isn't a CMS. Plugins are real React apps. The
> platform's job is auth, access control, a plugin contract, and a place
> for each plugin to store its data.

## What you get

- **Closed-by-default auth.** The first person to register becomes the admin;
  public signup locks automatically. Everyone else joins via invite link.
- **One database, one auth, N apps.** Each plugin lives in `apps/<id>/` and
  gets its own URL (`/apps/<id>`), its own API namespace
  (`/api/apps/<id>/...`), its own SQLite tables (`app_<id>_*`), and its own
  upload folder.
- **Install plugins from GitHub, at runtime, without a server restart.**
  Paste a repo URL into the admin panel — the platform clones it, builds
  the client, runs any new migrations, and hot-mounts it live.
- **Bring your own backend if you want.** Plugins are free to skip the
  platform's SQLite entirely and talk to Supabase / a public API / whatever.
  The plugin contract is "ship a `manifest.json` and a React mount function";
  server code and migrations are optional.
- **Per-plugin access control.** Admin picks which users can see which
  plugins. Admins see everything by default.

## Self-hosting

```bash
git clone <this-repo> intranet-platform
cd intranet-platform
docker compose up --build
```

Open **http://localhost:3001**, fill out the register form — you become the
admin, and public signup locks immediately.

Volumes `./data` (SQLite + session store) and `./storage/uploads`
(user-uploaded files) survive container rebuilds.

### Without Docker

```bash
npm install
npm run setup     # creates .env with a random SESSION_SECRET
npm run build     # builds the host client bundle
npm start         # starts Express on :3001 (serves the built client)
```

For local development with hot reload on both sides:

```bash
npm run dev       # server on :3001, Vite dev server on :5173
```

## Installing a plugin from GitHub

1. Sign in as admin → **Plugins** (top nav) → **Install from GitHub**.
2. Paste a `https://github.com/<owner>/<repo>` URL and (optionally) a branch.
3. Hit **Install**. The platform will:
   - shallow-clone the repo,
   - validate `manifest.json`,
   - build the client bundle,
   - run any new migrations,
   - hot-mount the server router (no restart required).

The new plugin immediately shows up on the dashboard for you (and for any
members you grant access to under **Admin → Users**).

## Writing a plugin

Full contract: [`docs/APP_SPEC.md`](docs/APP_SPEC.md).

Minimum viable plugin:

```
my-plugin/
├── manifest.json                     # { id, name, icon, entry }
└── client/src/main.tsx               # default-exports mount(el, ctx)
```

With server + migrations (if you want to use the platform's SQLite):

```
my-plugin/
├── manifest.json
├── migrations/001_init.sql
├── server/index.ts                   # default-exports an Express Router
└── client/src/main.tsx
```

See `apps/wine-tracker/` in this repo for a working reference with photo
uploads, server routes, and migrations.

## Project layout

```
server/src/
  index.ts                Entry point
  db/                     SQLite connection + core schema + migration runner
  routes/                 auth, invites, users, apps, admin-apps, health
  middleware/             requireAuth, requireAdmin, requireAppAccess
  lib/
    app-loader.ts         Hot-mount outer/inner router shim
    app-installer.ts      git clone + validate + install + uninstall
    plugin-builder.ts     Vite lib-mode build for plugin clients
    module-cache.ts       Scoped require-cache busting (never touches shared code)
    uploads.ts            Per-plugin multer storage
client/src/
  App.tsx                 Router shell
  pages/                  Login, Register, Dashboard, Admin, AdminApps, AppHost
  components/ui/          shadcn-style primitives
  lib/                    api client, auth context
apps/
  wine-tracker/           Reference plugin (full-stack example)
docs/
  APP_SPEC.md             Plugin contract
data/app.db               SQLite database (gitignored)
storage/uploads/<id>/     User-uploaded files per plugin (gitignored)
```

## Roadmap

- **Now**: self-hosting + GitHub plugin install + hot-mount (this PR).
- **Next**: in-app AI builder — describe an app in natural language inside
  the platform and have Claude scaffold it in seconds.
- **Then**: MCP server so Claude Desktop / Claude Code / Cursor can all build
  plugins for this platform from the outside using one shared tool spec.
- **Later**: in-app Monaco editor with "Ask AI to modify this file"; other
  providers (OpenAI, Ollama).

## License

MIT
