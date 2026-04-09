# CLAUDE.md — How to build apps in this system

This file is for AI assistants (Claude Code, Cursor, Copilot, etc.) that
are helping a user build plugins for this intranet platform.

## What is this?

An open-source, self-hosted intranet that hosts React plugins behind a
single auth layer with SQLite. Think "WordPress for private apps" — the
platform provides auth, routing, storage, and a plugin contract. You
build the apps.

## The plugin contract

Every plugin is a directory in `apps/<id>/`. The full spec is at
`docs/APP_SPEC.md`, but here's the quick version:

### Required files

**`manifest.json`**
```json
{
  "id": "my-app",
  "name": "My App",
  "description": "What it does in one sentence.",
  "icon": "Sparkles",
  "entry": "client/dist/index.js"
}
```
- `id`: lowercase letters, digits, dashes. Max 40 chars. This becomes the URL slug and DB table prefix.
- `icon`: any [Lucide](https://lucide.dev) icon name.
- `entry`: path to the built client bundle (the platform builds this automatically from source).

**`client/src/main.tsx`** — the client entry point:
```tsx
import { createRoot } from "react-dom/client";
import { App } from "./App";

export interface MountContext {
  api: <T = any>(path: string, opts?: RequestInit) => Promise<T>;
  upload: <T = any>(path: string, form: FormData) => Promise<T>;
  user: { id: number; name: string; email: string; role: "admin" | "member" };
}

export default function mount(el: HTMLElement, ctx: MountContext): () => void {
  const root = createRoot(el);
  root.render(<App ctx={ctx} />);
  return () => root.unmount();
}
```

Each plugin is a **self-contained React app** with its own copy of React.
The host gives it a DOM element and a context object. The plugin owns
that subtree completely.

### Optional files

**`server/index.ts`** — Express router for server-side logic:
```ts
import { Router } from "express";
import { db } from "../../../server/src/db";
import { appUploader } from "../../../server/src/lib/uploads";

const router = Router();

router.get("/items", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM app_myapp_items ORDER BY created_at DESC")
    .all();
  res.json(rows);
});

export default router;
```
- Mounted at `/api/apps/<id>/`. Auth is enforced by the platform.
- `req.user` is always available (id, email, name, role).
- Use `appUploader("<id>")` for file uploads.

**`migrations/*.sql`** — SQLite migrations:
```sql
-- migrations/001_init.sql
CREATE TABLE IF NOT EXISTS app_myapp_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
```
- **Always prefix tables** with `app_<id>_` to avoid collisions.
- Files run in lexical order, each tracked so they only execute once.
- Use `IF NOT EXISTS` for safety.

## Key conventions

### Data model
- **Shared by default.** All users with access to an app see the same data.
  ACL is at the app level, not the row level. Don't filter by `user_id`
  on reads unless the app specifically needs private data.
- The `user_id` column should still exist on write — it tracks who created
  a record. Just don't filter on it when reading.

### Client patterns
- **Tailwind CSS is global.** Plugins can use all the host's utility classes
  (`bg-primary`, `text-muted-foreground`, `rounded-xl`, etc.) and they
  inherit the theme (including dark mode) automatically.
- **`ctx.api(path)`** is pre-scoped to `/api/apps/<this-plugin>/`. So
  `ctx.api("/items")` hits `/api/apps/my-app/items`.
- **`ctx.upload(path, formData)`** is the same but for multipart uploads.
- Use inline Tailwind classes. Don't import the host's React components
  (Button, Card, etc.) — plugins have their own React instance so they
  can't share components across the boundary. Instead, use the same
  Tailwind class patterns:
  ```tsx
  // Button-like
  <button className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
    Save
  </button>
  // Card-like
  <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
    ...
  </div>
  // Input
  <input className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
  ```

### Server patterns
- **Zod for validation** — `import { z } from "zod"` is available.
- **`db` from `"../../../server/src/db"`** gives you the better-sqlite3
  instance. Use prepared statements.
- **Uploads** — `appUploader("<id>")` returns a multer instance. Files
  land in `storage/uploads/<id>/` and are served at
  `/uploads/<id>/<filename>` (authenticated).

### AI integration
- `ANTHROPIC_API_KEY` may be set in the environment. Import the SDK
  dynamically: `const Anthropic = (await import("@anthropic-ai/sdk")).default;`
- Always check `process.env.ANTHROPIC_API_KEY` first and return a helpful
  error if it's missing.
- Use `claude-sonnet-4-20250514` for most tasks.
- When parsing images, use the Messages API with `type: "image"` content.
- When parsing text, ask for JSON-only output and strip markdown fences.

### Editable prompts
Prompts are stored in a shared `prompts` table so admins can tweak AI
behavior from the UI (Admin → Prompts) without pushing code.

- **Import:** `import { getPrompt } from "../../../server/src/lib/prompts";`
- **Key convention:** `snake_case_plugin_id.action` — e.g. `wine_tracker.scan`,
  `recipes.parse_text`, `shopping_list.parse`.
- **Usage:** Define your hardcoded default as a const, then call:
  ```ts
  const prompt = getPrompt("my_app.summarize", DEFAULT_PROMPT);
  ```
  If an admin has customized the prompt in the UI, the DB version is
  returned. Otherwise the hardcoded default is used.
- **Dynamic data:** Append user input after the prompt, don't embed it:
  ```ts
  content: getPrompt("my_app.parse", DEFAULT_PARSE_PROMPT) + userText,
  ```

## Reference plugins

Study these for working examples:

| Plugin | Path | Demonstrates |
| --- | --- | --- |
| Wine Tracker | `apps/wine-tracker/` | Image upload, Claude Vision for label scanning, full CRUD, star ratings |
| Recipes | `apps/recipes/` | Two input modes (photo + text paste), AI structuring, JSON arrays in SQLite |
| Shopping List | `apps/shopping-list/` | Two-level navigation (stores → items), batch AI parsing, favorites/buy-again |

## File structure of a typical plugin

```
apps/my-app/
├── manifest.json
├── migrations/
│   └── 001_init.sql
├── server/
│   └── index.ts          # Express router (optional)
└── client/
    └── src/
        ├── main.tsx      # mount(el, ctx) entry point
        └── App.tsx       # your React app
```

## Don't

- Don't import from `client/src/components/ui/` — those are host-only
  React components and can't cross the plugin boundary.
- Don't use `import.meta.glob` or dynamic Vite features — plugins are
  built as standalone ESM bundles.
- Don't create tables without the `app_<id>_` prefix.
- Don't filter reads by `user_id` unless the app has a specific reason
  for private data.
