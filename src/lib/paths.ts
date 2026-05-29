import fs from "node:fs";
import path from "node:path";

export const rootDir = process.cwd();
export const dataDir = path.join(rootDir, "data");
export const databasePath = path.join(dataDir, "travel-cms.sqlite");
export const sessionSecretPath = path.join(dataDir, "session-secret.txt");
export const uploadsDir = path.join(rootDir, "public", "uploads");
export const originalsDir = path.join(uploadsDir, "originals");
export const thumbsDir = path.join(uploadsDir, "thumbs");
export const effectSourceDir = path.join(rootDir, "效果图");

export function ensureDirectory(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function ensureStorage() {
  ensureDirectory(dataDir);
  ensureDirectory(originalsDir);
  ensureDirectory(thumbsDir);
}

export function toPosixPath(value: string) {
  return value.split(path.sep).join("/");
}

export function fromPublicUrl(value: string) {
  return value.replace(/^\/+/, "");
}
