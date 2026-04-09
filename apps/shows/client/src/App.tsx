import { useEffect, useState } from "react";
import type { MountContext } from "./main";

interface Show {
  id: number;
  title: string;
  tldr: string | null;
  channel: string | null;
  year: string | null;
  image_url: string | null;
  tags: string | null;
  watched: number;
  created_at: number;
}

export function App({ ctx }: { ctx: MountContext }) {
  const [shows, setShows] = useState<Show[]>([]);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [hideWatched, setHideWatched] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setShows(await ctx.api<Show[]>("/"));
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

  async function addShow() {
    if (!title.trim()) return;
    setAdding(true);
    setErr(null);
    try {
      await ctx.api("/", {
        method: "POST",
        body: JSON.stringify({ title: title.trim() }),
      });
      setTitle("");
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function toggleWatched(show: Show) {
    await ctx.api(`/${show.id}/watched`, {
      method: "PATCH",
      body: JSON.stringify({ watched: !show.watched }),
    });
    await load();
  }

  async function deleteShow(id: number) {
    if (!confirm("Remove this show?")) return;
    await ctx.api(`/${id}`, { method: "DELETE" });
    await load();
  }

  // Collect all tags
  const allTags = new Set<string>();
  shows.forEach((s) => parseTags(s.tags).forEach((t) => allTags.add(t)));
  const tagList = Array.from(allTags).sort();

  // Filter
  const filtered = shows.filter((s) => {
    if (hideWatched && s.watched) return false;
    if (activeTag && !parseTags(s.tags).includes(activeTag)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.tldr?.toLowerCase().includes(q) ||
        s.channel?.toLowerCase().includes(q) ||
        s.tags?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unwatchedCount = shows.filter((s) => !s.watched).length;
  const watchedCount = shows.filter((s) => s.watched).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium tracking-wide uppercase">
            Watchlist
          </p>
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "Manrope, system-ui, sans-serif" }}>
            Shows to Watch
          </h1>
          <p className="text-muted-foreground mt-1">
            {unwatchedCount} to watch{watchedCount > 0 ? ` · ${watchedCount} watched` : ""}
          </p>
        </div>
      </div>

      {/* Add form */}
      <div className="flex gap-3">
        <input
          className={inputCls + " flex-1"}
          placeholder="Enter a show or movie title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !adding && addShow()}
          disabled={adding}
        />
        <button className={btnPrimary} onClick={addShow} disabled={adding || !title.trim()}>
          {adding ? "Adding…" : "Add"}
        </button>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {/* Filters */}
      {shows.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {shows.length > 3 && (
              <input
                className={inputCls + " max-w-xs"}
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
            <button
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                hideWatched
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              }`}
              onClick={() => setHideWatched((h) => !h)}
            >
              Hide watched
            </button>
          </div>

          {/* Tag filter */}
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  !activeTag
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                }`}
                onClick={() => setActiveTag(null)}
              >
                All
              </button>
              {tagList.map((tag) => (
                <button
                  key={tag}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeTag === tag
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shows list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center text-muted-foreground dark:bg-gray-900" style={{ boxShadow: "0 2px 12px rgba(42,52,57,0.04)" }}>
          {shows.length === 0
            ? "No shows yet — type a title above and hit Add."
            : "No matches."}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((show) => (
            <ShowCard
              key={show.id}
              show={show}
              onToggle={() => toggleWatched(show)}
              onDelete={() => deleteShow(show.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Show card ──────────────────────────────────────────────────────────────

function ShowCard({
  show,
  onToggle,
  onDelete,
}: {
  show: Show;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const tags = parseTags(show.tags);

  return (
    <div
      className={`flex gap-4 rounded-2xl bg-white p-5 transition-all dark:bg-gray-900 ${
        show.watched ? "opacity-60" : ""
      }`}
      style={{ boxShadow: "0 2px 12px rgba(42,52,57,0.04)" }}
    >
      {/* Poster */}
      {show.image_url ? (
        <img
          src={show.image_url}
          alt={show.title}
          className="h-28 w-20 rounded-xl object-cover shrink-0 hidden sm:block"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className="h-28 w-20 rounded-xl bg-purple-50 flex items-center justify-center shrink-0 hidden sm:flex dark:bg-purple-950/20">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple-400">
            <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
            <polyline points="17 2 12 7 7 2"/>
          </svg>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              className={`font-semibold text-sm leading-tight ${show.watched ? "line-through" : ""}`}
              style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
            >
              {show.title}
              {show.year && (
                <span className="font-normal text-muted-foreground ml-1.5">({show.year})</span>
              )}
            </h3>
            {show.channel && (
              <div className="text-xs text-muted-foreground mt-0.5">{show.channel}</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onToggle}
              className={`h-6 w-6 rounded-md flex items-center justify-center transition-colors ${
                show.watched
                  ? "bg-primary text-white"
                  : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              }`}
              title={show.watched ? "Mark unwatched" : "Mark watched"}
            >
              {show.watched && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
            <button
              onClick={onDelete}
              className="h-6 w-6 rounded-md bg-gray-100 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors dark:bg-gray-800 dark:hover:bg-red-950/30"
              title="Remove"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {show.tldr && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{show.tldr}</p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {tags.map((t, i) => (
              <span key={i} className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] text-purple-600 dark:bg-purple-950/30 dark:text-purple-300">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function parseTags(val: string | null): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Design tokens (Fluid Workspace) ───────────────────────────────────────

const btnPrimary =
  "inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-medium text-white transition-all disabled:opacity-50 " +
  "bg-gradient-to-br from-[hsl(221,100%,43%)] to-[hsl(227,100%,93%)] " +
  "shadow-[0_2px_12px_rgba(0,83,219,0.15)] hover:shadow-[0_4px_24px_rgba(0,83,219,0.2)]";

const inputCls =
  "flex h-10 w-full rounded-lg bg-gray-100 px-3 py-2 text-sm placeholder:text-gray-400 " +
  "focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-colors " +
  "dark:bg-gray-800 dark:focus:bg-gray-900 dark:placeholder:text-gray-500";
