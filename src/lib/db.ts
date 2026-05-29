import "server-only";

import crypto from "node:crypto";
import Database from "better-sqlite3";
import { createPasswordHash, verifyPassword } from "./auth";
import { ensureDemoAssets, getDemoSlugs, scanOriginalFiles, type ScannedFile } from "./media";
import { databasePath, ensureStorage } from "./paths";
import type { AdminUser, Chapter, LibraryState, Photo, Project, ScanResult } from "@/types/cms";

type Db = Database.Database;

type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  theme: string;
  autoplay_seconds: number;
  photo_seconds: number;
  updated_at: string;
};

type ChapterRow = {
  id: string;
  project_id: string;
  order_index: number;
  chapter_no: number;
  slug: string;
  title_en: string;
  title_zh: string;
  location: string;
  date_label: string;
  short_copy: string;
  quote: string;
  theme_color: string;
  accent_color: string;
  background_tone: string;
  hero_image_id: string | null;
  auto_seconds: number;
  is_published: number;
  updated_at: string;
};

type PhotoRow = {
  id: string;
  project_id: string;
  chapter_id: string | null;
  order_index: number;
  title: string;
  caption: string;
  location: string;
  captured_at: string;
  source_folder: string;
  original_path: string;
  thumb_path: string;
  width: number;
  height: number;
  mime_type: string;
  signature: string;
  is_cover: number;
  is_visible: number;
  is_missing: number;
  created_at: string;
  updated_at: string;
};

type AdminRow = {
  id: string;
  username: string;
  password_salt: string;
  password_hash: string;
};

const globalForDb = globalThis as unknown as {
  djunDatabase?: Db;
  djunBootstrapped?: boolean;
};

const defaultChapters = [
  {
    chapterNo: 1,
    slug: "bromo",
    titleEn: "BROMO",
    titleZh: "布罗莫",
    location: "East Java",
    dateLabel: "04.29",
    shortCopy: "surabaya · crater · viewpoint",
    quote: "The volcano was breathing. We stood on its shoulder while the sky turned from coal to apricot.",
    themeColor: "#cf4938",
    accentColor: "#f3c65e",
    backgroundTone: "#ce4637"
  },
  {
    chapterNo: 2,
    slug: "ijen",
    titleEn: "IJEN",
    titleZh: "伊真",
    location: "East Java",
    dateLabel: "04.27",
    shortCopy: "blue fire · sulfur · lake",
    quote: "A blue flame under a black sky, and a lake that looked like it remembered every storm.",
    themeColor: "#183f4c",
    accentColor: "#56bad2",
    backgroundTone: "#d9d4c2"
  },
  {
    chapterNo: 3,
    slug: "uluwatu",
    titleEn: "ULUWATU",
    titleZh: "乌鲁瓦图",
    location: "Bali",
    dateLabel: "04.28",
    shortCopy: "cliff temples & black sand",
    quote: "Ocean wrote sermons into the cliff face, and the cliff face listened.",
    themeColor: "#124149",
    accentColor: "#2d8393",
    backgroundTone: "#e1d9c6"
  },
  {
    chapterNo: 4,
    slug: "ubud",
    titleEn: "UBUD",
    titleZh: "乌布",
    location: "Bali",
    dateLabel: "04.30",
    shortCopy: "rice terraces · rain · quiet",
    quote: "The green went on speaking even after the rain stopped.",
    themeColor: "#273f25",
    accentColor: "#9bb45a",
    backgroundTone: "#d8cfac"
  },
  {
    chapterNo: 5,
    slug: "nusa-penida",
    titleEn: "NUSA PENIDA",
    titleZh: "努沙佩尼达",
    location: "Penida",
    dateLabel: "05.01",
    shortCopy: "limestone cliffs & turquoise",
    quote: "Down five hundred steps cut into rock, the water was so clear it looked fake.",
    themeColor: "#c09d69",
    accentColor: "#277d8c",
    backgroundTone: "#c19f69"
  },
  {
    chapterNo: 6,
    slug: "seminyak",
    titleEn: "SEMINYAK",
    titleZh: "水明漾",
    location: "Bali",
    dateLabel: "05.02",
    shortCopy: "street heat · sunset · neon",
    quote: "The last beach day had a soft focus, like the city had turned into a postcard.",
    themeColor: "#4b3a5f",
    accentColor: "#f1778f",
    backgroundTone: "#efe4d0"
  },
  {
    chapterNo: 7,
    slug: "singapore",
    titleEn: "SINGAPORE",
    titleZh: "新加坡",
    location: "Transit",
    dateLabel: "05.04",
    shortCopy: "changi · marina bay · the way home",
    quote: "The city was a shipping container turned inside out and dressed for a wedding.",
    themeColor: "#101827",
    accentColor: "#ff5b7c",
    backgroundTone: "#101827"
  }
];

