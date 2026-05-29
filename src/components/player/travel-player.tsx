"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Maximize2, Pause, Play, SlidersHorizontal } from "lucide-react";
import type { Chapter, LibraryState, Photo } from "@/types/cms";

type Props = {
  initialState: LibraryState;
};

function photosForChapter(photos: Photo[], chapterId: string) {
  return photos.filter((photo) => photo.chapterId === chapterId && photo.isVisible && !photo.isMissing);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function useClock() {
  const [time, setTime] = useState("--:--:--");

  useEffect(() => {
    const update = () => {
      const current = new Date();
      setTime(`${pad(current.getHours())}:${pad(current.getMinutes())}:${pad(current.getSeconds())}`);
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return time;
}

export function TravelPlayer({ initialState }: Props) {
  const { project, photos } = initialState;
  const chapters = useMemo(() => initialState.chapters.filter((chapter) => chapter.isPublished), [initialState.chapters]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [chapterElapsed, setChapterElapsed] = useState(0);
  const [photoElapsed, setPhotoElapsed] = useState(0);
  const touchStart = useRef<number | null>(null);
  const clock = useClock();

  const activeChapter = chapters[chapterIndex] ?? chapters[0];
  const chapterPhotos = useMemo(
    () => (activeChapter ? photosForChapter(photos, activeChapter.id) : []),
    [activeChapter, photos]
  );
  const activePhoto = chapterPhotos[photoIndex % Math.max(chapterPhotos.length, 1)] ?? null;
  const chapterSeconds = Math.max(activeChapter?.autoSeconds ?? project.autoplaySeconds, 8);
  const photoSeconds = Math.max(project.photoSeconds, 2);

  const goToChapter = useCallback(
    (nextIndex: number) => {
      if (!chapters.length) return;
      const normalized = (nextIndex + chapters.length) % chapters.length;
      setChapterIndex(normalized);
      setPhotoIndex(0);
      setChapterElapsed(0);
      setPhotoElapsed(0);
    },
    [chapters.length]
  );

  const goToPhoto = useCallback(
    (nextIndex: number) => {
      if (!chapterPhotos.length) return;
      const normalized = (nextIndex + chapterPhotos.length) % chapterPhotos.length;
      setPhotoIndex(normalized);
      setPhotoElapsed(0);
    },
    [chapterPhotos.length]
  );

  useEffect(() => {
    if (paused || !activeChapter || !chapters.length) return;

    const interval = window.setInterval(() => {
      setChapterElapsed((current) => {
        const next = current + 0.1;
        if (next >= chapterSeconds) {
          goToChapter(chapterIndex + 1);
          return 0;
        }
        return next;
      });

      if (chapterPhotos.length > 1) {
        setPhotoElapsed((current) => {
          const next = current + 0.1;
          if (next >= photoSeconds) {
            setPhotoIndex((index) => (index + 1) % chapterPhotos.length);
            return 0;
          }
          return next;
        });
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [
    activeChapter,
    chapterIndex,
    chapterPhotos.length,
    chapterSeconds,
    chapters.length,
    goToChapter,
    paused,
    photoSeconds
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === " ") {
        event.preventDefault();
        setPaused((value) => !value);
      }
      if (event.key === "ArrowRight") goToChapter(chapterIndex + 1);
      if (event.key === "ArrowLeft") goToChapter(chapterIndex - 1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chapterIndex, goToChapter]);

  if (!activeChapter) {
    return (
      <main className="showcase-shell empty-showcase">
        <div className="empty-frame">
          <p>NO ROLL LOADED</p>
          <a href="/admin">OPEN CMS</a>
        </div>
      </main>
    );
  }

  const chapterProgress = Math.min(chapterElapsed / chapterSeconds, 1);
  const photoProgress = Math.min(photoElapsed / photoSeconds, 1);

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (touchStart.current === null) return;
    const delta = event.clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) < 56) return;
    goToChapter(delta < 0 ? chapterIndex + 1 : chapterIndex - 1);
  };

  return (
    <main
      className="showcase-shell"
      style={
        {
          "--chapter": activeChapter.themeColor,
          "--accent": activeChapter.accentColor,
          "--paper": activeChapter.backgroundTone
        } as CSSProperties
      }
      onPointerDown={(event) => {
        touchStart.current = event.clientX;
      }}
      onPointerUp={onPointerUp}
    >
      <header className="viewer-topbar" aria-label="Playback status">
        <div>
          <strong>{project.title}</strong>
          <span>{project.subtitle}</span>
          <span>CHAPTER {pad(activeChapter.chapterNo)} · {activeChapter.titleEn}</span>
        </div>
        <nav aria-label="Chapters">
          {chapters.map((chapter, index) => (
            <button
              key={chapter.id}
              type="button"
              className={index === chapterIndex ? "active" : ""}
              style={{ "--dot": chapter.accentColor } as CSSProperties}
              onClick={() => goToChapter(index)}
              aria-label={`Open ${chapter.titleEn}`}
            />
          ))}
        </nav>
        <div className="viewer-topbar-actions">
          <button type="button" onClick={() => goToChapter(chapterIndex - 1)}>
            ← PREV
          </button>
          <button type="button" onClick={() => goToChapter(chapterIndex + 1)}>
            NEXT →
          </button>
        </div>
      </header>

      <section className="black-room" aria-label="Travel journal playback">
        <div className="clock-readout">{clock}</div>
        <div className="floating-runtime">{Math.ceil((chapters.length - chapterIndex) * chapterSeconds - chapterElapsed)}s</div>
      </section>

      <section className="chapter-progress-rail" aria-label="Chapter progress">
        {chapters.map((chapter, index) => (
          <span key={chapter.id} className={index === chapterIndex ? "active" : ""}>
            <i style={{ transform: `scaleX(${index === chapterIndex ? chapterProgress : index < chapterIndex ? 1 : 0})` }} />
          </span>
        ))}
      </section>

      <section className="journal-stage">
        <article className="chapter-sheet">
          <div className="sheet-metadata">
            <span>{pad(activeChapter.chapterNo)}</span>
            <span>CHAPTER {pad(activeChapter.chapterNo)} · {activeChapter.location}</span>
          </div>
          <p className="chapter-kicker">CHAPTER {pad(activeChapter.chapterNo)} · {activeChapter.location.toUpperCase()}</p>
          <h1>{activeChapter.titleEn}</h1>
          <h2>{activeChapter.titleZh}</h2>
          <p className="handwritten">{activeChapter.shortCopy}</p>
          <div className="sheet-bottom">
            <ol>
              {chapterPhotos.slice(0, 4).map((photo, index) => (
                <li key={photo.id}>
                  <span>{pad(index + 1)}</span>
                  <span>{photo.capturedAt || activeChapter.dateLabel}</span>
                  <span>{photo.location || photo.title}</span>
                </li>
              ))}
            </ol>
            <blockquote>{activeChapter.quote}</blockquote>
            <div className="stamp">2026<br />{activeChapter.location}</div>
          </div>
          <footer>
            <span>SPOT · {project.title}</span>
            <span>{pad(activeChapter.chapterNo * 2 + 1)}</span>
          </footer>
        </article>

        <figure className="photo-contact-sheet">
          <div className="photo-tools">
            <span />
            <span />
            <span />
            <span />
          </div>
          {activePhoto ? (
            <Image
              src={activePhoto.originalPath}
              alt={activePhoto.caption || activePhoto.title || activeChapter.titleEn}
              fill
              priority
              unoptimized
              sizes="100vw"
              className="photo-media"
            />
          ) : (
            <div className="photo-placeholder">NO EXPOSURES</div>
          )}
          <div className="photo-caption">
            <span>{activePhoto?.caption || activeChapter.shortCopy}</span>
          </div>
          <div className="photo-counter">
            <strong>{pad((photoIndex % Math.max(chapterPhotos.length, 1)) + 1)}</strong>
            <span>{chapterPhotos.length || 0} EXPOSURES</span>
          </div>
          <div className="photo-footer">
            <span>{pad((photoIndex % Math.max(chapterPhotos.length, 1)) + 1)} / {pad(chapterPhotos.length || 1)}</span>
            <span>{activePhoto?.capturedAt || activeChapter.dateLabel}</span>
            <span>{activePhoto?.location || activeChapter.location}</span>
            <span>CONTACT SHEET {pad(activeChapter.chapterNo)}</span>
          </div>
          <div className="photo-progress" style={{ transform: `scaleX(${photoProgress || 0})` }} />
          <aside className="thumb-rail" aria-label="Photo strip">
            {chapterPhotos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                className={index === photoIndex ? "active" : ""}
                onClick={() => goToPhoto(index)}
                aria-label={`Open photo ${index + 1}`}
              >
                <Image src={photo.thumbPath || photo.originalPath} alt="" width={120} height={92} unoptimized />
              </button>
            ))}
          </aside>
        </figure>
      </section>

      <div className="viewer-controls" aria-label="Playback controls">
        <a className="control-button" href="/admin" title="CMS">
          <SlidersHorizontal size={34} aria-hidden="true" />
        </a>
        <button type="button" className="control-button" onClick={() => goToChapter(chapterIndex - 1)} title="Previous chapter">
          <ArrowLeft size={34} aria-hidden="true" />
        </button>
        <button type="button" className="control-button wide" onClick={() => setPaused((value) => !value)} title="Play or pause">
          {paused ? <Play size={38} aria-hidden="true" /> : <Pause size={38} aria-hidden="true" />}
        </button>
        <button type="button" className="control-button" onClick={() => goToChapter(chapterIndex + 1)} title="Next chapter">
          <ArrowRight size={34} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="control-button"
          onClick={() => document.documentElement.requestFullscreen?.()}
          title="Fullscreen"
        >
          <Maximize2 size={32} aria-hidden="true" />
        </button>
      </div>
    </main>
  );
}
