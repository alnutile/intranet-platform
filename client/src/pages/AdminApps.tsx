import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface InstalledApp {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  source: "bundled" | "git" | "ai";
  repo: string | null;
  ref: string | null;
  installed_at: number | null;
}

export function AdminAppsPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("");
  const [installing, setInstalling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setApps(await api<InstalledApp[]>("/api/admin/apps/installed"));
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

  if (user?.role !== "admin") return <Navigate to="/" replace />;

  async function install(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setInstalling(true);
    try {
      const r = await api<{ id: string; name: string }>("/api/admin/apps/install", {
        method: "POST",
        body: JSON.stringify({ repo, ref: ref || undefined }),
      });
      setMsg(`Installed "${r.name}". It's now live on the dashboard.`);
      setRepo("");
      setRef("");
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setInstalling(false);
    }
  }

  async function uninstall(id: string, purge: boolean) {
    if (
      !confirm(
        purge
          ? `Uninstall "${id}" AND delete all its data (DB tables + uploads)?`
          : `Uninstall "${id}"? Its data will be kept on disk.`
      )
    )
      return;
    setErr(null);
    try {
      await api("/api/admin/apps/uninstall", {
        method: "POST",
        body: JSON.stringify({ id, purge }),
      });
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function reload(id: string) {
    setErr(null);
    try {
      await api("/api/admin/apps/reload", { method: "POST", body: JSON.stringify({ id }) });
      setMsg(`Reloaded "${id}".`);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Plugins</h1>

      <Card>
        <CardHeader>
          <CardTitle>Install from GitHub</CardTitle>
          <CardDescription>
            Paste the HTTPS URL of a public repo that follows the plugin contract.
            It will be cloned, built, and mounted without a server restart.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={install} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repo">Repository URL</Label>
              <Input
                id="repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="https://github.com/you/my-plugin"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref">Branch or tag (optional)</Label>
              <Input id="ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="main" />
            </div>
            <Button type="submit" disabled={installing}>
              {installing ? "Installing…" : "Install"}
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            ⚠️ Installed plugins run server code as the platform process. Only install
            repos you trust.
          </p>
        </CardContent>
      </Card>

      {err && <p className="text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Installed</CardTitle>
        </CardHeader>
        <CardContent>
          {apps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plugins installed yet.</p>
          ) : (
            <ul className="divide-y">
              {apps.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">
                      {a.name}{" "}
                      <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                        {a.source}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.id}
                      {a.repo && (
                        <>
                          {" · "}
                          <a href={a.repo} target="_blank" rel="noreferrer" className="underline">
                            {a.repo.replace("https://github.com/", "")}
                            {a.ref ? `@${a.ref}` : ""}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => reload(a.id)}>
                      Reload
                    </Button>
                    {a.source !== "bundled" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => uninstall(a.id, false)}>
                          Uninstall
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => uninstall(a.id, true)}>
                          Uninstall + purge
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
