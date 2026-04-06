import { createRoot, Root } from "react-dom/client";
import { App } from "./App";

export interface MountContext {
  api: <T = any>(path: string, opts?: RequestInit) => Promise<T>;
  upload: <T = any>(path: string, form: FormData) => Promise<T>;
  user: { id: number; name: string; email: string; role: "admin" | "member" };
}

export default function mount(el: HTMLElement, ctx: MountContext): () => void {
  const root: Root = createRoot(el);
  root.render(<App ctx={ctx} />);
  return () => root.unmount();
}
