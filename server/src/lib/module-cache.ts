import path from "path";

/**
 * Clear every entry in require.cache whose resolved filename lives inside
 * `dir`. This is how we let a plugin's server code be reloaded at runtime
 * after its files change on disk — next `require()` will re-read from disk.
 *
 * CRITICAL: only pass paths inside `apps/<id>/`. Never clear shared modules
 * like `server/src/db` — platform singletons (the SQLite connection,
 * cached prepared statements, etc.) live there.
 */
export function clearRequireCacheUnder(dir: string) {
  const abs = path.resolve(dir) + path.sep;
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(abs)) {
      delete require.cache[key];
    }
  }
}
