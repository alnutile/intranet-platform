import fs from "fs";
import path from "path";

/**
 * Build a plugin's client bundle to ESM, so the host can dynamic-import it
 * at runtime. Uses Vite programmatically in library mode.
 *
 * Each plugin exports a `mount(el, ctx)` function from its client entry:
 *
 *   export default function mount(el: HTMLElement, ctx: MountContext) {
 *     const root = createRoot(el);
 *     root.render(<App ctx={ctx} />);
 *     return () => root.unmount();  // called when the route unmounts
 *   }
 *
 * This "host gives the plugin a div, plugin owns it" model is how we avoid
 * the "multiple copies of React" hook-dispatcher problem — each plugin has
 * its own self-contained React instance, and the host never renders the
 * plugin's JSX directly.
 */

export interface BuildResult {
  entryFile: string; // path to the built index.js, relative to the plugin dir
  outDir: string;
}

/**
 * Build the plugin's client to `<pluginDir>/client/dist/index.js`.
 * Idempotent: if the source file is older than the built file, we skip.
 */
export async function buildPluginClient(pluginDir: string): Promise<BuildResult | null> {
  const srcEntry = findClientEntry(pluginDir);
  if (!srcEntry) return null; // client-only plugins without source (e.g. BYO backend with static HTML) can still ship a pre-built dist/

  const outDir = path.join(pluginDir, "client", "dist");
  const outFile = path.join(outDir, "index.js");

  if (isUpToDate(srcEntry, outFile)) {
    return { entryFile: "client/dist/index.js", outDir };
  }

  // Dynamic import so Vite is only loaded when we actually need to build.
  const vite = await import("vite");
  const react = (await import("@vitejs/plugin-react")).default;

  await vite.build({
    root: path.join(pluginDir, "client"),
    logLevel: "warn",
    configFile: false,
    plugins: [react()],
    build: {
      outDir: "dist",
      emptyOutDir: true,
      lib: {
        entry: srcEntry,
        formats: ["es"],
        fileName: () => "index.js",
      },
      rollupOptions: {
        // React is bundled into each plugin. Duplicated bytes across plugins
        // are the cost of isolation; for personal intranet use this is fine.
        external: [],
      },
      minify: "esbuild",
    },
  });

  return { entryFile: "client/dist/index.js", outDir };
}

function findClientEntry(pluginDir: string): string | null {
  const candidates = [
    "client/src/main.tsx",
    "client/src/main.ts",
    "client/src/index.tsx",
    "client/src/index.ts",
    "client/index.tsx",
    "client/index.ts",
  ];
  for (const c of candidates) {
    const p = path.join(pluginDir, c);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function isUpToDate(srcEntry: string, outFile: string): boolean {
  if (!fs.existsSync(outFile)) return false;
  const outMtime = fs.statSync(outFile).mtimeMs;
  // Walk the source tree rooted at srcEntry's directory and bail if anything
  // is newer than the built file.
  const root = path.dirname(srcEntry);
  return walkIsOlder(root, outMtime);
}

function walkIsOlder(dir: string, ref: number): boolean {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === "dist" || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!walkIsOlder(p, ref)) return false;
    } else if (fs.statSync(p).mtimeMs > ref) {
      return false;
    }
  }
  return true;
}

/** Build every plugin in apps/ that needs it. Called at server startup. */
export async function buildAllPlugins(appsDir: string): Promise<void> {
  if (!fs.existsSync(appsDir)) return;
  const dirs = fs
    .readdirSync(appsDir)
    .filter((d) => !d.startsWith(".") && !d.startsWith("_"))
    .map((d) => path.join(appsDir, d))
    .filter((p) => fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, "manifest.json")));
  for (const d of dirs) {
    try {
      const r = await buildPluginClient(d);
      if (r) console.log(`[plugin-build] built ${path.basename(d)}`);
    } catch (err) {
      console.error(`[plugin-build] failed for ${path.basename(d)}:`, err);
    }
  }
}
