export type Project = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  theme: string;
  autoplaySeconds: number;
  photoSeconds: number;
  updatedAt: string;
};

export type Chapter = {
  id: string;
  projectId: string;
  orderIndex: number;
  chapterNo: number;
  slug: string;
  titleEn: string;
  titleZh: string;
  location: string;
  dateLabel: string;
  shortCopy: string;
  quote: string;
  themeColor: string;
  accentColor: string;
  backgroundTone: string;
  heroImageId: string | null;
  autoSeconds: number;
  isPublished: boolean;
  updatedAt: string;
};

export type Photo = {
  id: string;
  projectId: string;
  chapterId: string | null;
  orderIndex: number;
  title: string;
  caption: string;
  location: string;
  capturedAt: string;
  sourceFolder: string;
  originalPath: string;
  thumbPath: string;
  width: number;
  height: number;
  mimeType: string;
  isCover: boolean;
  isVisible: boolean;
  isMissing: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LibraryState = {
  project: Project;
  chapters: Chapter[];
  photos: Photo[];
};

export type AdminUser = {
  id: string;
  username: string;
};

export type ScanResult = {
  imported: number;
  updated: number;
  missing: number;
  total: number;
};