function id(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

function getDatabase() {
  if (globalForDb.djunDatabase) {
    return globalForDb.djunDatabase;
  }

  ensureStorage();
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seedStaticData(db);

  globalForDb.djunDatabase = db;
  return db;
}

function migrate(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      theme TEXT NOT NULL DEFAULT 'film-journal',
      autoplay_seconds INTEGER NOT NULL DEFAULT 28,
      photo_seconds INTEGER NOT NULL DEFAULT 5,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL,
      chapter_no INTEGER NOT NULL,
      slug TEXT NOT NULL,
      title_en TEXT NOT NULL,
      title_zh TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      date_label TEXT NOT NULL DEFAULT '',
      short_copy TEXT NOT NULL DEFAULT '',
      quote TEXT NOT NULL DEFAULT '',
      theme_color TEXT NOT NULL DEFAULT '#d04738',
      accent_color TEXT NOT NULL DEFAULT '#f3c65e',
      background_tone TEXT NOT NULL DEFAULT '#d9d0bc',
      hero_image_id TEXT,
      auto_seconds INTEGER NOT NULL DEFAULT 28,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, slug)
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      captured_at TEXT NOT NULL DEFAULT '',
      source_folder TEXT NOT NULL DEFAULT '',
      original_path TEXT UNIQUE NOT NULL,
      thumb_path TEXT NOT NULL,
      width INTEGER NOT NULL DEFAULT 0,
      height INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
      signature TEXT NOT NULL DEFAULT '',
      is_cover INTEGER NOT NULL DEFAULT 0,
      is_visible INTEGER NOT NULL DEFAULT 1,
      is_missing INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id, order_index);
    CREATE INDEX IF NOT EXISTS idx_photos_project ON photos(project_id, chapter_id, order_index);
  `);
}

function seedStaticData(db: Db) {
  const timestamp = now();
  const project = db.prepare("SELECT id FROM projects WHERE slug = ?").get("bali-2026") as { id: string } | undefined;
  const projectId = project?.id ?? "project_bali_2026";

  if (!project) {
    db.prepare(
      `INSERT INTO projects
        (id, slug, title, subtitle, description, theme, autoplay_seconds, photo_seconds, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      projectId,
      "bali-2026",
      "BALI 2026",
      "TRAVEL JOURNAL",
      "A local film-style travel journal with chapter playback and curated contact sheets.",
      "film-journal",
      28,
      5,
      1,
      timestamp,
      timestamp
    );
  }

  const chapterCount = db.prepare("SELECT COUNT(*) AS count FROM chapters WHERE project_id = ?").get(projectId) as { count: number };
  if (chapterCount.count === 0) {
    const insertChapter = db.prepare(
      `INSERT INTO chapters
        (id, project_id, order_index, chapter_no, slug, title_en, title_zh, location, date_label, short_copy, quote,
         theme_color, accent_color, background_tone, auto_seconds, is_published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const [index, chapter] of defaultChapters.entries()) {
      insertChapter.run(
        `chapter_${chapter.slug.replaceAll("-", "_")}`,
        projectId,
        index,
        chapter.chapterNo,
        chapter.slug,
        chapter.titleEn,
        chapter.titleZh,
        chapter.location,
        chapter.dateLabel,
        chapter.shortCopy,
        chapter.quote,
        chapter.themeColor,
        chapter.accentColor,
        chapter.backgroundTone,
        28,
        1,
        timestamp,
        timestamp
      );
    }
  }

  const adminCount = db.prepare("SELECT COUNT(*) AS count FROM admin_users").get() as { count: number };
  if (adminCount.count === 0) {
    const username = process.env.DJUN_ADMIN_USERNAME || "admin";
    const password = process.env.DJUN_ADMIN_PASSWORD || "admin123";
    const { salt, hash } = createPasswordHash(password);
    db.prepare(
      "INSERT INTO admin_users (id, username, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(id("admin"), username, salt, hash, timestamp);
  }
}

async function ensureAppReady(forceScan = false) {
  const db = getDatabase();
  const photoCount = db.prepare("SELECT COUNT(*) AS count FROM photos").get() as { count: number };

  if (!globalForDb.djunBootstrapped || forceScan) {
    if (photoCount.count === 0) {
      await ensureDemoAssets();
    }
    await syncMediaLibrary();
    globalForDb.djunBootstrapped = true;
  }

  return db;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    theme: row.theme,
    autoplaySeconds: row.autoplay_seconds,
    photoSeconds: row.photo_seconds,
    updatedAt: row.updated_at
  };
}

function rowToChapter(row: ChapterRow): Chapter {
  return {
    id: row.id,
    projectId: row.project_id,
    orderIndex: row.order_index,
    chapterNo: row.chapter_no,
    slug: row.slug,
    titleEn: row.title_en,
    titleZh: row.title_zh,
    location: row.location,
    dateLabel: row.date_label,
    shortCopy: row.short_copy,
    quote: row.quote,
    themeColor: row.theme_color,
    accentColor: row.accent_color,
    backgroundTone: row.background_tone,
    heroImageId: row.hero_image_id,
    autoSeconds: row.auto_seconds,
    isPublished: Boolean(row.is_published),
    updatedAt: row.updated_at
  };
}

function rowToPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    projectId: row.project_id,
    chapterId: row.chapter_id,
    orderIndex: row.order_index,
    title: row.title,
    caption: row.caption,
    location: row.location,
    capturedAt: row.captured_at,
    sourceFolder: row.source_folder,
    originalPath: row.original_path,
    thumbPath: row.thumb_path,
    width: row.width,
    height: row.height,
    mimeType: row.mime_type,
    isCover: Boolean(row.is_cover),
    isVisible: Boolean(row.is_visible),
    isMissing: Boolean(row.is_missing),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function activeProject(db: Db) {
  return db.prepare("SELECT * FROM projects WHERE is_active = 1 ORDER BY created_at LIMIT 1").get() as ProjectRow;
}

function chapterForFile(db: Db, relativePath: string, projectId: string) {
  const normalized = relativePath.toLowerCase();
  const rows = db
    .prepare("SELECT id, slug FROM chapters WHERE project_id = ? ORDER BY order_index")
    .all(projectId) as { id: string; slug: string }[];

  return rows.find((chapter) => normalized.includes(chapter.slug))?.id ?? null;
}

function nextPhotoOrder(db: Db, projectId: string, chapterId: string | null) {
  const row = db
    .prepare(
      chapterId
        ? "SELECT COALESCE(MAX(order_index), -1) + 1 AS value FROM photos WHERE project_id = ? AND chapter_id = ?"
        : "SELECT COALESCE(MAX(order_index), -1) + 1 AS value FROM photos WHERE project_id = ? AND chapter_id IS NULL"
    )
    .get(...(chapterId ? [projectId, chapterId] : [projectId])) as { value: number };

  return row.value;
}

function updateChapterHeroImages(db: Db, projectId: string) {
  const chapters = db
    .prepare("SELECT id, hero_image_id FROM chapters WHERE project_id = ?")
    .all(projectId) as { id: string; hero_image_id: string | null }[];

  for (const chapter of chapters) {
    const heroExists = chapter.hero_image_id
      ? (db.prepare("SELECT id FROM photos WHERE id = ? AND is_missing = 0").get(chapter.hero_image_id) as { id: string } | undefined)
      : null;

    if (!heroExists) {
      const firstPhoto = db
        .prepare(
          "SELECT id FROM photos WHERE chapter_id = ? AND is_visible = 1 AND is_missing = 0 ORDER BY is_cover DESC, order_index ASC LIMIT 1"
        )
        .get(chapter.id) as { id: string } | undefined;

      if (firstPhoto) {
        db.prepare("UPDATE chapters SET hero_image_id = ?, updated_at = ? WHERE id = ?").run(firstPhoto.id, now(), chapter.id);
      }
    }
  }
}

function defaultPhotoTitle(relativePath: string) {
  return relativePath
    .split("/")
    .pop()!
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+[-_]/, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function insertOrUpdatePhoto(db: Db, file: ScannedFile, projectId: string) {
  const existing = db.prepare("SELECT id, signature FROM photos WHERE original_path = ?").get(file.publicPath) as
    | { id: string; signature: string }
    | undefined;

  const timestamp = now();
  if (existing) {
    db.prepare(
      `UPDATE photos
       SET thumb_path = ?, width = ?, height = ?, mime_type = ?, signature = ?, is_missing = 0, updated_at = ?
       WHERE id = ?`
    ).run(file.thumbPath, file.width, file.height, file.mimeType, file.signature, timestamp, existing.id);
    return file.signature === existing.signature ? "same" : "updated";
  }

  const chapterId = chapterForFile(db, file.relativePath, projectId);
  const orderIndex = nextPhotoOrder(db, projectId, chapterId);
  const photoId = id("photo");
  db.prepare(
    `INSERT INTO photos
      (id, project_id, chapter_id, order_index, title, caption, location, captured_at, source_folder,
       original_path, thumb_path, width, height, mime_type, signature, is_cover, is_visible, is_missing, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    photoId,
    projectId,
    chapterId,
    orderIndex,
    defaultPhotoTitle(file.relativePath),
    "",
    "",
    "",
    file.sourceFolder,
    file.publicPath,
    file.thumbPath,
    file.width,
    file.height,
    file.mimeType,
    file.signature,
    0,
    1,
    0,
    timestamp,
    timestamp
  );

  return "imported";
}

export async function syncMediaLibrary(): Promise<ScanResult> {
  const db = getDatabase();
  const project = activeProject(db);
  const files = await scanOriginalFiles();
  const seen = new Set(files.map((file) => file.publicPath));
  let imported = 0;
  let updated = 0;

  const transaction = db.transaction((scanned: ScannedFile[]) => {
    for (const file of scanned) {
      const result = insertOrUpdatePhoto(db, file, project.id);
      if (result === "imported") imported += 1;
      if (result === "updated") updated += 1;
    }

    const rows = db.prepare("SELECT id, original_path FROM photos WHERE project_id = ?").all(project.id) as {
      id: string;
      original_path: string;
    }[];

    let missing = 0;
    for (const row of rows) {
      if (!seen.has(row.original_path)) {
        db.prepare("UPDATE photos SET is_missing = 1, updated_at = ? WHERE id = ?").run(now(), row.id);
        missing += 1;
      }
    }

    updateChapterHeroImages(db, project.id);
    return missing;
  });

  const missing = transaction(files);

  return {
    imported,
    updated,
    missing,
    total: files.length
  };
}

export async function getLibraryState(includeDrafts = false): Promise<LibraryState> {
  const db = await ensureAppReady();
  const project = rowToProject(activeProject(db));
  const chapterSql = includeDrafts
    ? "SELECT * FROM chapters WHERE project_id = ? ORDER BY order_index ASC"
    : "SELECT * FROM chapters WHERE project_id = ? AND is_published = 1 ORDER BY order_index ASC";
  const photoSql = includeDrafts
    ? "SELECT * FROM photos WHERE project_id = ? ORDER BY chapter_id IS NULL, chapter_id, order_index ASC, created_at ASC"
    : "SELECT * FROM photos WHERE project_id = ? AND is_visible = 1 AND is_missing = 0 ORDER BY chapter_id IS NULL, chapter_id, order_index ASC, created_at ASC";

  return {
    project,
    chapters: (db.prepare(chapterSql).all(project.id) as ChapterRow[]).map(rowToChapter),
    photos: (db.prepare(photoSql).all(project.id) as PhotoRow[]).map(rowToPhoto)
  };
}

export async function forceRescanLibrary() {
  await ensureAppReady(true);
  return syncMediaLibrary();
}

export function findAdminByUsername(username: string) {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM admin_users WHERE username = ?").get(username) as AdminRow | undefined;
  return row ?? null;
}

export function findAdminById(userId: string): AdminUser | null {
  const db = getDatabase();
  const row = db.prepare("SELECT id, username FROM admin_users WHERE id = ?").get(userId) as AdminUser | undefined;
  return row ?? null;
}

export function authenticateAdmin(username: string, password: string): AdminUser | null {
  const row = findAdminByUsername(username);
  if (!row || !verifyPassword(password, row.password_salt, row.password_hash)) {
    return null;
  }
  return { id: row.id, username: row.username };
}

export async function requireAdminUser() {
  const { readSessionUserId } = await import("./auth");
  const userId = await readSessionUserId();
  return userId ? findAdminById(userId) : null;
}

export async function updateProject(input: Partial<Project>) {
  const db = await ensureAppReady();
  const project = activeProject(db);
  db.prepare(
    `UPDATE projects
     SET title = ?, subtitle = ?, description = ?, autoplay_seconds = ?, photo_seconds = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    input.title ?? project.title,
    input.subtitle ?? project.subtitle,
    input.description ?? project.description,
    Number(input.autoplaySeconds ?? project.autoplay_seconds),
    Number(input.photoSeconds ?? project.photo_seconds),
    now(),
    project.id
  );
  return getLibraryState(true);
}

export async function createChapter(input: Partial<Chapter>) {
  const db = await ensureAppReady();
  const project = activeProject(db);
  const row = db
    .prepare("SELECT COALESCE(MAX(order_index), -1) + 1 AS orderIndex, COALESCE(MAX(chapter_no), 0) + 1 AS chapterNo FROM chapters WHERE project_id = ?")
    .get(project.id) as { orderIndex: number; chapterNo: number };
  const timestamp = now();
  const slug =
    input.slug?.trim().toLowerCase().replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") ||
    `chapter-${row.chapterNo}`;

  db.prepare(
    `INSERT INTO chapters
      (id, project_id, order_index, chapter_no, slug, title_en, title_zh, location, date_label, short_copy, quote,
       theme_color, accent_color, background_tone, auto_seconds, is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id("chapter"),
    project.id,
    row.orderIndex,
    row.chapterNo,
    slug,
    input.titleEn?.trim() || `CHAPTER ${String(row.chapterNo).padStart(2, "0")}`,
    input.titleZh?.trim() || "",
    input.location?.trim() || "",
    input.dateLabel?.trim() || "",
    input.shortCopy?.trim() || "",
    input.quote?.trim() || "",
    input.themeColor || "#d04738",
    input.accentColor || "#f3c65e",
    input.backgroundTone || "#d9d0bc",
    Number(input.autoSeconds || project.autoplay_seconds),
    input.isPublished === false ? 0 : 1,
    timestamp,
    timestamp
  );

  return getLibraryState(true);
}

export async function updateChapter(chapterId: string, input: Partial<Chapter>) {
  const db = await ensureAppReady();
  const existing = db.prepare("SELECT * FROM chapters WHERE id = ?").get(chapterId) as ChapterRow | undefined;
  if (!existing) {
    throw new Error("Chapter not found");
  }

  db.prepare(
    `UPDATE chapters
     SET chapter_no = ?, slug = ?, title_en = ?, title_zh = ?, location = ?, date_label = ?, short_copy = ?, quote = ?,
         theme_color = ?, accent_color = ?, background_tone = ?, hero_image_id = ?, auto_seconds = ?, is_published = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    Number(input.chapterNo ?? existing.chapter_no),
    input.slug ?? existing.slug,
    input.titleEn ?? existing.title_en,
    input.titleZh ?? existing.title_zh,
    input.location ?? existing.location,
    input.dateLabel ?? existing.date_label,
    input.shortCopy ?? existing.short_copy,
    input.quote ?? existing.quote,
    input.themeColor ?? existing.theme_color,
    input.accentColor ?? existing.accent_color,
    input.backgroundTone ?? existing.background_tone,
    input.heroImageId === undefined ? existing.hero_image_id : input.heroImageId,
    Number(input.autoSeconds ?? existing.auto_seconds),
    input.isPublished === undefined ? existing.is_published : input.isPublished ? 1 : 0,
    now(),
    chapterId
  );

  return getLibraryState(true);
}

export async function deleteChapter(chapterId: string) {
  const db = await ensureAppReady();
  db.prepare("UPDATE photos SET chapter_id = NULL, is_cover = 0, updated_at = ? WHERE chapter_id = ?").run(now(), chapterId);
  db.prepare("DELETE FROM chapters WHERE id = ?").run(chapterId);
  return getLibraryState(true);
}

export async function reorderChapters(chapterIds: string[]) {
  const db = await ensureAppReady();
  const transaction = db.transaction((ids: string[]) => {
    ids.forEach((chapterId, index) => {
      db.prepare("UPDATE chapters SET order_index = ?, updated_at = ? WHERE id = ?").run(index, now(), chapterId);
    });
  });
  transaction(chapterIds);
  return getLibraryState(true);
}

export async function updatePhoto(photoId: string, input: Partial<Photo>) {
  const db = await ensureAppReady();
  const existing = db.prepare("SELECT * FROM photos WHERE id = ?").get(photoId) as PhotoRow | undefined;
  if (!existing) {
    throw new Error("Photo not found");
  }

  const nextChapterId = input.chapterId === undefined ? existing.chapter_id : input.chapterId;
  const orderIndex =
    nextChapterId !== existing.chapter_id ? nextPhotoOrder(db, existing.project_id, nextChapterId) : existing.order_index;

  db.prepare(
    `UPDATE photos
     SET chapter_id = ?, order_index = ?, title = ?, caption = ?, location = ?, captured_at = ?,
         is_cover = ?, is_visible = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    nextChapterId || null,
    orderIndex,
    input.title ?? existing.title,
    input.caption ?? existing.caption,
    input.location ?? existing.location,
    input.capturedAt ?? existing.captured_at,
    input.isCover === undefined ? existing.is_cover : input.isCover ? 1 : 0,
    input.isVisible === undefined ? existing.is_visible : input.isVisible ? 1 : 0,
    now(),
    photoId
  );

  if (input.isCover && nextChapterId) {
    db.prepare("UPDATE photos SET is_cover = 0 WHERE chapter_id = ? AND id != ?").run(nextChapterId, photoId);
    db.prepare("UPDATE chapters SET hero_image_id = ?, updated_at = ? WHERE id = ?").run(photoId, now(), nextChapterId);
  }

  updateChapterHeroImages(db, existing.project_id);
  return getLibraryState(true);
}

export async function reorderPhotos(chapterId: string | null, photoIds: string[]) {
  const db = await ensureAppReady();
  const transaction = db.transaction((ids: string[]) => {
    ids.forEach((photoId, index) => {
      db.prepare("UPDATE photos SET chapter_id = ?, order_index = ?, updated_at = ? WHERE id = ?").run(
        chapterId,
        index,
        now(),
        photoId
      );
    });
  });
  transaction(photoIds);
  return getLibraryState(true);
}

export async function deletePhoto(photoId: string) {
  const db = await ensureAppReady();
  db.prepare("DELETE FROM photos WHERE id = ?").run(photoId);
  return getLibraryState(true);
}

export function demoSlugs() {
  return getDemoSlugs();
}
