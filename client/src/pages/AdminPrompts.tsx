import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Prompt {
  key: string;
  prompt_text: string;
  updated_at: number;
  updated_by: number | null;
}

/** All plugin prompts with their default keys, for seeding the UI. */
const KNOWN_PROMPTS: Array<{ key: string; label: string; plugin: string }> = [
  { key: "wine_tracker.scan", label: "Wine label scan", plugin: "Wine Tracker" },
  { key: "recipes.scan", label: "Recipe image scan", plugin: "Recipes" },
  { key: "recipes.parse_text", label: "Recipe text parse", plugin: "Recipes" },
  { key: "recipes.cover_description", label: "Cover image description", plugin: "Recipes" },
  { key: "shopping_list.parse", label: "Shopping list parse", plugin: "Shopping List" },
];

export function AdminPromptsPage() {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const rows = await api<Prompt[]>("/api/prompts");
    setPrompts(rows);
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

  if (user?.role !== "admin") return <Navigate to="/" replace />;

  function getCustom(key: string): Prompt | undefined {
    return prompts.find((p) => p.key === key);
  }

  function startEdit(key: string) {
    const existing = getCustom(key);
    setEditText(existing?.prompt_text ?? "");
    setEditing(key);
    setMsg(null);
    setErr(null);
  }

  async function save(key: string) {
    if (!editText.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await api(`/api/prompts/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ prompt_text: editText }),
      });
      setMsg(`Saved "${key}"`);
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function revert(key: string) {
    if (!confirm(`Revert "${key}" to the plugin's hardcoded default?`)) return;
    setErr(null);
    try {
      await api(`/api/prompts/${encodeURIComponent(key)}`, { method: "DELETE" });
      setMsg(`Reverted "${key}" to default`);
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  // Group by plugin
  const grouped = new Map<string, typeof KNOWN_PROMPTS>();
  for (const p of KNOWN_PROMPTS) {
    const arr = grouped.get(p.plugin) || [];
    arr.push(p);
    grouped.set(p.plugin, arr);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground font-medium tracking-wide uppercase">
          Admin
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-2">
          Prompts
        </h1>
        <p className="text-muted-foreground mt-1">
          Customize the AI prompts used by each plugin. Changes take effect immediately — no code push required.
        </p>
      </div>

      {err && <p className="text-destructive text-sm">{err}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}

      {Array.from(grouped).map(([plugin, items]) => (
        <Card key={plugin}>
          <CardHeader>
            <CardTitle className="font-display text-lg">{plugin}</CardTitle>
            <CardDescription>
              {items.length} prompt{items.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item) => {
              const custom = getCustom(item.key);
              const isEditing = editing === item.key;

              return (
                <div key={item.key} className="rounded-xl bg-surface-container-low p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs text-muted-foreground font-mono">{item.key}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {custom && (
                        <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-xs text-primary font-medium">
                          customized
                        </span>
                      )}
                      {!custom && (
                        <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs text-muted-foreground">
                          default
                        </span>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        className="flex w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm font-mono min-h-[200px] resize-y focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-colors"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        placeholder="Enter your custom prompt…"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => save(item.key)} disabled={saving}>
                          {saving ? "Saving…" : "Save"}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                        {custom && (
                          <Button size="sm" variant="outline" onClick={() => revert(item.key)}>
                            Revert to default
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => startEdit(item.key)}>
                        {custom ? "Edit prompt" : "Customize"}
                      </Button>
                      {custom && (
                        <Button size="sm" variant="outline" onClick={() => revert(item.key)}>
                          Revert
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
