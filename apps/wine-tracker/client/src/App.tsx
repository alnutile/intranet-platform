import { useEffect, useState } from "react";
import type { MountContext } from "./main";

interface Wine {
  id: number;
  name: string;
  winery: string | null;
  vintage: number | null;
  varietal: string | null;
  rating: number | null;
  notes: string | null;
  photo_filename: string | null;
  created_at: number;
}

export function App({ ctx }: { ctx: MountContext }) {
  const [wines, setWines] = useState<Wine[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setWines(await ctx.api<Wine[]>("/wines"));
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

  async function remove(id: number) {
    await ctx.api(`/wines/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Wine Tracker</h1>
          <p className="text-muted-foreground">Your personal cellar log.</p>
        </div>
        <button
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          onClick={() => setShowForm((s) => !s)}
        >
          {showForm ? "Cancel" : "Add wine"}
        </button>
      </div>

      {err && <p className="text-destructive">{err}</p>}

      {showForm && (
        <WineForm
          ctx={ctx}
          onSaved={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}

      {wines.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
          No wines yet — add your first bottle.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wines.map((w) => (
            <div key={w.id} className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
              {w.photo_filename && (
                <img
                  src={`/uploads/wine-tracker/${w.photo_filename}`}
                  alt={w.name}
                  className="h-48 w-full object-cover"
                />
              )}
              <div className="p-6 space-y-2">
                <h3 className="text-lg font-semibold leading-none tracking-tight">{w.name}</h3>
                <div className="text-sm text-muted-foreground">
                  {[w.winery, w.vintage, w.varietal].filter(Boolean).join(" · ")}
                </div>
                {w.rating && <div>{"★".repeat(w.rating)}{"☆".repeat(5 - w.rating)}</div>}
                {w.notes && <p className="text-sm">{w.notes}</p>}
                <button
                  className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
                  onClick={() => remove(w.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WineForm({ ctx, onSaved }: { ctx: MountContext; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      await ctx.upload("/wines", form);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const labelCls = "text-sm font-medium leading-none";

  return (
    <div className="rounded-lg border bg-card p-6">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><label className={labelCls}>Name</label><input className={inputCls} name="name" required /></div>
          <div className="space-y-2"><label className={labelCls}>Winery</label><input className={inputCls} name="winery" /></div>
          <div className="space-y-2"><label className={labelCls}>Vintage</label><input className={inputCls} name="vintage" type="number" min="1800" max="2100" /></div>
          <div className="space-y-2"><label className={labelCls}>Varietal</label><input className={inputCls} name="varietal" placeholder="Pinot Noir…" /></div>
          <div className="space-y-2"><label className={labelCls}>Rating (1-5)</label><input className={inputCls} name="rating" type="number" min="1" max="5" /></div>
          <div className="space-y-2"><label className={labelCls}>Photo</label><input className={inputCls} name="photo" type="file" accept="image/*" capture="environment" /></div>
        </div>
        <div className="space-y-2">
          <label className={labelCls}>Tasting notes</label>
          <textarea name="notes" rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save wine"}
        </button>
      </form>
    </div>
  );
}
