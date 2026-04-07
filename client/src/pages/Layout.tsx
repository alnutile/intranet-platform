import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { resolved, toggle } = useTheme();
  if (!user) return null;

  const isActive = (path: string) =>
    loc.pathname === path
      ? "text-primary font-medium"
      : "text-muted-foreground hover:text-foreground";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">I</span>
              </div>
              <span className="font-semibold text-lg tracking-tight" style={{ fontFamily: "Manrope, system-ui, sans-serif" }}>
                Intranet
              </span>
            </Link>
            <nav className="hidden sm:flex items-center gap-6 text-sm">
              <Link to="/" className={isActive("/")}>Dashboard</Link>
              {user.role === "admin" && (
                <>
                  <Link to="/admin" className={isActive("/admin")}>Users</Link>
                  <Link to="/admin/apps" className={isActive("/admin/apps")}>Plugins</Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              className="h-8 w-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
              title={`Theme: ${resolved}`}
            >
              {resolved === "dark" ? "🌙" : "☀️"}
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary text-sm font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium">{user.name}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await logout();
                nav("/login", { replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="container py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
