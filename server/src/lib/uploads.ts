import path from "path";
import fs from "fs";
import multer from "multer";
import crypto from "crypto";

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "storage/uploads");
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

/**
 * Build a multer instance scoped to a sub-app. Files land in
 * storage/uploads/<appId>/ with a random filename; the original name
 * and mimetype are preserved on the Multer file object so the sub-app
 * can save them into its own DB row.
 */
export function appUploader(appId: string, opts: { maxBytes?: number } = {}) {
  const dir = path.join(UPLOAD_ROOT, appId);
  fs.mkdirSync(dir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      cb(null, crypto.randomBytes(16).toString("hex") + ext);
    },
  });
  return multer({
    storage,
    limits: { fileSize: opts.maxBytes ?? 10 * 1024 * 1024 },
  });
}

export { UPLOAD_ROOT };
