// components/resources/ResourceChapterList.tsx
"use client";

import { createElement as e, useState } from "react";

export interface ChapterItem {
  id: string;
  title: string;
  subjectName: string;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  category: string;
  chapter_id: string | null;
  subject_id: string | null;
}

export const RESOURCE_TYPES: { key: string; label: string; icon: string }[] = [
  { key: "ncert", label: "NCERT Chapter Wise", icon: "📘" },
  { key: "full_notes", label: "Notes", icon: "📝" },
  { key: "short_notes", label: "Short Notes", icon: "📄" },
  { key: "formula_sheet", label: "Formula Sheets", icon: "🧮" },
  { key: "pyq", label: "PYQs", icon: "🗂️" },
  { key: "mock_test", label: "Mock Tests", icon: "🎯" },
];

export interface SubjectGroup {
  name: string;
  subjectRowIds: string[];
  chapters: ChapterItem[];
}

interface ResourceChapterListProps {
  subjectGroups: SubjectGroup[];
  category: string;
  resources: Resource[];
}

const FULL_SUBJECT_KEY = "__full_subject__";

function triggerRead(url: string, title: string) {
  if (typeof window !== "undefined" && (window as any).AppBridge) {
    (window as any).AppBridge.postMessage(
      JSON.stringify({ action: "readPdf", url, title })
    );
    return;
  }
  window.open(url, "_blank");
}

function triggerDownload(url: string, title: string) {
  if (typeof window !== "undefined" && (window as any).AppBridge) {
    (window as any).AppBridge.postMessage(
      JSON.stringify({ action: "downloadPdf", url, title })
    );
    return;
  }
  const cleanName = (title.replace(/[^a-zA-Z0-9_-]/g, "_") || "document") + ".pdf";
  if (url.indexOf("/storage/v1/object/public/") !== -1) {
    window.open(url + (url.indexOf("?") === -1 ? "?" : "&") + "download=" + encodeURIComponent(cleanName), "_blank");
    return;
  }
  fetch(url)
    .then((res) => res.blob())
    .then((blob) => {
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = cleanName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    })
    .catch(() => window.open(url, "_blank"));
}

