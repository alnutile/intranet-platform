import { useState } from "react";
import { Navigate, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function RegisterPage() {
  const { user, register, bootstrapped, registrationLocked } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteToken, setInviteToken] = useState(params.get("invite") ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  // First user ever → admin bootstrap flow. After that, must have an invite token.
  const isBootstrap = !bootstrapped;
  const canRegister = isBootstrap || !registrationLocked || !!inviteToken;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await register({ email, name, password, inviteToken: inviteToken || undefined });
      nav("/", { replace: true });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isBootstrap ? "Set up your intranet" : "Accept your invite"}</CardTitle>
          <CardDescription>
            {isBootstrap
              ? "You're the first here — this account becomes the admin and public registration will be locked."
              : "Enter the details from your invite to join."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {!isBootstrap && (
              <div className="space-y-2">
                <Label htmlFor="invite">Invite token</Label>
                <Input id="invite" value={inviteToken} onChange={(e) => setInviteToken(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (min 8 chars)</Label>
              <Input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" disabled={busy || !canRegister} className="w-full">
              {busy ? "Creating…" : isBootstrap ? "Create admin account" : "Create account"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Already have an account? <Link className="underline" to="/login">Sign in</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
