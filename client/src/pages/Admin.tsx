import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { Navigate } from "react-router-dom";

interface User {
  id: number;
  email: string;
  name: string;
  role: "admin" | "member";
  created_at: number;
}
interface Invite {
  token: string;
  email: string | null;
  created_at: number;
  expires_at: number;
  used_at: number | null;
}
interface AppManifest {
  id: string;
  name: string;
}

export function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [apps, setApps] = useState<AppManifest[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [newInvite, setNewInvite] = useState<Invite | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadAll() {
    const [u, i, a] = await Promise.all([
      api<User[]>("/api/users"),
      api<Invite[]>("/api/invites"),
      api<AppManifest[]>("/api/apps/all"),
    ]);
    setUsers(u);
    setInvites(i);
    setApps(a);
  }

  useEffect(() => {
    loadAll().catch((e) => setErr(e.message));
  }, []);

  if (user?.role !== "admin") return <Navigate to="/" replace />;

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const inv = await api<Invite>("/api/invites", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail || undefined }),
      });
      setNewInvite(inv);
      setInviteEmail("");
      await loadAll();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function revokeInvite(token: string) {
    await api(`/api/invites/${encodeURIComponent(token)}`, { method: "DELETE" });
    await loadAll();
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Admin</h1>
      {err && <p className="text-destructive">{err}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Invite someone</CardTitle>
          <CardDescription>Generate a one-time invite link. Optionally bind it to an email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="friend@example.com"
              />
            </div>
            <Button type="submit">Create invite</Button>
          </form>
          {newInvite && (
            <div className="mt-4 rounded-md bg-secondary p-3 text-sm">
              Share this link:
              <div className="mt-1 font-mono break-all">
                {window.location.origin}/register?invite={newInvite.token}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invites</CardTitle>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invites yet.</p>
          ) : (
            <ul className="divide-y">
              {invites.map((inv) => (
                <li key={inv.token} className="flex items-center justify-between py-2">
                  <div className="text-sm">
                    <div className="font-medium">{inv.email || "(any email)"}</div>
                    <div className="text-muted-foreground">
                      {inv.used_at
                        ? "used"
                        : inv.expires_at < Date.now() / 1000
                        ? "expired"
                        : "pending"}{" "}
                      · <span className="font-mono">{inv.token.slice(0, 10)}…</span>
                    </div>
                  </div>
                  {!inv.used_at && (
                    <Button size="sm" variant="outline" onClick={() => revokeInvite(inv.token)}>
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users & app access</CardTitle>
          <CardDescription>Pick which sub-apps each member can see. Admins see everything.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {users.map((u) => (
            <UserRow key={u.id} user={u} apps={apps} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({ user, apps }: { user: User; apps: AppManifest[] }) {
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<string[]>(`/api/users/${user.id}/access`).then((ids) => setGranted(new Set(ids)));
  }, [user.id]);

  function toggle(id: string) {
    const next = new Set(granted);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setGranted(next);
    setSaved(false);
  }

  async function save() {
    await api(`/api/users/${user.id}/access`, {
      method: "PUT",
      body: JSON.stringify({ appIds: Array.from(granted) }),
    });
    setSaved(true);
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{user.name}</div>
          <div className="text-xs text-muted-foreground">
            {user.email} · {user.role}
          </div>
        </div>
        {user.role !== "admin" && (
          <Button size="sm" onClick={save}>
            {saved ? "Saved" : "Save"}
          </Button>
        )}
      </div>
      {user.role !== "admin" && apps.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {apps.map((a) => (
            <label
              key={a.id}
              className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm cursor-pointer"
            >
              <input type="checkbox" checked={granted.has(a.id)} onChange={() => toggle(a.id)} />
              {a.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
