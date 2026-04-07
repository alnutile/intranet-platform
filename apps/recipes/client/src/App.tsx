import { useEffect, useState, useRef } from "react";
import type { MountContext } from "./main";

interface Recipe {
  id: number;
  title: string;
  description: string | null;
  prep_time: string | null;
  cook_time: string | null;
  servings: string | null;
  ingredients: string; // JSON
  instructions: string; // JSON
  cuisine: string | null;
  tags: string | null; // JSON
  source_text: string | null;
  photo_filename: string | null;
  cover_filename: string | null;
  created_at: number;
}

type View = "list" | "add" | "form" | "detail";

export function App({ ctx }: { ctx: MountContext }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [view, setView] = useState<View>("list");
  const [formData, setFormData] = useState<Partial<Recipe>>({});
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setRecipes(await ctx.api<Recipe[]>("/"));
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

  function startAdd() {
    setFormData({});
    setView("add");
  }

  function onParsed(data: Partial<Recipe>) {
    setFormData(data);
    setView("form");
  }

  function editRecipe(r: Recipe) {
    setFormData(r);
    setView("form");
  }

  async function saveRecipe(data: Partial<Recipe>) {
    // Ensure arrays are JSON strings for the server.
    const body: any = { ...data };
    for (const key of ["ingredients", "instructions", "tags"]) {
      const val = body[key];
      if (Array.isArray(val)) {
        body[key] = JSON.stringify(val);
      } else if (typeof val === "string" && !val.startsWith("[")) {
        // Newline-separated text from the form → JSON array
        body[key] = JSON.stringify(val.split("\n").map((s: string) => s.trim()).filter(Boolean));
      }
    }

    if (data.id) {
      await ctx.api(`/${data.id}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      const form = new FormData();
      for (const [k, v] of Object.entries(body)) {
        if (v != null && v !== "") form.append(k, String(v));
      }
      await ctx.upload("/", form);
    }
    await load();
    setView("list");
  }

  async function removeRecipe(id: number) {
    await ctx.api(`/${id}`, { method: "DELETE" });
    await load();
    setView("list");
  }

  const filtered = recipes.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.cuisine?.toLowerCase().includes(q) ||
      r.ingredients.toLowerCase().includes(q)
    );
  });

  if (view === "add")
    return <AddView ctx={ctx} onParsed={onParsed} onCancel={() => setView("list")} />;
  if (view === "form")
    return <FormView initial={formData} onSave={saveRecipe} onCancel={() => setView("list")} />;
  if (view === "detail" && selected)
    return (
      <DetailView
        recipe={selected}
        onBack={() => { setView("list"); setSelected(null); }}
        onEdit={() => editRecipe(selected)}
        onDelete={() => removeRecipe(selected.id)}
      />
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Recipes</h1>
          <p className="text-muted-foreground">
            {recipes.length} recipe{recipes.length !== 1 ? "s" : ""} saved
          </p>
        </div>
        <button className={btnPrimary} onClick={startAdd}>+ Add recipe</button>
      </div>

      {err && <p className="text-destructive">{err}</p>}

      {recipes.length > 3 && (
        <input className={inputCls} placeholder="Search recipes…" value={search} onChange={(e) => setSearch(e.target.value)} />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
          {recipes.length === 0
            ? 'No recipes yet — tap "+ Add recipe" to get started.'
            : "No matches."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} onClick={() => { setSelected(r); setView("detail"); }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add view: choose input method ─────────────────────────────────────────

function AddView({
  ctx,
  onParsed,
  onCancel,
}: {
  ctx: MountContext;
  onParsed: (data: Partial<Recipe>) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "text" | "scanning">("choose");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePhoto(file: File) {
    setErr(null);
    setMode("scanning");
    try {
      const form = new FormData();
      form.append("photo", file);
      const data = await ctx.upload<any>("/scan", form);
      onParsed({ ...data, photo_filename: data.photo_filename });
    } catch (e: any) {
      setErr(e.message);
      setMode("choose");
    }
  }

  async function handleText() {
    if (!text.trim()) return;
    setErr(null);
    setBusy(true);
    try {
      const data = await ctx.api<any>("/parse", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      onParsed({ ...data, source_text: text });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "scanning") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <button className={btnGhost} onClick={onCancel}>← Back</button>
        <div className="rounded-lg border bg-card p-10 text-center space-y-3">
          <div className="animate-pulse text-lg font-medium">Reading recipe…</div>
          <p className="text-sm text-muted-foreground">Claude is extracting the recipe from your image</p>
        </div>
      </div>
    );
  }

  if (mode === "text") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button className={btnGhost} onClick={() => setMode("choose")}>← Back</button>
        <h2 className="text-2xl font-bold">Paste your recipe</h2>
        <p className="text-muted-foreground">
          Paste the recipe text in any format — messy notes, a URL dump, whatever. AI will clean it up.
        </p>
        <textarea
          className={inputCls + " min-h-[200px]"}
          placeholder="Paste recipe text here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
        />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex gap-3">
          <button className={btnPrimary} onClick={handleText} disabled={busy || !text.trim()}>
            {busy ? "Parsing…" : "Clean up with AI"}
          </button>
          <button className={btnOutline} onClick={() => onParsed({ source_text: text })}>
            Skip AI — edit manually
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <button className={btnGhost} onClick={onCancel}>← Back</button>
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">Add a recipe</h2>
        <p className="text-muted-foreground">How do you want to add it?</p>
      </div>
      <div className="space-y-3">
        <button className={`${btnPrimary} w-full h-14 text-base`} onClick={() => fileRef.current?.click()}>
          📷 Scan a photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }} />
        <button className={`${btnOutline} w-full h-14 text-base`} onClick={() => setMode("text")}>
          📝 Paste text
        </button>
        <button className={`${btnOutline} w-full h-14 text-base`} onClick={() => onParsed({})}>
          ✏️ Start from scratch
        </button>
      </div>
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
  initial: Partial<Recipe>;
  onSave: (data: Partial<Recipe>) => Promise<void>;
  onCancel: () => void;
}) {
  const ingredients = parseJsonArray(initial.ingredients);
  const instructions = parseJsonArray(initial.instructions);
  const tags = parseJsonArray(initial.tags);

  const [data, setData] = useState({
    ...initial,
    ingredients: ingredients.join("\n"),
    instructions: instructions.join("\n"),
    tags: tags.join(", "),
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isEdit = !!initial.id;

  function set(field: string, value: any) {
    setData((d) => ({ ...d, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!data.title?.trim()) return setErr("Title is required");
    setErr(null);
    setBusy(true);
    try {
      await onSave({
        ...data,
        ingredients: JSON.stringify(
          (data.ingredients as string).split("\n").map((s) => s.trim()).filter(Boolean)
        ),
        instructions: JSON.stringify(
          (data.instructions as string).split("\n").map((s) => s.trim()).filter(Boolean)
        ),
        tags: JSON.stringify(
          (data.tags as string).split(",").map((s) => s.trim()).filter(Boolean)
        ),
      });
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button className={btnGhost} onClick={onCancel}>← Back</button>
      <h2 className="text-2xl font-bold">{isEdit ? "Edit recipe" : "New recipe"}</h2>

      {initial.photo_filename && (
        <img src={`/uploads/recipes/${initial.photo_filename}`} alt="Source" className="w-full max-h-48 object-contain rounded-lg border" />
      )}

      <form onSubmit={submit} className="space-y-4">
        <Field label="Title *" value={data.title ?? ""} onChange={(v) => set("title", v)} />
        <Field label="Description" value={data.description ?? ""} onChange={(v) => set("description", v)} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Prep time" value={data.prep_time ?? ""} onChange={(v) => set("prep_time", v)} placeholder="15 min" />
          <Field label="Cook time" value={data.cook_time ?? ""} onChange={(v) => set("cook_time", v)} placeholder="30 min" />
          <Field label="Servings" value={data.servings ?? ""} onChange={(v) => set("servings", v)} placeholder="4" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cuisine" value={data.cuisine ?? ""} onChange={(v) => set("cuisine", v)} placeholder="Italian" />
          <Field label="Tags (comma-separated)" value={data.tags ?? ""} onChange={(v) => set("tags", v)} placeholder="pasta, quick, vegetarian" />
        </div>

        <div className="space-y-2">
          <label className={labelCls}>Ingredients (one per line)</label>
          <textarea className={inputCls + " min-h-[120px]"} value={data.ingredients} onChange={(e) => set("ingredients", e.target.value)} rows={6} />
        </div>

        <div className="space-y-2">
          <label className={labelCls}>Instructions (one step per line)</label>
          <textarea className={inputCls + " min-h-[150px]"} value={data.instructions} onChange={(e) => set("instructions", e.target.value)} rows={8} />
        </div>

        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Save recipe"}
          </button>
          <button type="button" className={btnOutline} onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

// ─── Detail view ────────────────────────────────────────────────────────────

function DetailView({
  recipe,
  onBack,
  onEdit,
  onDelete,
}: {
  recipe: Recipe;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ingredients = parseJsonArray(recipe.ingredients);
  const instructions = parseJsonArray(recipe.instructions);
  const tags = parseJsonArray(recipe.tags);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button className={btnGhost} onClick={onBack}>← Back</button>

      {recipe.cover_filename && (
        <img src={`/uploads/recipes/${recipe.cover_filename}`} alt={recipe.title} className="w-full max-h-72 object-cover rounded-lg" />
      )}

      <div>
        <h2 className="text-3xl font-bold">{recipe.title}</h2>
        {recipe.description && <p className="text-muted-foreground mt-1">{recipe.description}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {recipe.prep_time && <Badge label="Prep" value={recipe.prep_time} />}
        {recipe.cook_time && <Badge label="Cook" value={recipe.cook_time} />}
        {recipe.servings && <Badge label="Serves" value={recipe.servings} />}
        {recipe.cuisine && <Badge label="Cuisine" value={recipe.cuisine} />}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((t, i) => (
            <span key={i} className="rounded-full bg-secondary px-3 py-1 text-xs">{t}</span>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-2">Ingredients</h3>
        <ul className="space-y-1">
          {ingredients.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="text-muted-foreground">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Instructions</h3>
        <ol className="space-y-3">
          {instructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex-none w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button className={btnOutline} onClick={onEdit}>Edit</button>
        <button
          className="inline-flex h-10 items-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          onClick={() => { if (confirm("Delete this recipe?")) onDelete(); }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Shared components ──────────────────────────────────────────────────────

function RecipeCard({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  const tags = parseJsonArray(recipe.tags);
  return (
    <div
      className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden cursor-pointer transition hover:border-foreground/30 hover:shadow-md"
      onClick={onClick}
    >
      {recipe.cover_filename ? (
        <img src={`/uploads/recipes/${recipe.cover_filename}`} alt={recipe.title} className="h-40 w-full object-cover" />
      ) : (
        <div className="h-28 bg-secondary flex items-center justify-center text-4xl">🍳</div>
      )}
      <div className="p-4 space-y-2">
        <h3 className="font-semibold leading-tight">{recipe.title}</h3>
        {recipe.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{recipe.description}</p>
        )}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {recipe.prep_time && <span>Prep: {recipe.prep_time}</span>}
          {recipe.cook_time && <span>Cook: {recipe.cook_time}</span>}
          {recipe.cuisine && <span>· {recipe.cuisine}</span>}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((t, i) => (
              <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-1.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className={labelCls}>{label}</label>
      <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function parseJsonArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val !== "string") return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return val.split("\n").filter(Boolean);
  }
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const btnPrimary = "inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
const btnOutline = "inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent";
const btnGhost = "text-sm text-muted-foreground hover:text-foreground";
const inputCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const labelCls = "text-sm font-medium leading-none";