export default function ResourceChapterList({
  subjectGroups,
  category,
  resources,
}: ResourceChapterListProps) {
  const [activeSubject, setActiveSubject] = useState<string>(() =>
    subjectGroups.length > 0 ? subjectGroups[0].name : ""
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{ title: string; url: string } | null>(null);

  const isNcert = category === "ncert";
  const ofCategory = resources.filter((r) => r.category === category);

  const currentGroup = subjectGroups.find((g) => g.name === activeSubject) ?? subjectGroups[0];

  const subjectWide = currentGroup
    ? ofCategory.filter(
        (r) =>
          r.chapter_id === null &&
          r.subject_id !== null &&
          currentGroup.subjectRowIds.indexOf(r.subject_id) !== -1
      )
    : [];

  const chapterRows = currentGroup
    ? currentGroup.chapters
        .map((ch) => ({ ch, files: ofCategory.filter((r) => r.chapter_id === ch.id) }))
        .filter((row) => row.files.length > 0)
    : [];

  function handleView(url: string, title: string) {
    if (typeof window !== "undefined" && (window as any).AppBridge) {
      triggerRead(url, title);
    } else {
      setViewingFile({ title, url });
    }
  }

  function fileCard(r: Resource) {
    return e(
      "div",
      { key: r.id, className: "bg-paper rounded-lg border border-ink/5 p-3" },
      e("p", { className: "text-sm text-ink mb-2" }, r.title),
      e(
        "div",
        { className: "grid grid-cols-2 gap-2" },
        e(
          "button",
          {
            type: "button",
            onClick: () => handleView(r.url, r.title),
            className:
              "text-center text-sm font-semibold py-2.5 rounded-lg bg-teal/10 text-teal border border-teal/30 hover:bg-teal/20 transition-colors",
          },
          "View"
        ),
        e(
          "button",
          {
            type: "button",
            onClick: () => triggerDownload(r.url, r.title),
            className:
              "text-center text-sm font-semibold py-2.5 rounded-lg bg-marigold/10 text-marigold border border-marigold/30 hover:bg-marigold/20 transition-colors",
          },
          "Download"
        )
      )
    );
  }

  function expandable(id: string, label: string, files: Resource[]) {
    const open = expandedId === id;
    return e(
      "div",
      { key: id, className: "bg-white rounded-ticket border border-ink/10 overflow-hidden" },
      e(
        "button",
        {
          type: "button",
          onClick: () => setExpandedId(open ? null : id),
          className: "w-full px-4 py-3 flex items-center gap-2 text-left",
        },
        e("span", { className: "text-sm font-medium text-ink flex-1" }, label),
        e("span", { className: "text-ink/40 text-xs" }, open ? "▲" : "▼")
      ),
      open ? e("div", { className: "px-4 pb-4 flex flex-col gap-3" }, files.map(fileCard)) : null
    );
  }

  function ncertRow(ch: ChapterItem, files: Resource[]) {
    return e(
      "div",
      {
        key: ch.id,
        className:
          "bg-white rounded-ticket border border-ink/10 px-4 py-3 flex items-center justify-between gap-2",
      },
      e(
        "span",
        { className: "text-sm font-medium text-ink flex-1 min-w-0 truncate" },
        ch.title
      ),
      e(
        "div",
        { className: "flex items-center gap-1.5 shrink-0" },
        e(
          "button",
          {
            type: "button",
            onClick: () => handleView(files[0].url, ch.title),
            className:
              "px-3 py-1.5 text-xs font-semibold rounded-md bg-teal/10 text-teal border border-teal/20 active:scale-95 transition-all",
          },
          "Read"
        ),
        e(
          "button",
          {
            type: "button",
            onClick: () => triggerDownload(files[0].url, ch.title),
            className:
              "px-2.5 py-1.5 text-xs font-semibold rounded-md bg-ink/5 text-ink/70 border border-ink/10 active:scale-95 transition-all",
          },
          "↓"
        )
      )
    );
  }

  function pdfModal() {
    if (!viewingFile) return null;
    return e(
      "div",
      {
        className:
          "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col animate-in fade-in duration-200",
      },
      e(
        "div",
        {
          className:
            "bg-white px-4 py-3 flex items-center justify-between border-b border-ink/10 shadow-sm shrink-0",
        },
        e(
          "div",
          { className: "flex-1 min-w-0 pr-3" },
          e("p", { className: "text-sm font-bold text-ink truncate" }, viewingFile.title)
        ),
        e(
          "div",
          { className: "flex items-center gap-2 shrink-0" },
          e(
            "button",
            {
              type: "button",
              onClick: () => triggerDownload(viewingFile.url, viewingFile.title),
              className:
                "px-3 py-1.5 text-xs font-semibold rounded-md bg-marigold/10 text-marigold border border-marigold/30 active:scale-95 transition-all",
            },
            "Download"
          ),
          e(
            "button",
            {
              type: "button",
              onClick: () => triggerRead(viewingFile.url, viewingFile.title),
              className:
                "px-2.5 py-1.5 text-xs font-medium rounded-md bg-ink/5 text-ink/70 border border-ink/10 active:scale-95 transition-all",
            },
            "↗"
          ),
          e(
            "button",
            {
              type: "button",
              onClick: () => setViewingFile(null),
              className:
                "w-7 h-7 flex items-center justify-center rounded-full bg-ink/10 text-ink font-bold text-sm hover:bg-ink/20",
            },
            "✕"
          )
        )
      ),
      e(
        "div",
        {
          className:
            "flex-1 w-full bg-paper relative flex flex-col items-center justify-center p-6 text-center overflow-y-auto",
        },
        e(
          "div",
          {
            className:
              "max-w-sm w-full bg-white rounded-2xl border border-ink/10 p-6 shadow-md flex flex-col items-center gap-4 animate-in zoom-in-95 duration-150",
          },
          e(
            "div",
            {
              className:
                "w-16 h-16 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center text-3xl",
            },
            "📖"
          ),
          e(
            "div",
            null,
            e("h3", { className: "text-base font-bold text-ink mb-1.5" }, viewingFile.title),
            e(
              "p",
              { className: "text-xs text-ink/60 leading-relaxed" },
              "Open directly in Android PDF Viewer for smooth, offline reading without loading errors."
            )
          ),
          e(
            "button",
            {
              type: "button",
              onClick: () => triggerRead(viewingFile.url, viewingFile.title),
              className:
                "w-full py-3 rounded-xl bg-teal text-white font-semibold text-sm shadow hover:bg-teal/90 active:scale-95 transition-all flex items-center justify-center gap-2",
            },
            "Open in PDF Reader"
          ),
          e(
            "button",
            {
              type: "button",
              onClick: () => triggerDownload(viewingFile.url, viewingFile.title),
              className:
                "w-full py-2.5 rounded-xl bg-ink/5 text-ink/80 font-medium text-xs hover:bg-ink/10 active:scale-95 transition-all flex items-center justify-center gap-1.5",
            },
            "⬇️ Save to Downloads Folder"
          )
        )
      )
    );
  }

  // Capsule slider
  const capsuleSlider = subjectGroups.length > 1
    ? e(
        "div",
        { className: "flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-4" },
        subjectGroups.map((g) =>
          e(
            "button",
            {
              key: g.name,
              type: "button",
              onClick: () => {
                setActiveSubject(g.name);
                setExpandedId(null);
              },
              className:
                "shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all " +
                (activeSubject === g.name
                  ? "bg-ink text-white"
                  : "bg-ink/8 text-ink/60 border border-ink/10"),
            },
            g.name
          )
        )
      )
    : null;

  const nothing = chapterRows.length === 0 && subjectWide.length === 0;

  return e(
    "div",
    { className: "flex flex-col gap-3 mt-4" },
    capsuleSlider,
    subjectWide.length > 0
      ? expandable(FULL_SUBJECT_KEY, "Full subject", subjectWide)
      : null,
    chapterRows.map((row) =>
      isNcert
        ? ncertRow(row.ch, row.files)
        : expandable(row.ch.id, row.ch.title, row.files)
    ),
    nothing
      ? e("p", { className: "text-sm text-slate text-center py-8" }, "No files for this subject yet.")
      : null,
    pdfModal()
  );
}
