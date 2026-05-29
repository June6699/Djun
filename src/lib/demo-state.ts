import type { Chapter, LibraryState, Photo } from "@/types/cms";

const projectId = "project_world_light_2026";
const updatedAt = "2026-05-29T00:00:00.000Z";

const chapterSeeds = [
  {
    slug: "everest",
    titleEn: "EVEREST",
    location: "Sagarmatha",
    dateLabel: "05.29",
    shortCopy: "summit light / snow ridge / thin air",
    quote: "The morning arrived as a blade of gold, shaving the summit out of the dark.",
    themeColor: "#233247",
    accentColor: "#f3c96b",
    backgroundTone: "#d9d5c8",
    file: "01-everest.jpg",
    title: "Summit Light"
  },
  {
    slug: "hwaesong",
    titleEn: "HWASEONG",
    location: "Suwon",
    dateLabel: "05.28",
    shortCopy: "fortress wall / tiled roofs / spring stone",
    quote: "A quiet wall held the city in place while roofs folded themselves into the hills.",
    themeColor: "#334137",
    accentColor: "#d9a45f",
    backgroundTone: "#d4c7aa",
    file: "02-hwaesong.jpg",
    title: "Fortress Morning"
  },
  {
    slug: "lupine",
    titleEn: "LUPINE",
    location: "Lake Tekapo",
    dateLabel: "05.26",
    shortCopy: "purple shore / cold lake / open sky",
    quote: "The flowers made a soft riot at the waterline, and the lake kept its blue composure.",
    themeColor: "#334063",
    accentColor: "#c9a2ff",
    backgroundTone: "#d8d2bf",
    file: "03-lupine.jpg",
    title: "Purple Shore"
  },
  {
    slug: "hawa-mahal",
    titleEn: "HAWA MAHAL",
    location: "Jaipur",
    dateLabel: "05.25",
    shortCopy: "pink facade / lattice air / afternoon heat",
    quote: "Every window seemed to be listening for a breeze that had crossed the old city.",
    themeColor: "#a54d4b",
    accentColor: "#f0b07d",
    backgroundTone: "#e0c2aa",
    file: "04-hawa-mahal.jpg",
    title: "Pink Facade"
  },
  {
    slug: "dolomites",
    titleEn: "DOLOMITES",
    location: "South Tyrol",
    dateLabel: "05.24",
    shortCopy: "alpine teeth / meadow light / long road",
    quote: "The mountains rose like pale architecture, too old to care about weather.",
    themeColor: "#40513f",
    accentColor: "#c7d46a",
    backgroundTone: "#d7d0b6",
    file: "05-dolomites.jpg",
    title: "Alpine Teeth"
  },
  {
    slug: "kauehi",
    titleEn: "KAUEHI",
    location: "Tuamotu",
    dateLabel: "05.22",
    shortCopy: "lagoon ring / reef blue / coral quiet",
    quote: "From above, the island looked like a thought drawn in turquoise ink.",
    themeColor: "#17606d",
    accentColor: "#74d7df",
    backgroundTone: "#c7d5cf",
    file: "06-kauehi.jpg",
    title: "Lagoon Ring"
  },
  {
    slug: "sichuan-tea",
    titleEn: "TEA RIDGES",
    location: "Sichuan",
    dateLabel: "05.21",
    shortCopy: "green contour / morning rows / wet leaves",
    quote: "The hillside turned agriculture into calligraphy, line after line after line.",
    themeColor: "#274d31",
    accentColor: "#a8d46e",
    backgroundTone: "#cfceb0",
    file: "07-sichuan-tea.jpg",
    title: "Tea Contours"
  },
  {
    slug: "lighthouse",
    titleEn: "LIGHTHOUSE",
    location: "Asturias",
    dateLabel: "05.19",
    shortCopy: "atlantic edge / white tower / salt wind",
    quote: "The tower kept its small bright promise at the place where land ran out.",
    themeColor: "#24445a",
    accentColor: "#f2d16b",
    backgroundTone: "#c9d0cb",
    file: "08-spain-lighthouse.jpg",
    title: "Atlantic Beacon"
  }
] as const;

const chapters: Chapter[] = chapterSeeds.map((chapter, index) => ({
  id: `chapter_${chapter.slug.replaceAll("-", "_")}`,
  projectId,
  orderIndex: index,
  chapterNo: index + 1,
  slug: chapter.slug,
  titleEn: chapter.titleEn,
  titleZh: "",
  location: chapter.location,
  dateLabel: chapter.dateLabel,
  shortCopy: chapter.shortCopy,
  quote: chapter.quote,
  themeColor: chapter.themeColor,
  accentColor: chapter.accentColor,
  backgroundTone: chapter.backgroundTone,
  heroImageId: `photo_${chapter.slug.replaceAll("-", "_")}`,
  autoSeconds: 28,
  isPublished: true,
  updatedAt
}));

const photos: Photo[] = chapterSeeds.map((chapter, index) => ({
  id: `photo_${chapter.slug.replaceAll("-", "_")}`,
  projectId,
  chapterId: `chapter_${chapter.slug.replaceAll("-", "_")}`,
  orderIndex: 0,
  title: chapter.title,
  caption: chapter.quote,
  location: chapter.location,
  capturedAt: `2026-${chapter.dateLabel.replace(".", "-")}`,
  sourceFolder: "demo-assets",
  originalPath: `/demo-assets/${chapter.file}`,
  thumbPath: `/demo-assets/${chapter.file}`,
  width: 1800,
  height: 1160,
  mimeType: "image/jpeg",
  isCover: index === 0,
  isVisible: true,
  isMissing: false,
  createdAt: updatedAt,
  updatedAt
}));

export function getDemoLibraryState(): LibraryState {
  return {
    project: {
      id: projectId,
      slug: "world-light-2026",
      title: "WORLD LIGHT",
      subtitle: "BING WALLPAPER EDITION",
      description: "A cinematic wall of borrowed light, curated as a Cloudflare-safe travel journal.",
      theme: "film-journal",
      autoplaySeconds: 28,
      photoSeconds: 5,
      updatedAt
    },
    chapters,
    photos
  };
}
