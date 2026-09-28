"use client";

import { createElement as e, useState } from "react";

export interface ChapterItem {
  id: string;
  title: string;
  classTag: string;
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

interface ResourceChapterListProps {
  chapters: ChapterItem[];
  subjectRowIds: string[];
  category: string;
  resources: Resource[];
}

const FULL_SUBJECT_KEY = "__full_subject__";

function classTagEl(tag: string) {
  return e(
    "span",
    { className: "shrink-0 text-[10px] font-semibold text-ink/60 bg-ink/5 px-2 py-1 rounded-full" },
    tag === "Dropper" ? "Dropper" : "Class " + tag
  );
}

function triggerDownload(url: string, title: string) {
  const cleanName = (title.replace(/[^a-zA-Z0-9_-]/g, "_") || "document") + ".pdf";
  if (url.indexOf("/storage/v1/object/public/") !== -1) {
    const target = url + (url.indexOf("?") === -1 ? "?" : "&") + "download=" + encodeURIComponent(cleanName);
    window.open(target, "_blank");
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
    .catch(() => {
      window.open(url, "_blank");
    });
}

export default function ResourceChapterList({
  chapters,
  subjectRowIds,
  category,
  resources,
}: ResourceChapterListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{ title: string; url: string } | null>(null);
  const isNcert = category === "ncert";

  const ofCategory = resources.filter((r) => r.category === category);

  const subjectWide = ofCategory.filter(
    (r) =>
      r.chapter_id === null &&
      r.subject_id !== null &&
      subjectRowIds.indexOf(r.subject_id) !== -1
  );

  const chapterRows = chapters
    .map((ch) => ({ ch, files: ofCategory.filter((r) => r.chapter_id === ch.id) }))
    .filter((row) => row.files.length > 0);

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
            onClick: () => setViewingFile({ title: r.title, url: r.url }),
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

  function expandable(id: string, headerChildren: any[], files: Resource[]) {
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
        ...headerChildren,
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
        "div",
        { className: "flex items-center gap-2 flex-1 min-w-0" },
        classTagEl(ch.classTag),
        e("span", { className: "text-sm font-medium text-ink truncate" }, ch.title)
      ),
      e(
        "div",
        { className: "flex items-center gap-1.5 shrink-0" },
        e(
          "button",
          {
            type: "button",
            onClick: () => setViewingFile({ title: ch.title, url: files[0].url }),
            className:
              "px-3 py-1.5 text-xs font-semibold rounded-md bg-teal/10 text-teal border border-teal/20",
          },
          "Read"
        ),
        e(
          "button",
          {
            type: "button",
            onClick: () => triggerDownload(files[0].url, ch.title),
            className:
              "px-2.5 py-1.5 text-xs font-semibold rounded-md bg-ink/5 text-ink/70 border border-ink/10",
          },
          "↓"
        )
      )
    );
  }

  function pdfModal() {
    if (!viewingFile) return null;
    const viewerSrc =
      "https://docs.google.com/viewer?url=" +
      encodeURIComponent(viewingFile.url) +
      "&embedded=true";

    return e(
      "div",
      {
        className:
          "fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col animate-in fade-in duration-200",
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
                "px-2.5 py-1 text-xs font-semibold rounded-md bg-marigold/10 text-marigold border border-marigold/30",
            },
            "Download"
          ),
          e(
            "a",
            {
              href: viewingFile.url,
              target: "_blank",
              rel: "noopener noreferrer",
              className:
                "px-2 py-1 text-xs font-medium rounded-md bg-ink/5 text-ink/70 border border-ink/10",
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
        { className: "flex-1 w-full bg-paper relative overflow-hidden" },
        e("iframe", {
          src: viewerSrc,
          title: viewingFile.title,
          className: "w-full h-full border-0",
          loading: "lazy",
        })
      )
    );
  }

  const nothing = chapterRows.length === 0 && subjectWide.length === 0;

  return e(
    "div",
    { className: "flex flex-col gap-3 mt-4" },
    subjectWide.length > 0
      ? expandable(
          FULL_SUBJECT_KEY,
          [e("span", { key: "t", className: "text-sm font-medium text-ink flex-1" }, "Full subject")],
          subjectWide
        )
      : null,
    chapterRows.map((row) =>
      isNcert
        ? ncertRow(row.ch, row.files)
        : expandable(
            row.ch.id,
            [
              classTagEl(row.ch.classTag),
              e("span", { key: "t", className: "text-sm font-medium text-ink flex-1" }, row.ch.title),
            ],
            row.files
          )
    ),
    nothing
      ? e("p", { className: "text-sm text-slate text-center py-8" }, "No files for this subject yet.")
      : null,
    pdfModal()
  );
}
