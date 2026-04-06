# Roadmap

Where we're going, in rough order.

---

## v0.1 — Foundation (done)

- [x] Closed-by-default auth: first user becomes admin, invite-only after that
- [x] SQLite (better-sqlite3), single file on disk
- [x] Sub-app plugin contract: manifest + client + optional server/migrations
- [x] Per-user access control per plugin
- [x] File uploads per plugin
- [x] shadcn-style UI components (Tailwind + Radix)
- [x] Sample plugin: Wine Tracker

## v0.2 — Self-hosting + GitHub plugin install (done)

- [x] Dockerfile + docker-compose for one-command deploy
- [x] First-run setup script (SESSION_SECRET generation, directory bootstrap)
- [x] `/api/health` endpoint
- [x] Install a plugin from a public GitHub repo URL
- [x] Validate manifest, build client, run migrations, hot-mount — no restart
- [x] Uninstall + optional data purge
- [x] Admin UI: Plugins page (install / list / reload / uninstall)
- [x] Plugin contract v2: `mount(el, ctx)` entry point (self-contained React bundles)
- [x] Plugins can be full-stack, client-only, or BYO-backend (Supabase etc.)
- [x] `docs/APP_SPEC.md` — canonical plugin contract spec

## v0.3 — Reference plugins that actually work (current)

Make the bundled Wine Tracker a real, usable app — not a scaffold. This sets
the quality bar for every future plugin and proves the contract works
end-to-end.

- [ ] Wine tracker: search, filter, sort
- [ ] Wine tracker: better form (region, grape, price, purchase date)
- [ ] Wine tracker: photo display and detail view
- [ ] Wine tracker: edit existing entries
- [ ] Wine tracker: responsive / mobile-friendly
- [ ] Fix any rough edges found while dogfooding

## v0.4 — In-app AI builder (Anthropic)

Describe an app in natural language inside the platform and have Claude
scaffold it in seconds. Admin-only.

- [ ] Settings page: add `ANTHROPIC_API_KEY`
- [ ] `/admin/apps/new` page with prompt box
- [ ] System prompt embeds `APP_SPEC.md` + wine tracker source as worked example
- [ ] Claude generates manifest, client, server, migrations via tool use
- [ ] Stream progress (SSE) so user watches files appear
- [ ] Preview generated code before committing
- [ ] "Refine" flow: follow-up prompts with current files as context
- [ ] Reuses `app-installer.ts` commit-and-mount path (files from Claude instead of git)

## v0.5 — MCP server for external AI clients

So Claude Code, Claude Desktop, Cursor, or any MCP-capable AI can build
plugins for your intranet from the outside — without an in-browser UI.

- [ ] `server/src/mcp/` — MCP server exposing tools:
  - `read_app_spec` — returns the plugin contract
  - `list_installed_apps`
  - `scaffold_app` — creates manifest + empty structure
  - `write_plugin_file` — write a file into a plugin's directory
  - `install_local_app` — validate, build, migrate, mount
  - `reload_app`
- [ ] Auth: MCP connections require an admin API token
- [ ] Doc: "Connect your AI editor to your intranet" guide

## v0.6 — Polish and ecosystem

- [ ] Plugin registry / curated list of known-good plugins
- [ ] Plugin update flow (re-pull from git, re-migrate, hot-reload)
- [ ] Dark mode toggle
- [ ] Mobile-first dashboard
- [ ] Notifications (plugin → user)

## v0.7 — In-app editor

- [ ] Monaco editor for plugin files (manifest, server, client, migrations)
- [ ] "Ask AI to modify this file" button (wired to Phase C's Anthropic integration)
- [ ] Live preview of changes before saving

## Future ideas (unordered)

- Multi-provider AI builder (OpenAI, Ollama) for users who want fully offline
- Plugin versioning and rollback
- Plugin-to-plugin communication (shared event bus)
- Webhooks (plugin can register HTTP callbacks)
- Background jobs / cron per plugin
- PWA support (installable on phone home screen)
- Multi-tenant: separate intranet instances sharing one deployment
- SSO / OIDC integration for orgs that already have an identity provider
- Audit log (who did what, when)
- Backup/restore (export data + storage as a tarball)

---

## Philosophy

1. **One thing working > four things half-working.** Ship small, ship complete.
2. **WordPress, not Rails.** This is a plugin host, not a framework. Keep the
   contract minimal. Plugin authors bring their own complexity.
3. **AI is the builder, the platform is the host.** The platform doesn't need
   to be smart — it needs to be a stable target that AI tools can build for.
4. **Local-first.** SQLite, file storage, single process. No external services
   required. But plugins are free to reach out (Supabase, APIs, etc.).
5. **Open source.** MIT. The value is the ecosystem, not the lock-in.
