import { useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { resolved, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!user) return null;

  const isActive = (path: string) =>
    loc.pathname === path
      ? "text-primary font-medium"
      : "text-muted-foreground hover:text-foreground transition-colors";

  const mobileLink = (path: string, label: string) => (
    <Link
      to={path}
      className={`block py-2 text-base ${isActive(path)}`}
      onClick={() => setMobileOpen(false)}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Glassmorphic header — no border-b, tonal separation via backdrop */}
      <header className="sticky top-0 z-50 bg-surface/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-ambient-sm">
                <span className="text-primary-foreground font-bold text-sm">I</span>
              </div>
              <span className="font-display font-semibold text-lg tracking-tight">
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
              className="h-8 w-8 rounded-lg bg-surface-container-low flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title={`Theme: ${resolved}`}
            >
              {resolved === "dark" ? "🌙" : "☀️"}
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary-container flex items-center justify-center">
                <span className="text-primary text-sm font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium">{user.name}</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="hidden sm:inline-flex"
              onClick={async () => {
                await logout();
                nav("/login", { replace: true });
              }}
            >
              Sign out
            </Button>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="sm:hidden h-8 w-8 rounded-lg bg-surface-container-low flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileOpen && (
          <div className="sm:hidden bg-surface/95 backdrop-blur-xl px-6 pb-5 pt-2 space-y-1">
            {mobileLink("/", "Dashboard")}
            {user.role === "admin" && (
              <>
                {mobileLink("/admin", "Users")}
                {mobileLink("/admin/apps", "Plugins")}
              </>
            )}
            <div className="flex items-center gap-2 pt-3">
              <div className="h-8 w-8 rounded-full bg-primary-container flex items-center justify-center">
                <span className="text-primary text-sm font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium">{user.name}</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="w-full mt-2"
              onClick={async () => {
                setMobileOpen(false);
                await logout();
                nav("/login", { replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        )}
      </header>
      <main className="flex-1 bg-surface-container-low">
        <div className="container py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
