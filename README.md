# Intranet Platform

**Your own private app store.** One self-hosted platform, one login,
as many apps as you can dream up.

![Dashboard](docs/screenshot.png)

You host one thing. Inside it you build whatever you need — a wine
tracker, a recipe box, shopping lists, a home inventory, a workout
log — each one a plugin that shares auth, storage, and a database.
No spinning up separate projects. No managing multiple deployments.
No per-app auth headaches.

The first person to register becomes the admin. Public signup locks
automatically. Everyone else joins by invite. It's your space.

**AI does the heavy lifting.** The bundled plugins use Claude Vision
to scan wine labels, extract recipes from photos, and parse messy
shopping lists into structured items. That same AI integration is
available to any plugin you build.

---

## Three ways to get started

### 1. Deploy on Railway (easiest)

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template)

Or manually:
- New project → Deploy from GitHub → point at your repo
- Add a volume mounted at `/app/persist`
- Set `SESSION_SECRET`, `DATABASE_PATH=/app/persist/app.db`,
  `UPLOAD_DIR=/app/persist/uploads`
- Optionally add `ANTHROPIC_API_KEY` for AI features
- Deploy. You get HTTPS for free.

### 2. Build your own app with AI

Clone this repo, point your AI tool at it, and tell it to build you
a plugin.

```bash
git clone https://github.com/alnutile/intranet-platform.git my-intranet
cd my-intranet
```

Then open it in **Claude Code**, **Cursor**, or any AI editor. The repo
includes [`CLAUDE.md`](CLAUDE.md) — a complete guide that tells the AI
exactly how this system works: the plugin contract, file structure,
database conventions, styling patterns, and working examples to learn
from. Your AI assistant reads this file and can build a new plugin from
a single sentence.

> "Build me a book tracker where I can scan an ISBN barcode and it saves
> the book with its cover art"

The AI knows where to put the files, how to write the manifest, how to
create migrations, how to use the API helpers, and how to style it to
match the existing theme. It just works.

### 3. Install community plugins from GitHub

Already have a plugin repo that follows the contract? Install it live
from the admin panel — no restart needed.

**Admin → Plugins → Install from GitHub** → paste the repo URL → done.

The platform clones it, validates the manifest, builds the client, runs
migrations, and hot-mounts the server routes. All at runtime.

See [`docs/APP_SPEC.md`](docs/APP_SPEC.md) for the full plugin contract.

---

## Too busy to self-host?

Just want it running so you can focus on building apps inside it?

**Reach out** — [alfred@dailyai.studio](mailto:alfred@dailyai.studio)

I'll set up a hosted instance for you so you can skip the infra and go
straight to building.

---

## Bundled plugins

These ship with the platform and demonstrate what's possible:

| Plugin | What it does |
| --- | --- |
| **Wine Tracker** | Snap a photo of a wine label → Claude reads it → auto-fills name, winery, vintage, region, varietal. Rate wines later, search and filter your cellar. |
| **Recipes** | Paste messy recipe text or photograph a cookbook page → Claude structures it into title, ingredients, step-by-step instructions, prep/cook times, and tags. |
| **Shopping List** | Organize lists by store. Dump items via AI prompt ("milk, eggs, that good pasta sauce") → parsed into categorized items. Check off as you shop, star favorites for buy-again. |

---

## Using this repo as your own intranet

This repo is meant to be **cloned, not forked**. You'll add your own
plugins, your own data, your own `.env`. But you can still pull in
upstream improvements without losing your local work.

```bash
# 1. Clone and set your own origin
git clone https://github.com/alnutile/intranet-platform.git my-intranet
cd my-intranet
git remote rename origin upstream
git remote add origin git@github.com:you/my-intranet.git
git push -u origin main

# 2. Add your plugins in apps/, commit to your origin

# 3. Pull upstream updates anytime
git fetch upstream
git merge upstream/main
```

Why this merges cleanly: your plugins live in `apps/`. Platform code
lives in `server/` and `client/`. Different directories, rare conflicts.

Don't want a bundled plugin? Delete its folder and commit. Upstream
updates to it become no-ops.

---

## Quick start (local)

```bash
npm install
npm run setup     # creates .env with a random SESSION_SECRET
npm run dev       # server :3001 + Vite :5173
```

Or with Docker:

```bash
docker compose up --build    # http://localhost:3001
```

Add `ANTHROPIC_API_KEY=sk-ant-...` to your `.env` for AI features.

## Building a plugin

Full contract: [`docs/APP_SPEC.md`](docs/APP_SPEC.md)
AI-readable guide: [`CLAUDE.md`](CLAUDE.md)

Minimum plugin (client-only):
```
my-plugin/
├── manifest.json              # { id, name, icon }
└── client/src/main.tsx        # exports default mount(el, ctx)
```

Full-stack plugin (with server + database):
```
my-plugin/
├── manifest.json
├── migrations/001_init.sql    # tables prefixed app_<id>_
├── server/index.ts            # exports Express Router
└── client/src/main.tsx
```

Plugins that talk to Supabase, Firebase, or any external API skip the
server and migrations — just ship the manifest and the client.

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SESSION_SECRET` | Yes | auto-generated | Cookie signing key |
| `DATABASE_PATH` | No | `./persist/app.db` | SQLite database location |
| `UPLOAD_DIR` | No | `./persist/uploads` | File upload storage |
| `ANTHROPIC_API_KEY` | No | — | Enables AI features (label scanning, recipe parsing, etc.) |
| `PORT` | No | `3001` | Server port |

## Roadmap

See [ROADMAP.md](ROADMAP.md). Next up:
- **In-app AI builder** — describe an app → Claude scaffolds it live
- **MCP server** — so Claude Code / Cursor can build plugins from outside
- **In-app editor** — Monaco + AI assist for editing plugin code in the browser

## License

MIT
