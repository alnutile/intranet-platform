import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as Icons from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface AppManifest {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

const ICON_COLORS: Record<string, { bg: string; fg: string }> = {
  Wine: { bg: "bg-purple-50", fg: "text-purple-600" },
  ChefHat: { bg: "bg-orange-50", fg: "text-orange-600" },
  Book: { bg: "bg-blue-50", fg: "text-blue-600" },
  Camera: { bg: "bg-pink-50", fg: "text-pink-600" },
  Music: { bg: "bg-green-50", fg: "text-green-600" },
  Dumbbell: { bg: "bg-red-50", fg: "text-red-600" },
  Plane: { bg: "bg-sky-50", fg: "text-sky-600" },
  ShoppingCart: { bg: "bg-amber-50", fg: "text-amber-600" },
};

const DEFAULT_COLOR = { bg: "bg-primary/10", fg: "text-primary" };

export function DashboardPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<AppManifest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AppManifest[]>("/api/apps")
      .then(setApps)
      .finally(() => setLoading(false));
  }, []);

  const firstName = user?.name.split(" ")[0] ?? "there";

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-surface-container rounded-lg w-64" />
        <div className="h-5 bg-surface-container rounded w-48" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-surface-container-lowest rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Editorial header — asymmetric scale */}
      <div>
        <p className="text-sm text-muted-foreground font-medium tracking-wide uppercase">
          Dashboard
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-2">
          Welcome back, {firstName}.
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's what's available on your intranet.
        </p>
      </div>

      {apps.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl font-semibold">Available Applications</h2>
            {user?.role === "admin" && (
              <Link
                to="/admin/apps"
                className="text-sm text-primary font-medium hover:underline"
              >
                Manage
              </Link>
            )}
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => {
              const iconName = app.icon || "LayoutGrid";
              const Icon = (Icons as any)[iconName] || Icons.LayoutGrid;
              const colors = ICON_COLORS[iconName] || DEFAULT_COLOR;
              return (
                <Link key={app.id} to={`/apps/${app.id}`}>
                  <div className="group rounded-2xl bg-surface-container-lowest p-6 h-full flex flex-col transition-all shadow-ambient-sm hover:shadow-ambient hover:-translate-y-0.5">
                    <div className={`h-11 w-11 rounded-xl ${colors.bg} flex items-center justify-center mb-4`}>
                      <Icon className={`h-5 w-5 ${colors.fg}`} />
                    </div>
                    <h3 className="font-display font-semibold text-base group-hover:text-primary transition-colors">
                      {app.name}
                    </h3>
                    {app.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2 flex-1">
                        {app.description}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {apps.length === 0 && (
        <div className="rounded-2xl bg-surface-container-lowest p-12 text-center shadow-ambient-sm">
          <div className="h-12 w-12 rounded-xl bg-surface-container-low flex items-center justify-center mx-auto mb-4">
            <Icons.LayoutGrid className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-display font-semibold text-lg">No applications yet</h3>
          <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
            {user?.role === "admin"
              ? "Install your first plugin from a GitHub repo, or drop an app into the apps/ directory."
              : "Ask your admin for access to an application."}
          </p>
          {user?.role === "admin" && (
            <Link
              to="/admin/apps"
              className="inline-flex h-10 items-center rounded-lg gradient-primary px-5 text-sm font-medium text-primary-foreground shadow-ambient-sm hover:shadow-ambient transition-shadow mt-6"
            >
              Install a plugin
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
