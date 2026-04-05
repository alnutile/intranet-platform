# Plugin contract

A plugin is a directory. The platform finds it by scanning `apps/`. You can
ship a plugin in three flavours — pick the one that matches what you're
building:

| Flavour | Client | Platform server router | Platform SQLite tables |
| --- | --- | --- | --- |
| **Full-stack** | ✅ | ✅ | ✅ |
| **Client-only** | ✅ | — | — |
| **BYO backend** (Supabase, public API, …) | ✅ | — | — |

The only **required** files are `manifest.json` and a client entry. Everything
else is opt-in.

---

## 1. `manifest.json` (required)

```json
{
  "id": "wine-tracker",
  "name": "Wine Tracker",
  "description": "Log wines you've tried.",
  "icon": "Wine",
  "entry": "client/dist/index.js"
}
```

| field | type | notes |
| --- | --- | --- |
| `id` | string | Must match `^[a-z][a-z0-9-]{1,40}$`. Used as the URL slug and as the prefix for DB tables + uploads. |
| `name` | string | Human display name on the dashboard. |
| `description` | string? | One-liner shown under the name. |
| `icon` | string? | A [lucide](https://lucide.dev) icon name, e.g. `"Wine"`, `"Book"`, `"Camera"`. |
| `entry` | string? | Path to the built client bundle, relative to the plugin dir. Defaults to `client/dist/index.js`. |

---

## 2. Client entry (required)

Put your source at `client/src/main.tsx`. Export a default `mount` function:

```tsx
import { createRoot } from "react-dom/client";
import { App } from "./App";

export interface MountContext {
  api:    <T>(path: string, opts?: RequestInit) => Promise<T>;
  upload: <T>(path: string, form: FormData)     => Promise<T>;
  user:   { id: number; name: string; email: string; role: "admin" | "member" };
}

export default function mount(el: HTMLElement, ctx: MountContext) {
  const root = createRoot(el);
  root.render(<App ctx={ctx} />);
  return () => root.unmount();  // called when the user leaves the route
}
```

**Why `mount(el, ctx)` instead of a default-exported component?** Each plugin
is a self-contained bundle with its own copy of React. The host doesn't render
your JSX — it hands you a `<div>` and lets you own it. That sidesteps the
"multiple copies of React" hook-dispatcher bug and lets every plugin bundle
whatever it wants without conflicting with the host or with other plugins.

### The `ctx.api` helper

`ctx.api("/wines")` hits `/api/apps/<your-plugin-id>/wines` with credentials
and JSON handling already wired. Use this for anything on the platform's SQLite.

`ctx.upload("/wines", formData)` does the same for multipart uploads (for
photos, files, etc.).

Plugins that talk to Supabase / a public API / third-party services just
ignore both helpers and use `fetch` or their own SDK directly. The platform
doesn't care.

### Styling

The host's Tailwind CSS is in the document, so your plugin can use the same
classes (`bg-primary`, `rounded-lg`, etc.) and inherit the theme for free.

---

## 3. Server router (optional)

If your plugin uses platform SQLite, ship an Express router at
`server/index.ts`:

```ts
import { Router } from "express";
import { db } from "../../../server/src/db";
import { appUploader } from "../../../server/src/lib/uploads";

const router = Router();
const upload = appUploader("wine-tracker");  // matches manifest.id

router.get("/wines", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM app_wine_tracker_wines WHERE user_id = ?")
    .all(req.user!.id);
  res.json(rows);
});

export default router;
```

Your router is mounted at `/api/apps/<id>/`. Auth and per-user access control
are enforced by the platform before your router runs, so `req.user` is always
populated.

**Namespace your DB tables** with `app_<id>_<table>` so they can't collide
with other plugins or the platform's core tables.

---

## 4. Migrations (optional)

SQL files at `migrations/*.sql`, applied in lexical order, each tracked by
filename so they only run once:

```sql
-- apps/wine-tracker/migrations/001_init.sql
CREATE TABLE IF NOT EXISTS app_wine_tracker_wines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_filename TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
```

---

## 5. File uploads (optional)

Uploads go through `appUploader("<your-id>")` on the server. Files land in
`storage/uploads/<your-id>/` and are served back at `/uploads/<your-id>/<file>`,
authenticated and access-controlled.

---

## 6. Installing your plugin

1. Push the plugin to a public GitHub repo.
2. In the platform, go to **Plugins → Install from GitHub** and paste the URL.
3. The platform clones the repo, validates the manifest, builds the client
   bundle, runs any new migrations, and hot-mounts the server router. No
   restart.

To iterate, push new commits and click **Reload**. The server routes re-load
in place; the client bundle cache-busts on next visit.

---

## Example layout

```
my-plugin/
├── manifest.json
├── migrations/
│   └── 001_init.sql
├── server/
│   └── index.ts
└── client/
    └── src/
        ├── main.tsx        ← exports default mount()
        └── App.tsx
```

See `apps/wine-tracker/` in this repo for a working reference.
