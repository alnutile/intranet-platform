import { createRoot, Root } from "react-dom/client";
import { App } from "./App";

/**
 * Context passed to every plugin at mount time.
 *
 * - `api(path, opts)` — fetch helper that prefixes /api/apps/<this-plugin-id>/
 *   and handles JSON + credentials. Use this for anything on the platform DB.
 * - `upload(path, formData)` — same prefix, for multipart uploads.
 * - `user` — the current logged-in user (id, name, email, role).
 *
 * Plugins that hit a third-party backend (Supabase, a public REST API, etc.)
 * can ignore `api` and `upload` entirely and use fetch / a third-party SDK
 * directly.
 */
export interface MountContext {
  api: <T = any>(path: string, opts?: RequestInit) => Promise<T>;
  upload: <T = any>(path: string, form: FormData) => Promise<T>;
  user: { id: number; name: string; email: string; role: "admin" | "member" };
}

/**
 * Every plugin's default export. The host hands you a DOM element and a
 * context; you render your app inside the element and return an unmount
 * function that the host calls when the user navigates away.
 */
export default function mount(el: HTMLElement, ctx: MountContext): () => void {
  const root: Root = createRoot(el);
  root.render(<App ctx={ctx} />);
  return () => root.unmount();
}
