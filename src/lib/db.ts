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
    slug: "everest",
    titleEn: "EVEREST",
    titleZh: "珠峰",
    location: "Sagarmatha",
    dateLabel: "05.29",
    shortCopy: "summit light / snow ridge / thin air",
    quote: "The morning arrived as a blade of gold, shaving the summit out of the dark.",
    themeColor: "#233247",
    accentColor: "#f3c96b",
    backgroundTone: "#d9d5c8"
  },
  {
    chapterNo: 2,
    slug: "hwaesong",
    titleEn: "HWASEONG",
    titleZh: "华城",
    location: "Suwon",
    dateLabel: "05.28",
    shortCopy: "fortress wall / tiled roofs / spring stone",
    quote: "A quiet wall held the city in place while roofs folded themselves into the hills.",
    themeColor: "#334137",
    accentColor: "#d9a45f",
    backgroundTone: "#d4c7aa"
  },
  {
    chapterNo: 3,
    slug: "lupine",
    titleEn: "LUPINE",
    titleZh: "鲁冰花",
    location: "Lake Tekapo",
    dateLabel: "05.26",
    shortCopy: "purple shore / cold lake / open sky",
    quote: "The flowers made a soft riot at the waterline, and the lake kept its blue composure.",
    themeColor: "#334063",
    accentColor: "#c9a2ff",
    backgroundTone: "#d8d2bf"
  },
  {
    chapterNo: 4,
    slug: "hawa-mahal",
    titleEn: "HAWA MAHAL",
    titleZh: "风之宫殿",
    location: "Jaipur",
    dateLabel: "05.25",
    shortCopy: "pink facade / lattice air / afternoon heat",
    quote: "Every window seemed to be listening for a breeze that had crossed the old city.",
    themeColor: "#a54d4b",
    accentColor: "#f0b07d",
    backgroundTone: "#e0c2aa"
  },
  {
    chapterNo: 5,
    slug: "dolomites",
    titleEn: "DOLOMITES",
    titleZh: "多洛米蒂",
    location: "South Tyrol",
    dateLabel: "05.24",
    shortCopy: "alpine teeth / meadow light / long road",
    quote: "The mountains rose like pale architecture, too old to care about weather.",
    themeColor: "#40513f",
    accentColor: "#c7d46a",
    backgroundTone: "#d7d0b6"
  },
  {
    chapterNo: 6,
    slug: "kauehi",
    titleEn: "KAUEHI",
    titleZh: "考埃希",
    location: "Tuamotu",
    dateLabel: "05.22",
    shortCopy: "lagoon ring / reef blue / coral quiet",
    quote: "From above, the island looked like a thought drawn in turquoise ink.",
    themeColor: "#17606d",
    accentColor: "#74d7df",
    backgroundTone: "#c7d5cf"
  },
  {
    chapterNo: 7,
    slug: "sichuan-tea",
    titleEn: "TEA RIDGES",
    titleZh: "茶山",
    location: "Sichuan",
    dateLabel: "05.21",
    shortCopy: "green contour / morning rows / wet leaves",
    quote: "The hillside turned agriculture into calligraphy, line after line after line.",
    themeColor: "#274d31",
    accentColor: "#a8d46e",
    backgroundTone: "#cfceb0"
  },
  {
    chapterNo: 8,
    slug: "lighthouse",
    titleEn: "LIGHTHOUSE",
    titleZh: "灯塔",
    location: "Asturias",
    dateLabel: "05.19",
    shortCopy: "atlantic edge / white tower / salt wind",
    quote: "The tower kept its small bright promise at the place where land ran out.",
    themeColor: "#24445a",
    accentColor: "#f2d16b",
    backgroundTone: "#c9d0cb"
  }
];

const defaultPhotoMetadata: Record<string, { title: string; caption: string; location: string; capturedAt: string }> = {
  everest: {
    title: "Summit Light",
    caption: "珠穆朗玛峰峰顶在清晨雪光里浮出来，像一页被慢慢翻开的白色地图。",
    location: "Sagarmatha National Park, Nepal",
    capturedAt: "2026-05-29"
  },
  hwaesong: {
    title: "Fortress Morning",
    caption: "水原华城的城墙、屋檐和树影叠在一起，安静得很适合慢慢走。",
    location: "Suwon, South Korea",
    capturedAt: "2026-05-28"
  },
  lupine: {
    title: "Purple Shore",
    caption: "湖边的鲁冰花把冷蓝色的水岸点亮，整张照片像一段柔软的间奏。",
    location: "Lake Tekapo, New Zealand",
    capturedAt: "2026-05-26"
  },
  "hawa-mahal": {
    title: "Pink Facade",
    caption: "风之宫殿的窗格密密铺开，粉色墙面把午后的热气也变得漂亮。",
    location: "Jaipur, India",
    capturedAt: "2026-05-25"
  },
  dolomites: {
    title: "Alpine Teeth",
    caption: "多洛米蒂的山脊像被削亮的石头，草甸和云影把画面压得很稳。",
    location: "South Tyrol, Italy",
    capturedAt: "2026-05-24"
  },
  kauehi: {
    title: "Lagoon Ring",
    caption: "考埃希环礁从高处看像一枚蓝绿色的印章，海水把边界画得很轻。",
    location: "Tuamotu Archipelago, French Polynesia",
    capturedAt: "2026-05-22"
  },
  "sichuan-tea": {
    title: "Tea Contours",
    caption: "四川茶山的行列绕着坡面展开，绿色的线条像手写字一样连绵。",
    location: "Sichuan, China",
    capturedAt: "2026-05-21"
  },
  lighthouse: {
    title: "Atlantic Beacon",
    caption: "西班牙海岸边的白色灯塔站在风里，替陆地守住最后一段边缘。",
    location: "Asturias, Spain",
    capturedAt: "2026-05-19"
  }
};

function metadataForFile(relativePath: string) {
  const normalized = relativePath.toLowerCase();
  return Object.entries(defaultPhotoMetadata).find(([slug]) => normalized.includes(slug))?.[1] ?? null;
}
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
  const project = db.prepare("SELECT id FROM projects WHERE slug = ?").get("world-light-2026") as { id: string } | undefined;
  const projectId = project?.id ?? "project_world_light_2026";

  if (!project) {
    db.prepare(
      `INSERT INTO projects
        (id, slug, title, subtitle, description, theme, autoplay_seconds, photo_seconds, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      projectId,
      "world-light-2026",
      "WORLD LIGHT",
      "BING WALLPAPER EDITION",
      "A cinematic wall of borrowed light, seeded from Bing Wallpaper landscapes and curated as a local travel journal.",
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
  const photoMetadata = metadataForFile(file.relativePath);
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
    photoMetadata?.title ?? defaultPhotoTitle(file.relativePath),
    photoMetadata?.caption ?? "",
    photoMetadata?.location ?? "",
    photoMetadata?.capturedAt ?? "",
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
