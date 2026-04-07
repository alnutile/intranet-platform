import { useEffect, useState, useRef } from "react";
import type { MountContext } from "./main";

interface Store {
  id: number;
  name: string;
  icon: string;
  color: string;
  pending_count: number;
  total_count: number;
}

interface Item {
  id: number;
  store_id: number;
  name: string;
  quantity: string | null;
  category: string | null;
  bought: number;
  bought_at: number | null;
  is_favorite: number;
}

type View = "stores" | "list";

const STORE_ICONS: Record<string, string> = {
  Store: "🏪", Grocery: "🛒", Pharmacy: "💊", Hardware: "🔧",
  Clothing: "👕", Electronics: "📱", Pet: "🐾", Home: "🏠",
  Market: "🧺", Wholesale: "📦", Gas: "⛽", Dollar: "💰",
  Beauty: "💄", Garden: "🌱", Auto: "🚗", Wine: "🍷",
  Butcher: "🥩", Bakery: "🥖", Fish: "🐟", Organic: "🌿",
};

const STORE_COLORS = [
  "#2563EB", "#7C3AED", "#DB2777", "#EA580C",
  "#059669", "#0891B2", "#4F46E5", "#B91C1C",
];

export function App({ ctx }: { ctx: MountContext }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [view, setView] = useState<View>("stores");
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadStores() {
    setStores(await ctx.api<Store[]>("/stores"));
  }

  useEffect(() => {
    loadStores().catch((e) => setErr(e.message));
  }, []);

  function openStore(s: Store) {
    setActiveStore(s);
    setView("list");
  }

  if (view === "list" && activeStore) {
    return (
      <ListView
        ctx={ctx}
        store={activeStore}
        onBack={() => { setView("stores"); loadStores(); }}
      />
    );
  }

  return <StoresView stores={stores} err={err} onOpen={openStore} ctx={ctx} onRefresh={loadStores} />;
}

// ─── Stores grid ────────────────────────────────────────────────────────────

