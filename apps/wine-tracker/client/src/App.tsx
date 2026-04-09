import { useEffect, useState, useRef } from "react";
import type { MountContext } from "./main";

interface Wine {
  id: number;
  name: string;
  winery: string | null;
  vintage: number | null;
  varietal: string | null;
  grape: string | null;
  region: string | null;
  country: string | null;
  color: string | null;
  rating: number | null;
  notes: string | null;
  price: number | null;
  purchase_date: string | null;
  photo_filename: string | null;
  created_at: number;
}

type View = "list" | "scan" | "form" | "detail";

export function App({ ctx }: { ctx: MountContext }) {
  const [wines, setWines] = useState<Wine[]>([]);
  const [view, setView] = useState<View>("list");
  const [editData, setEditData] = useState<Partial<Wine>>({});
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setWines(await ctx.api<Wine[]>("/wines"));
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

  function startScan() {
    setEditData({});
    setView("scan");
  }

  function onScanned(data: Partial<Wine>) {
    setEditData(data);
    setView("form");
  }

  function openDetail(w: Wine) {
    setSelectedWine(w);
    setView("detail");
  }

  function editWine(w: Wine) {
    setEditData(w);
    setView("form");
  }

  async function saveWine(data: Partial<Wine>) {
    if (data.id) {
      await ctx.api(`/wines/${data.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    } else {
      const form = new FormData();
      for (const [k, v] of Object.entries(data)) {
        if (v != null && v !== "") form.append(k, String(v));
      }
      await ctx.upload("/wines", form);
    }
    await load();
    setView("list");
  }

  async function removeWine(id: number) {
    await ctx.api(`/wines/${id}`, { method: "DELETE" });
    await load();
    setView("list");
  }

  async function rateWine(id: number, rating: number) {
    await ctx.api(`/wines/${id}`, {
      method: "PUT",
      body: JSON.stringify({ rating }),
    });
    await load();
  }

  const filtered = wines.filter((w) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.winery?.toLowerCase().includes(q) ||
      w.varietal?.toLowerCase().includes(q) ||
      w.region?.toLowerCase().includes(q) ||
      w.country?.toLowerCase().includes(q) ||
      w.grape?.toLowerCase().includes(q) ||
      w.notes?.toLowerCase().includes(q)
    );
  });

  if (view === "scan") {
    return <ScanView ctx={ctx} onScanned={onScanned} onCancel={() => setView("list")} />;
  }

  if (view === "form") {
    return (
      <FormView
        initial={editData}
        onSave={saveWine}
        onCancel={() => setView("list")}
      />
    );
  }

  if (view === "detail" && selectedWine) {
    return (
      <DetailView
        wine={selectedWine}
        onBack={() => { setView("list"); setSelectedWine(null); }}
        onEdit={() => editWine(selectedWine)}
        onDelete={() => removeWine(selectedWine.id)}
        onRate={(r) => rateWine(selectedWine.id, r)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "Manrope, system-ui, sans-serif" }}>Wine Tracker</h1>
          <p className="text-muted-foreground">
            {wines.length} wine{wines.length !== 1 ? "s" : ""} in your cellar
          </p>
        </div>
        <button className={btnPrimary} onClick={startScan}>
          + Add wine
        </button>
      </div>

      {err && <p className="text-destructive">{err}</p>}

      {wines.length > 3 && (
        <input
          className={inputCls}
          placeholder="Search wines…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-[0_2px_12px_rgba(42,52,57,0.04)] dark:bg-gray-900 p-10 text-center text-muted-foreground">
          {wines.length === 0
            ? "No wines yet — tap \"+ Add wine\" to scan your first bottle."
            : "No matches."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => (
            <WineCard
              key={w.id}
              wine={w}
              onClick={() => openDetail(w)}
              onRate={(r) => rateWine(w.id, r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Scan view ──────────────────────────────────────────────────────────────

function ScanView({
  ctx,
  onScanned,
  onCancel,
}: {
  ctx: MountContext;
  onScanned: (data: Partial<Wine>) => void;
  onCancel: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setErr(null);
    setScanning(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const data = await ctx.upload<Partial<Wine> & { error?: string }>("/scan", form);
      if (data.error) {
        setErr(data.error);
        // Still pass through photo_filename so user can fill manually.
        onScanned({ photo_filename: (data as any).photo_filename });
      } else {
        onScanned(data);
      }
    } catch (e: any) {
      setErr(e.message);
      setScanning(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <button className={btnGhost} onClick={onCancel}>← Back</button>
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">Scan a wine label</h2>
        <p className="text-muted-foreground">
          Take a photo or upload an image. AI will read the label and fill in
          the details for you.
        </p>
      </div>

      {scanning ? (
        <div className="rounded-2xl bg-white shadow-[0_2px_12px_rgba(42,52,57,0.04)] dark:bg-gray-900 p-10 text-center space-y-3">
          <div className="animate-pulse text-lg font-medium">Scanning label…</div>
          <p className="text-sm text-muted-foreground">
            Claude is reading your wine label
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            className={`${btnPrimary} w-full h-14 text-base`}
            onClick={() => fileRef.current?.click()}
          >
            📷 Take photo or choose image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFileChange}
          />
          <button
            className={`${btnOutline} w-full`}
            onClick={() => onScanned({})}
          >
            Skip scan — fill in manually
          </button>
        </div>
      )}

      {err && <p className="text-sm text-destructive">{err}</p>}
    </div>
  );
}

// ─── Form view ──────────────────────────────────────────────────────────────

function FormView({
  initial,
  onSave,
  onCancel,
}: {
  initial: Partial<Wine>;
  onSave: (data: Partial<Wine>) => Promise<void>;
  onCancel: () => void;
}) {
  const [data, setData] = useState<Partial<Wine>>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set(field: string, value: any) {
    setData((d) => ({ ...d, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!data.name?.trim()) return setErr("Name is required");
    setErr(null);
    setBusy(true);
    try {
      await onSave(data);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  const isEdit = !!initial.id;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button className={btnGhost} onClick={onCancel}>← Back</button>
      <h2 className="text-2xl font-bold">{isEdit ? "Edit wine" : "Add wine"}</h2>

      {initial.photo_filename && (
        <img
          src={`/uploads/wine-tracker/${initial.photo_filename}`}
          alt="Wine label"
          className="w-full max-h-64 object-contain rounded-xl"
        />
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name *" value={data.name ?? ""} onChange={(v) => set("name", v)} />
          <Field label="Winery" value={data.winery ?? ""} onChange={(v) => set("winery", v)} />
          <Field label="Vintage" value={data.vintage ?? ""} onChange={(v) => set("vintage", v)} type="number" />
          <Field label="Varietal / Grape" value={data.varietal ?? data.grape ?? ""} onChange={(v) => { set("varietal", v); set("grape", v); }} />
          <Field label="Region" value={data.region ?? ""} onChange={(v) => set("region", v)} />
          <Field label="Country" value={data.country ?? ""} onChange={(v) => set("country", v)} />
          <div className="space-y-2">
            <label className={labelCls}>Color</label>
            <select
              className={inputCls}
              value={data.color ?? ""}
              onChange={(e) => set("color", e.target.value || null)}
            >
              <option value="">—</option>
              <option value="red">Red</option>
              <option value="white">White</option>
              <option value="rosé">Rosé</option>
              <option value="sparkling">Sparkling</option>
              <option value="dessert">Dessert</option>
              <option value="orange">Orange</option>
            </select>
          </div>
          <Field label="Price" value={data.price ?? ""} onChange={(v) => set("price", v)} type="number" step="0.01" />
          <Field label="Purchase date" value={data.purchase_date ?? ""} onChange={(v) => set("purchase_date", v)} type="date" />
        </div>
        <div className="space-y-2">
          <label className={labelCls}>Tasting notes</label>
          <textarea
            className={inputCls + " min-h-[80px]"}
            value={data.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
          />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Save wine"}
          </button>
          <button type="button" className={btnOutline} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Detail view ────────────────────────────────────────────────────────────

function DetailView({
  wine,
  onBack,
  onEdit,
  onDelete,
  onRate,
}: {
  wine: Wine;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRate: (r: number) => void;
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button className={btnGhost} onClick={onBack}>← Back</button>

      {wine.photo_filename && (
        <img
          src={`/uploads/wine-tracker/${wine.photo_filename}`}
          alt={wine.name}
          className="w-full max-h-96 object-contain rounded-xl"
        />
      )}

      <div>
        <h2 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "Manrope, system-ui, sans-serif" }}>{wine.name}</h2>
        {wine.winery && <p className="text-lg text-muted-foreground">{wine.winery}</p>}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rating:</span>
        <StarRating current={wine.rating ?? 0} onRate={onRate} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {wine.vintage && <InfoRow label="Vintage" value={String(wine.vintage)} />}
        {wine.varietal && <InfoRow label="Varietal" value={wine.varietal} />}
        {wine.region && <InfoRow label="Region" value={wine.region} />}
        {wine.country && <InfoRow label="Country" value={wine.country} />}
        {wine.color && <InfoRow label="Color" value={wine.color} />}
        {wine.price != null && <InfoRow label="Price" value={`$${wine.price.toFixed(2)}`} />}
        {wine.purchase_date && <InfoRow label="Purchased" value={wine.purchase_date} />}
      </div>

      {wine.notes && (
        <div>
          <div className="text-sm font-medium mb-1">Notes</div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{wine.notes}</p>
        </div>
      )}

      <div className="flex gap-3 pt-6">
        <button className={btnOutline} onClick={onEdit}>Edit</button>
        <button
          className="inline-flex h-10 items-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          onClick={() => {
            if (confirm("Delete this wine?")) onDelete();
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Shared components ──────────────────────────────────────────────────────

function WineCard({
  wine,
  onClick,
  onRate,
}: {
  wine: Wine;
  onClick: () => void;
  onRate: (r: number) => void;
}) {
  return (
    <div
      className="rounded-2xl bg-white shadow-[0_2px_12px_rgba(42,52,57,0.04)] dark:bg-gray-900 text-card-foreground overflow-hidden cursor-pointer transition hover:shadow-md"
      onClick={onClick}
    >
      {wine.photo_filename ? (
        <img
          src={`/uploads/wine-tracker/${wine.photo_filename}`}
          alt={wine.name}
          className="h-48 w-full object-cover"
        />
      ) : (
        <div className="h-32 bg-secondary flex items-center justify-center text-4xl">
          🍷
        </div>
      )}
      <div className="p-4 space-y-2">
        <h3 className="font-semibold leading-tight">{wine.name}</h3>
        <div className="text-xs text-muted-foreground">
          {[wine.winery, wine.vintage, wine.varietal, wine.region]
            .filter(Boolean)
            .join(" · ")}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <StarRating current={wine.rating ?? 0} onRate={onRate} size="sm" />
        </div>
      </div>
    </div>
  );
}

function StarRating({
  current,
  onRate,
  size = "md",
}: {
  current: number;
  onRate: (r: number) => void;
  size?: "sm" | "md";
}) {
  const cls = size === "sm" ? "text-lg" : "text-2xl";
  return (
    <div className={`flex gap-0.5 ${cls}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="hover:scale-110 transition-transform cursor-pointer"
          onClick={() => onRate(n)}
          title={`Rate ${n} star${n > 1 ? "s" : ""}`}
        >
          {n <= current ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-2.5 dark:bg-gray-800">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium capitalize">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  step,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <label className={labelCls}>{label}</label>
      <input
        className={inputCls}
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Style constants ────────────────────────────────────────────────────────

const btnPrimary =
  "inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-medium text-white transition-all disabled:opacity-50 " +
  "bg-gradient-to-br from-[hsl(221,100%,43%)] to-[hsl(227,100%,93%)] " +
  "shadow-[0_2px_12px_rgba(0,83,219,0.15)] hover:shadow-[0_4px_24px_rgba(0,83,219,0.2)]";
const btnOutline =
  "inline-flex h-10 items-center justify-center rounded-lg bg-gray-50 px-4 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";
const btnGhost =
  "text-sm text-muted-foreground hover:text-foreground transition-colors";
const inputCls =
  "flex h-10 w-full rounded-lg bg-gray-100 px-3 py-2 text-sm placeholder:text-gray-400 " +
  "focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-colors " +
  "dark:bg-gray-800 dark:focus:bg-gray-900 dark:placeholder:text-gray-500";
const labelCls = "text-sm font-medium leading-none";
