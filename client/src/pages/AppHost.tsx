import { Suspense, lazy, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * Dynamically import a sub-app's React entry. Vite's import.meta.glob
 * statically collects every candidate at build time, so new apps only
 * need to follow the path convention: apps/<id>/client/index.tsx.
 */
const appModules = import.meta.glob("../../../apps/*/client/index.tsx");

export function AppHost() {
  const { appId } = useParams<{ appId: string }>();

  const Component = useMemo(() => {
    const key = Object.keys(appModules).find((k) => k.includes(`/apps/${appId}/client/index.tsx`));
    if (!key) return null;
    return lazy(appModules[key] as any);
  }, [appId]);

  if (!Component) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">Unknown app: {appId}</p>
        <Button asChild variant="outline">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Loading app…</p>}>
        <Component />
      </Suspense>
    </div>
  );
}
