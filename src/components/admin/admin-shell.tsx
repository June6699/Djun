"use client";

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ExternalLink,
  Eye,
  EyeOff,
  FolderSync,
  GripVertical,
  ImagePlus,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Star,
  Trash2,
  Upload
} from "lucide-react";
import Image from "next/image";
import type { AdminUser, Chapter, LibraryState, Photo, Project } from "@/types/cms";

type Props = {
  initialState: LibraryState;
  user: AdminUser;
};

type ApiPayload = {
  state?: LibraryState;
  scan?: unknown;
  error?: string;
};

function photosForChapter(photos: Photo[], chapterId: string) {
  return photos.filter((photo) => photo.chapterId === chapterId).sort((a, b) => a.orderIndex - b.orderIndex);
}

function countForChapter(photos: Photo[], chapterId: string) {
  return photos.filter((photo) => photo.chapterId === chapterId && !photo.isMissing).length;
}

function updateById<T extends { id: string }>(items: T[], id: string, patch: Partial<T>) {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function AdminShell({ initialState, user }: Props) {
  const [library, setLibrary] = useState(initialState);
  const [selectedChapterId, setSelectedChapterId] = useState(initialState.chapters[0]?.id ?? "");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const draggingChapter = useRef<string | null>(null);
  const draggingPhoto = useRef<string | null>(null);

  const selectedChapter = library.chapters.find((chapter) => chapter.id === selectedChapterId) ?? library.chapters[0];
  const selectedPhotos = useMemo(
    () => (selectedChapter ? photosForChapter(library.photos, selectedChapter.id) : []),
    [library.photos, selectedChapter]
  );
  const selectedPhoto = library.photos.find((photo) => photo.id === selectedPhotoId) ?? selectedPhotos[0] ?? null;
  const unassigned = library.photos.filter((photo) => !photo.chapterId && !photo.isMissing);

  async function requestJson(url: string, options?: RequestInit) {
    setBusy(true);
    setMessage("");
    const response = await fetch(url, options);
    const payload = (await response.json().catch(() => ({}))) as ApiPayload;

    if (!response.ok) {
      setMessage(payload.error || "Request failed");
      setBusy(false);
      return payload;
    }

    if (payload.state) {
      setLibrary(payload.state);
      if (payload.state.chapters.length && !payload.state.chapters.some((chapter) => chapter.id === selectedChapterId)) {
        setSelectedChapterId(payload.state.chapters[0].id);
      }
    }

    setBusy(false);
    return payload;
  }

  function patchProject(patch: Partial<Project>) {
    setLibrary((current) => ({ ...current, project: { ...current.project, ...patch } }));
  }

  function patchChapter(chapterId: string, patch: Partial<Chapter>) {
    setLibrary((current) => ({ ...current, chapters: updateById(current.chapters, chapterId, patch) }));
  }

  function patchPhoto(photoId: string, patch: Partial<Photo>) {
    setLibrary((current) => ({ ...current, photos: updateById(current.photos, photoId, patch) }));
  }

  async function saveProject() {
    await requestJson("/api/admin/project", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(library.project)
    });
    setMessage("Project saved");
  }

  async function saveChapter() {
    if (!selectedChapter) return;
    await requestJson(`/api/admin/chapters/${selectedChapter.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selectedChapter)
    });
    setMessage("Chapter saved");
  }

  async function savePhoto(photo: Photo | null) {
    if (!photo) return;
    await requestJson(`/api/admin/photos/${photo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(photo)
    });
    setMessage("Photo saved");
  }

  async function createChapter() {
    const payload = await requestJson("/api/admin/chapters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    if (payload.state?.chapters.length) {
      setSelectedChapterId(payload.state.chapters[payload.state.chapters.length - 1].id);
    }
  }

  async function removeChapter() {
    if (!selectedChapter || !window.confirm(`Delete ${selectedChapter.titleEn}?`)) return;
    await requestJson(`/api/admin/chapters/${selectedChapter.id}`, { method: "DELETE" });
  }

  async function scanLibrary() {
    const payload = await requestJson("/api/admin/scan", { method: "POST" });
    await requestJson("/api/admin/state");
    setMessage(payload.scan ? "Library refreshed" : "Library checked");
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMessage("");
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    await fetch("/api/admin/upload", { method: "POST", body: formData });
    await requestJson("/api/admin/state");
    if (fileInput.current) fileInput.current.value = "";
    setMessage("Upload complete");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin";
  }

  async function dropChapter(targetId: string) {
    const sourceId = draggingChapter.current;
    draggingChapter.current = null;
    if (!sourceId || sourceId === targetId) return;

    const current = [...library.chapters];
    const sourceIndex = current.findIndex((chapter) => chapter.id === sourceId);
    const targetIndex = current.findIndex((chapter) => chapter.id === targetId);
    const [moved] = current.splice(sourceIndex, 1);
    current.splice(targetIndex, 0, moved);
    setLibrary((state) => ({ ...state, chapters: current.map((chapter, index) => ({ ...chapter, orderIndex: index })) }));

    await requestJson("/api/admin/chapter-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterIds: current.map((chapter) => chapter.id) })
    });
  }

  async function dropPhoto(targetId: string) {
    const sourceId = draggingPhoto.current;
    draggingPhoto.current = null;
    if (!selectedChapter || !sourceId || sourceId === targetId) return;

    const current = [...selectedPhotos];
    const sourceIndex = current.findIndex((photo) => photo.id === sourceId);
    const targetIndex = current.findIndex((photo) => photo.id === targetId);
    const [moved] = current.splice(sourceIndex, 1);
    current.splice(targetIndex, 0, moved);

    const ordered = current.map((photo, index) => ({ ...photo, orderIndex: index, chapterId: selectedChapter.id }));
    setLibrary((state) => ({
      ...state,
      photos: state.photos.map((photo) => ordered.find((orderedPhoto) => orderedPhoto.id === photo.id) ?? photo)
    }));

    await requestJson("/api/admin/photo-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterId: selectedChapter.id, photoIds: current.map((photo) => photo.id) })
    });
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <h1>{library.project.title} CMS</h1>
          <p>{user.username} · {library.chapters.length} chapters · {library.photos.length} photos</p>
        </div>
        <div className="split-actions">
          <a className="ghost-button" href="/" target="_blank" rel="noreferrer">
            <ExternalLink size={17} aria-hidden="true" />
            Preview
          </a>
          <button type="button" className="ghost-button" onClick={scanLibrary} disabled={busy}>
            <FolderSync size={17} aria-hidden="true" />
            Scan
          </button>
          <button type="button" className="ghost-button" onClick={logout}>
            <LogOut size={17} aria-hidden="true" />
            Logout
          </button>
        </div>
      </header>

      <section className="admin-grid">
        <aside className="admin-panel">
          <div className="admin-panel-header">
            <strong>Chapters</strong>
            <button type="button" className="ghost-button" onClick={createChapter} disabled={busy}>
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="admin-panel-body chapter-list">
            {library.chapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                draggable
                onDragStart={() => {
                  draggingChapter.current = chapter.id;
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropChapter(chapter.id)}
                className={`chapter-row ${chapter.id === selectedChapter?.id ? "active" : ""}`}
                onClick={() => setSelectedChapterId(chapter.id)}
              >
                <span className="chapter-dot" style={{ "--tone": chapter.accentColor } as CSSProperties} />
                <span>
                  <strong>{chapter.titleEn}</strong>
                  <span>{chapter.location} · {countForChapter(library.photos, chapter.id)} photos</span>
                </span>
                <GripVertical size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
        </aside>

        <section className="stack">
          <section className="admin-panel">
            <div className="admin-panel-header">
              <strong>Project</strong>
              <button type="button" className="ghost-button" onClick={saveProject} disabled={busy}>
                <Save size={16} aria-hidden="true" />
                Save
              </button>
            </div>
            <div className="admin-panel-body form-grid">
              <Field label="Title">
                <input value={library.project.title} onChange={(event) => patchProject({ title: event.target.value })} />
              </Field>
              <Field label="Subtitle">
                <input value={library.project.subtitle} onChange={(event) => patchProject({ subtitle: event.target.value })} />
              </Field>
              <Field label="Chapter seconds">
                <input
                  type="number"
                  value={library.project.autoplaySeconds}
                  onChange={(event) => patchProject({ autoplaySeconds: Number(event.target.value) })}
                />
              </Field>
              <Field label="Photo seconds">
                <input
                  type="number"
                  value={library.project.photoSeconds}
                  onChange={(event) => patchProject({ photoSeconds: Number(event.target.value) })}
                />
              </Field>
            </div>
          </section>

          {selectedChapter ? (
            <section className="admin-panel">
              <div className="admin-panel-header">
                <strong>{selectedChapter.titleEn}</strong>
                <div className="split-actions">
                  <button type="button" className="ghost-button" onClick={saveChapter} disabled={busy}>
                    <Save size={16} aria-hidden="true" />
                    Save
                  </button>
                  <button type="button" className="ghost-button" onClick={removeChapter} disabled={busy}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="admin-panel-body stack">
                <div className="form-grid">
                  <Field label="No.">
                    <input
                      type="number"
                      value={selectedChapter.chapterNo}
                      onChange={(event) => patchChapter(selectedChapter.id, { chapterNo: Number(event.target.value) })}
                    />
                  </Field>
                  <Field label="Slug">
                    <input value={selectedChapter.slug} onChange={(event) => patchChapter(selectedChapter.id, { slug: event.target.value })} />
                  </Field>
                  <Field label="English title">
                    <input value={selectedChapter.titleEn} onChange={(event) => patchChapter(selectedChapter.id, { titleEn: event.target.value })} />
                  </Field>
                  <Field label="Chinese title">
                    <input value={selectedChapter.titleZh} onChange={(event) => patchChapter(selectedChapter.id, { titleZh: event.target.value })} />
                  </Field>
                  <Field label="Location">
                    <input value={selectedChapter.location} onChange={(event) => patchChapter(selectedChapter.id, { location: event.target.value })} />
                  </Field>
                  <Field label="Date">
                    <input value={selectedChapter.dateLabel} onChange={(event) => patchChapter(selectedChapter.id, { dateLabel: event.target.value })} />
                  </Field>
                  <Field label="Theme">
                    <input type="color" value={selectedChapter.themeColor} onChange={(event) => patchChapter(selectedChapter.id, { themeColor: event.target.value })} />
                  </Field>
                  <Field label="Accent">
                    <input type="color" value={selectedChapter.accentColor} onChange={(event) => patchChapter(selectedChapter.id, { accentColor: event.target.value })} />
                  </Field>
                </div>
                <Field label="Short copy">
                  <input value={selectedChapter.shortCopy} onChange={(event) => patchChapter(selectedChapter.id, { shortCopy: event.target.value })} />
                </Field>
                <Field label="Quote">
                  <textarea value={selectedChapter.quote} onChange={(event) => patchChapter(selectedChapter.id, { quote: event.target.value })} />
                </Field>
                <label className="split-actions">
                  <input
                    type="checkbox"
                    checked={selectedChapter.isPublished}
                    onChange={(event) => patchChapter(selectedChapter.id, { isPublished: event.target.checked })}
                  />
                  Published
                </label>
              </div>
            </section>
          ) : null}

          <section className="admin-panel">
            <div className="admin-panel-header">
              <strong>Chapter Photos</strong>
              <span>{selectedPhotos.length}</span>
            </div>
            <div className="admin-panel-body photo-grid">
              {selectedPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  draggable
                  onDragStart={() => {
                    draggingPhoto.current = photo.id;
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropPhoto(photo.id)}
                  className={`photo-row ${photo.id === selectedPhoto?.id ? "active" : ""}`}
                  onClick={() => setSelectedPhotoId(photo.id)}
                >
                  <GripVertical size={17} aria-hidden="true" />
                  <Image src={photo.thumbPath || photo.originalPath} alt="" width={120} height={92} unoptimized />
                  <span>
                    <strong>{photo.title || "Untitled exposure"}</strong>
                    <span>{photo.caption || photo.originalPath}</span>
                  </span>
                  {photo.isCover ? <Star size={18} aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          </section>
        </section>

        <aside className="stack">
          <section className="admin-panel">
            <div className="admin-panel-header">
              <strong>Media</strong>
              <span>{unassigned.length} unassigned</span>
            </div>
            <div className="admin-panel-body stack">
              <div className="split-actions">
                <label className="ghost-button">
                  <Upload size={17} aria-hidden="true" />
                  Upload
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept="image/*"
                    hidden
                    onChange={(event) => uploadFiles(event.target.files)}
                  />
                </label>
                <button type="button" className="ghost-button" onClick={scanLibrary} disabled={busy}>
                  <RefreshCw size={17} aria-hidden="true" />
                  Refresh
                </button>
              </div>
              {message ? <p>{message}</p> : null}
            </div>
          </section>

          {selectedPhoto ? (
            <section className="admin-panel">
              <div className="admin-panel-header">
                <strong>Exposure</strong>
                <button type="button" className="ghost-button" onClick={() => savePhoto(selectedPhoto)} disabled={busy}>
                  <Save size={16} aria-hidden="true" />
                  Save
                </button>
              </div>
              <div className="admin-panel-body stack">
                <Image
                  src={selectedPhoto.thumbPath || selectedPhoto.originalPath}
                  alt=""
                  width={1200}
                  height={900}
                  unoptimized
                  style={{ width: "100%", height: "auto", borderRadius: "0.7rem" }}
                />
                <Field label="Title">
                  <input value={selectedPhoto.title} onChange={(event) => patchPhoto(selectedPhoto.id, { title: event.target.value })} />
                </Field>
                <Field label="Caption">
                  <input value={selectedPhoto.caption} onChange={(event) => patchPhoto(selectedPhoto.id, { caption: event.target.value })} />
                </Field>
                <Field label="Location">
                  <input value={selectedPhoto.location} onChange={(event) => patchPhoto(selectedPhoto.id, { location: event.target.value })} />
                </Field>
                <Field label="Captured">
                  <input value={selectedPhoto.capturedAt} onChange={(event) => patchPhoto(selectedPhoto.id, { capturedAt: event.target.value })} />
                </Field>
                <Field label="Chapter">
                  <select
                    value={selectedPhoto.chapterId ?? ""}
                    onChange={(event) => patchPhoto(selectedPhoto.id, { chapterId: event.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {library.chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.titleEn}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="split-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => patchPhoto(selectedPhoto.id, { isCover: !selectedPhoto.isCover })}
                  >
                    <Star size={16} aria-hidden="true" />
                    Cover
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => patchPhoto(selectedPhoto.id, { isVisible: !selectedPhoto.isVisible })}
                  >
                    {selectedPhoto.isVisible ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
                    Visible
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <section className="admin-panel">
            <div className="admin-panel-header">
              <strong>All Photos</strong>
              <ImagePlus size={17} aria-hidden="true" />
            </div>
            <div className="admin-panel-body photo-grid">
              {library.photos.slice(0, 80).map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  className={`photo-row ${photo.id === selectedPhoto?.id ? "active" : ""}`}
                  onClick={() => setSelectedPhotoId(photo.id)}
                >
                  <span className="thumb-chip">{photo.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}</span>
                  <Image src={photo.thumbPath || photo.originalPath} alt="" width={120} height={92} unoptimized />
                  <span>
                    <strong>{photo.title || "Untitled exposure"}</strong>
                    <span>{photo.chapterId ? library.chapters.find((chapter) => chapter.id === photo.chapterId)?.titleEn : "Unassigned"}</span>
                  </span>
                  {photo.isMissing ? <span>Missing</span> : null}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
