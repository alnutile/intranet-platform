import { useEffect, useState } from "react";
import { api, apiUpload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export default function WineTracker() {
  const [wines, setWines] = useState<Wine[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setWines(await api<Wine[]>("/api/apps/wine-tracker/wines"));
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

  async function remove(id: number) {
    await api(`/api/apps/wine-tracker/wines/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Wine Tracker</h1>
          <p className="text-muted-foreground">Your personal cellar log.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "Add wine"}
        </Button>
      </div>

      {err && <p className="text-destructive">{err}</p>}

      {showForm && (
        <WineForm
          onSaved={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}

      {wines.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No wines yet — add your first bottle.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wines.map((w) => (
            <Card key={w.id}>
              {w.photo_filename && (
                <img
                  src={`/uploads/wine-tracker/${w.photo_filename}`}
                  alt={w.name}
                  className="h-48 w-full rounded-t-lg object-cover"
                />
              )}
              <CardHeader>
                <CardTitle className="text-lg">{w.name}</CardTitle>
                <div className="text-sm text-muted-foreground">
                  {[w.winery, w.vintage, w.varietal].filter(Boolean).join(" · ")}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {w.rating && <div>{"★".repeat(w.rating)}{"☆".repeat(5 - w.rating)}</div>}
                {w.notes && <p className="text-sm">{w.notes}</p>}
                <Button size="sm" variant="outline" onClick={() => remove(w.id)}>
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function WineForm({ onSaved }: { onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      await apiUpload("/api/apps/wine-tracker/wines", form);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="winery">Winery</Label>
              <Input id="winery" name="winery" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vintage">Vintage</Label>
              <Input id="vintage" name="vintage" type="number" min="1800" max="2100" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="varietal">Varietal</Label>
              <Input id="varietal" name="varietal" placeholder="Pinot Noir…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rating">Rating (1-5)</Label>
              <Input id="rating" name="rating" type="number" min="1" max="5" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="photo">Photo</Label>
              <Input id="photo" name="photo" type="file" accept="image/*" capture="environment" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Tasting notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save wine"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
