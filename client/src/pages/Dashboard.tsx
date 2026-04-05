import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as Icons from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AppManifest {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export function DashboardPage() {
  const [apps, setApps] = useState<AppManifest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AppManifest[]>("/api/apps")
      .then(setApps)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Your apps</h1>
        <p className="text-muted-foreground">Everything you've got access to on this intranet.</p>
      </div>
      {apps.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No apps yet. Ask your admin for access, or drop a new app into <code>apps/</code>.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => {
            const Icon = (Icons as any)[app.icon || "LayoutGrid"] || Icons.LayoutGrid;
            return (
              <Link key={app.id} to={`/apps/${app.id}`}>
                <Card className="h-full transition hover:border-foreground/30 hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-secondary p-2">
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-lg">{app.name}</CardTitle>
                    </div>
                    {app.description && <CardDescription>{app.description}</CardDescription>}
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
