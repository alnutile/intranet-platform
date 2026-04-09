import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { api, apiUpload } from "@/lib/api";

/**
 * Mounts a plugin into a managed DOM subtree.
 *
 * Each plugin is a self-contained bundle with its own React copy. We don't
 * render its components as JSX — we give it an element and let it own the
 * tree via its default-exported `mount(el, ctx)` function. This avoids the
 * "two copies of React" hook-dispatcher problem and lets plugins bundle
 * anything they want without conflict.
 */
export function AppHost() {
  const { appId } = useParams<{ appId: string }>();
  const { user } = useAuth();
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appId || !user || !hostRef.current) return;
    let unmount: (() => void) | undefined;
    let disposed = false;
    setError(null);

    const el = hostRef.current;
    el.innerHTML = ""; // clean slate on route change

    // Plugin-scoped API helpers — these prefix /api/apps/<appId> so plugin
    // code can just call `ctx.api("/wines")` without thinking about paths.
    const pluginApi = <T,>(path: string, opts?: RequestInit) =>
      api<T>(`/api/apps/${appId}${path}`, opts);
    const pluginUpload = <T,>(path: string, form: FormData) =>
      apiUpload<T>(`/api/apps/${appId}${path}`, form);

    // Cache-bust so a fresh install / reload picks up the new bundle.
    const url = `/plugin-assets/${appId}/index.js?t=${Date.now()}`;

    import(/* @vite-ignore */ url)
      .then((mod) => {
        if (disposed) return;
        const pluginMount = mod.default;
        if (typeof pluginMount !== "function") {
          throw new Error("plugin did not default-export a mount function");
        }
        unmount = pluginMount(el, {
          api: pluginApi,
          upload: pluginUpload,
          user,
        });
      })
      .catch((e) => {
        if (!disposed) setError(e.message || "failed to load plugin");
      });

    return () => {
      disposed = true;
      try {
        unmount?.();
      } catch {}
      el.innerHTML = "";
    };
  }, [appId, user]);

  return (
    <div className="space-y-4">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
      </div>
      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-destructive dark:bg-red-950/20">
          {error}
        </div>
      )}
      <div ref={hostRef} />
    </div>
  );
}
