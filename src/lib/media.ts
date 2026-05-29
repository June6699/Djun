import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { effectSourceDir, ensureDirectory, ensureStorage, originalsDir, thumbsDir, toPosixPath } from "./paths";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

const DEMO_ASSETS = [
  "bromo",
  "ijen",
  "uluwatu",
  "ubud",
  "nusa-penida",
  "seminyak",
  "singapore"
];

export type ScannedFile = {
  absolutePath: string;
  relativePath: string;
  publicPath: string;
  thumbPath: string;
  width: number;
  height: number;
  mimeType: string;
  sourceFolder: string;
  signature: string;
};

function isImageFile(filePath: string) {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function publicOriginalPath(relativePath: string) {
  return `/uploads/originals/${toPosixPath(relativePath)}`;
}

function publicThumbPath(relativePath: string) {
  const parsed = path.parse(relativePath);
  const normalizedDir = parsed.dir ? `${toPosixPath(parsed.dir)}/` : "";
  return `/uploads/thumbs/${normalizedDir}${parsed.name}.webp`;
}

function absoluteThumbPath(relativePath: string) {
  const parsed = path.parse(relativePath);
  const dir = parsed.dir ? path.join(thumbsDir, parsed.dir) : thumbsDir;
  return path.join(dir, `${parsed.name}.webp`);
}

function mimeForExtension(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".avif") return "image/avif";
  return "image/jpeg";
}

function listImages(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listImages(absolutePath);
    }
    return entry.isFile() && isImageFile(absolutePath) ? [absolutePath] : [];
  });
}

async function ensureThumbnail(absolutePath: string, relativePath: string) {
  const thumbPath = absoluteThumbPath(relativePath);
  ensureDirectory(path.dirname(thumbPath));

  const sourceStat = fs.statSync(absolutePath);
  const shouldGenerate =
    !fs.existsSync(thumbPath) || fs.statSync(thumbPath).mtimeMs < sourceStat.mtimeMs;

  if (shouldGenerate) {
    await sharp(absolutePath)
      .rotate()
      .resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(thumbPath);
  }
}

async function readMetadata(absolutePath: string, relativePath: string): Promise<ScannedFile> {
  const metadata = await sharp(absolutePath).metadata();
  await ensureThumbnail(absolutePath, relativePath);

  const stat = fs.statSync(absolutePath);
  const signature = crypto
    .createHash("sha1")
    .update(`${relativePath}:${stat.size}:${stat.mtimeMs}`)
    .digest("hex");

  return {
    absolutePath,
    relativePath: toPosixPath(relativePath),
    publicPath: publicOriginalPath(relativePath),
    thumbPath: publicThumbPath(relativePath),
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    mimeType: metadata.format ? `image/${metadata.format}` : mimeForExtension(absolutePath),
    sourceFolder: toPosixPath(path.dirname(relativePath)) === "." ? "" : toPosixPath(path.dirname(relativePath)),
    signature
  };
}

export async function scanOriginalFiles() {
  ensureStorage();
  const files = listImages(originalsDir).sort((a, b) => a.localeCompare(b, "en"));
  return Promise.all(
    files.map((absolutePath) => {
      const relativePath = path.relative(originalsDir, absolutePath);
      return readMetadata(absolutePath, relativePath);
    })
  );
}

function safeName(name: string) {
  const parsed = path.parse(name);
  const base = parsed.name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const ext = parsed.ext.toLowerCase();
  return `${base || "photo"}${IMAGE_EXTENSIONS.has(ext) ? ext : ".jpg"}`;
}

export async function saveUploadedFiles(files: File[]) {
  ensureStorage();
  const saved: string[] = [];

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      continue;
    }

    const safe = safeName(file.name);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const targetName = `${stamp}-${crypto.randomBytes(3).toString("hex")}-${safe}`;
    const target = path.join(originalsDir, targetName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.promises.writeFile(target, buffer);
    saved.push(targetName);
  }

  return saved;
}

export async function ensureDemoAssets() {
  ensureStorage();

  if (listImages(originalsDir).length > 0 || !fs.existsSync(effectSourceDir)) {
    return false;
  }

  const sourceFiles = listImages(effectSourceDir)
    .filter((file) => !path.basename(file).includes("副本"))
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

  if (sourceFiles.length === 0) {
    return false;
  }

  const chapterSources = DEMO_ASSETS.map((slug, index) => {
    const sourceIndex = Math.min(index + 1, sourceFiles.length - 1);
    return { slug, source: sourceFiles[sourceIndex] ?? sourceFiles[0] };
  });

  for (let index = 0; index < chapterSources.length; index += 1) {
    const { slug, source } = chapterSources[index];
    const target = path.join(originalsDir, `${String(index + 1).padStart(2, "0")}-${slug}.jpg`);
    const metadata = await sharp(source).metadata();
    const width = metadata.width ?? 1264;
    const height = metadata.height ?? 2780;
    const left = Math.min(Math.floor(width * 0.49), width - 320);
    const top = Math.min(Math.floor(height * 0.32), height - 480);
    const cropWidth = width - left;
    const cropHeight = Math.min(Math.floor(height * 0.31), height - top);

    try {
      await sharp(source)
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .resize({ width: 1500, height: 980, fit: "cover" })
        .jpeg({ quality: 88, mozjpeg: true })
        .toFile(target);
    } catch {
      await sharp(source)
        .resize({ width: 1500, height: 980, fit: "cover" })
        .jpeg({ quality: 88, mozjpeg: true })
        .toFile(target);
    }
  }

  return true;
}

export function getDemoSlugs() {
  return DEMO_ASSETS;
}