function StoresView({
  stores,
  err,
  onOpen,
  ctx,
  onRefresh,
}: {
  stores: Store[];
  err: string | null;
  onOpen: (s: Store) => void;
  ctx: MountContext;
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Store");
  const [color, setColor] = useState(STORE_COLORS[0]);

  async function addStore(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await ctx.api("/stores", { method: "POST", body: JSON.stringify({ name, icon, color }) });
    setName("");
    setAdding(false);
    onRefresh();
  }

  async function deleteStore(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this store and all its items?")) return;
    await ctx.api(`/stores/${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shopping Lists</h1>
          <p className="text-muted-foreground">Pick a store to start shopping.</p>
        </div>
        <button className={btnPrimary} onClick={() => setAdding(!adding)}>
          {adding ? "Cancel" : "+ Add store"}
        </button>
      </div>

      {err && <p className="text-destructive">{err}</p>}

      {adding && (
        <form onSubmit={addStore} className="rounded-xl border bg-card p-4 space-y-4">
          <div className="space-y-2">
            <label className={labelCls}>Store name</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Trader Joe's, Costco…" required />
          </div>
          <div className="space-y-2">
            <label className={labelCls}>Icon</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STORE_ICONS).map(([key, emoji]) => (
                <button
                  key={key}
                  type="button"
                  className={`h-10 w-10 rounded-lg border text-xl flex items-center justify-center transition ${icon === key ? "ring-2 ring-primary bg-primary/10" : "hover:bg-muted"}`}
                  onClick={() => setIcon(key)}
                  title={key}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className={labelCls}>Color</label>
            <div className="flex gap-2">
              {STORE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-8 w-8 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <button type="submit" className={btnPrimary}>Add store</button>
        </form>
      )}

      {stores.length === 0 && !adding ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          No stores yet — add your first store to get started.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {stores.map((s) => (
            <div
              key={s.id}
              className="group relative rounded-xl border bg-card p-5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
              onClick={() => onOpen(s)}
            >
              <button
                className="absolute top-2 right-2 h-6 w-6 rounded-full text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition"
                onClick={(e) => deleteStore(s.id, e)}
                title="Delete store"
              >
                ✕
              </button>
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl mb-3"
                style={{ backgroundColor: s.color + "15" }}
              >
                {STORE_ICONS[s.icon] || "🏪"}
              </div>
              <h3 className="font-semibold">{s.name}</h3>
              {s.pending_count > 0 ? (
                <p className="text-sm mt-1" style={{ color: s.color }}>
                  {s.pending_count} item{s.pending_count !== 1 ? "s" : ""} to buy
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">All done</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── List view (items + AI prompt) ──────────────────────────────────────────

function ListView({
  ctx,
  store,
  onBack,
}: {
  ctx: MountContext;
  store: Store;
  onBack: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [prompt, setPrompt] = useState("");
  const [quickAdd, setQuickAdd] = useState("");
  const [parsing, setParsing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  async function loadItems() {
    setItems(await ctx.api<Item[]>(`/stores/${store.id}/items`));
  }

  useEffect(() => {
    loadItems();
  }, [store.id]);

  async function toggleBought(id: number) {
    await ctx.api(`/items/${id}/toggle`, { method: "PUT" });
    await loadItems();
  }

  async function toggleFavorite(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    await ctx.api(`/items/${id}/favorite`, { method: "PUT" });
    await loadItems();
  }

  async function rebuy(id: number) {
    await ctx.api(`/items/${id}/rebuy`, { method: "POST" });
    await loadItems();
  }

  async function deleteItem(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    await ctx.api(`/items/${id}`, { method: "DELETE" });
    await loadItems();
  }

  async function clearBought() {
    if (!confirm("Remove all checked-off items?")) return;
    await ctx.api(`/stores/${store.id}/clear-bought`, { method: "POST" });
    await loadItems();
  }

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickAdd.trim()) return;
    await ctx.api(`/stores/${store.id}/items`, {
      method: "POST",
      body: JSON.stringify({ name: quickAdd.trim() }),
    });
    setQuickAdd("");
    await loadItems();
  }

  async function handleAIParse() {
    if (!prompt.trim()) return;
    setErr(null);
    setParsing(true);
    try {
      const res = await ctx.api<{ items: any[] }>("/parse", {
        method: "POST",
        body: JSON.stringify({ text: prompt }),
      });
      if (res.items.length > 0) {
        await ctx.api(`/stores/${store.id}/items/batch`, {
          method: "POST",
          body: JSON.stringify({ items: res.items }),
        });
        setPrompt("");
        await loadItems();
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setParsing(false);
    }
  }

  const pending = items.filter((i) => !i.bought);
  const bought = items.filter((i) => i.bought);

  // Group pending by category
  const grouped = new Map<string, Item[]>();
  for (const item of pending) {
    const cat = item.category || "Other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button className={btnGhost} onClick={onBack}>← Stores</button>
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center text-lg"
          style={{ backgroundColor: store.color + "15" }}
        >
          {STORE_ICONS[store.icon] || "🏪"}
        </div>
        <h1 className="text-2xl font-bold flex-1">{store.name}</h1>
      </div>

      {/* Two-panel: list + prompt */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Main list */}
        <div className="flex-1 space-y-4">
          {/* Quick add */}
          <form onSubmit={handleQuickAdd} className="flex gap-2">
            <input
              className={inputCls + " flex-1"}
              placeholder="Quick add item…"
              value={quickAdd}
              onChange={(e) => setQuickAdd(e.target.value)}
            />
            <button type="submit" className={btnPrimary}>Add</button>
          </form>

          {/* Pending items by category */}
          {pending.length === 0 && bought.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
              List is empty. Add items manually or use the AI prompt.
            </div>
          ) : (
            <>
              {Array.from(grouped.entries()).map(([cat, catItems]) => (
                <div key={cat}>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                    {cat}
                  </div>
                  <div className="space-y-1">
                    {catItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        storeColor={store.color}
                        onToggle={() => toggleBought(item.id)}
                        onFavorite={(e) => toggleFavorite(item.id, e)}
                        onDelete={(e) => deleteItem(item.id, e)}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Bought section */}
              {bought.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Checked off ({bought.length})
                    </div>
                    <button className="text-xs text-muted-foreground hover:text-destructive" onClick={clearBought}>
                      Clear all
                    </button>
                  </div>
                  <div className="space-y-1 opacity-60">
                    {bought.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 group"
                      >
                        <button
                          className="h-5 w-5 rounded border-2 flex items-center justify-center text-xs"
                          style={{ borderColor: store.color, backgroundColor: store.color }}
                          onClick={() => toggleBought(item.id)}
                        >
                          <span className="text-white">✓</span>
                        </button>
                        <span className="flex-1 text-sm line-through">{item.name}</span>
                        <button
                          className="text-xs text-primary opacity-0 group-hover:opacity-100"
                          onClick={() => rebuy(item.id)}
                          title="Buy again"
                        >
                          ↩ Again
                        </button>
                        <button
                          className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                          onClick={(e) => deleteItem(item.id, e)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* AI prompt panel */}
        <div className="lg:w-80 shrink-0">
          <div className="rounded-xl border bg-card p-4 space-y-3 lg:sticky lg:top-24">
            <h3 className="font-semibold text-sm">AI Add Items</h3>
            <p className="text-xs text-muted-foreground">
              Dump a list, a recipe, or just say what you need. AI will parse it into items.
            </p>
            <textarea
              ref={promptRef}
              className={inputCls + " min-h-[120px] resize-y"}
              placeholder={"milk, eggs, bread\nbananas (1 bunch)\nchicken thighs for dinner\nthat good pasta sauce"}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
            />
            {err && <p className="text-xs text-destructive">{err}</p>}
            <button
              className={`${btnPrimary} w-full`}
              onClick={handleAIParse}
              disabled={parsing || !prompt.trim()}
            >
              {parsing ? "Adding…" : "Add to list"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Item row ───────────────────────────────────────────────────────────────

function ItemRow({
  item,
  storeColor,
  onToggle,
  onFavorite,
  onDelete,
}: {
  item: Item;
  storeColor: string;
  onToggle: () => void;
  onFavorite: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 group transition hover:border-foreground/10">
      <button
        className="h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition"
        style={{ borderColor: storeColor }}
        onClick={onToggle}
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{item.name}</span>
        {item.quantity && (
          <span className="text-xs text-muted-foreground ml-2">{item.quantity}</span>
        )}
      </div>
      <button
        className={`text-sm transition ${item.is_favorite ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}
        onClick={onFavorite}
        title={item.is_favorite ? "Remove from favorites" : "Mark as buy-again favorite"}
      >
        {item.is_favorite ? "⭐" : "☆"}
      </button>
      <button
        className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition"
        onClick={onDelete}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const btnPrimary = "inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
const btnGhost = "text-sm text-muted-foreground hover:text-foreground";
const inputCls = "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
const labelCls = "text-sm font-medium leading-none";
