"use client";

import { useState, createElement } from "react";

const e = createElement;

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

interface Chapter {
  id: string;
  title: string;
  classTag?: string;
}

interface ResourceChapterListProps {
  chapters: Chapter[];
  subjectRowIds: string[];
  category: string;
  resources: Resource[];
}

export default function ResourceChapterList({
  chapters,
  subjectRowIds,
  category,
  resources,
}: ResourceChapterListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const typeLabel = RESOURCE_TYPES.find((t) => t.key === category)?.label ?? "resources";

  // Subject-wide combined bundles for this type (chapter_id is null).
  const bundles = resources.filter(
    (r) =>
      r.chapter_id === null &&
      r.category === category &&
      r.subject_id !== null &&
      subjectRowIds.includes(r.subject_id)
  );

  // Only chapters that actually have a file of this type.
  const chaptersWithFiles = chapters
    .map((ch) => ({
      ch,
      rows: resources.filter((r) => r.chapter_id === ch.id && r.category === category),
    }))
    .filter((x) => x.rows.length > 0);

  function renderResourceRow(r: Resource) {
    return e(
      "div",
      {
        key: r.id,
        className:
          "flex items-center justify-between bg-paper rounded-lg px-3 py-2 border border-ink/5",
      },
      e("span", { className: "text-xs text-ink pr-2" }, r.title),
      e(
        "div",
        { className: "flex gap-3 shrink-0" },
        e(
          "a",
          {
            href: r.url,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-[11px] font-semibold text-teal",
          },
          "View"
        ),
        e(
          "a",
          {
            href: r.url,
            download: true,
            className: "text-[11px] font-semibold text-marigold",
          },
          "Download"
        )
      )
    );
  }

  function renderBundles() {
    if (bundles.length === 0) return null;
    return e(
      "div",
      { className: "bg-white rounded-ticket border border-marigold/40 p-4" },
      e("p", { className: "text-xs font-semibold text-ink mb-2" }, "Full subject"),
      e("div", { className: "flex flex-col gap-2" }, bundles.map(renderResourceRow))
    );
  }

  function renderChapter(item: { ch: Chapter; rows: Resource[] }) {
    const { ch, rows } = item;
    const isExpanded = expandedId === ch.id;
    return e(
      "div",
      { key: ch.id, className: "bg-white rounded-ticket border border-ink/10 overflow-hidden" },
      e(
        "button",
        {
          onClick: () => setExpandedId(isExpanded ? null : ch.id),
          className: "w-full px-4 py-3 flex items-center gap-2 text-left",
        },
        ch.classTag
          ? e(
              "span",
              {
                className:
                  "shrink-0 text-[10px] font-semibold text-ink/60 bg-ink/5 px-2 py-1 rounded-full",
              },
              ch.classTag === "Dropper" ? "Dropper" : `Class ${ch.classTag}`
            )
          : null,
        e("span", { className: "text-sm font-medium text-ink flex-1" }, ch.title),
        e(
          "span",
          { className: "shrink-0 text-[10px] font-semibold text-teal bg-teal/10 px-2 py-1 rounded-full" },
          `${rows.length}`
        ),
        e("span", { className: "text-ink/40 text-xs" }, isExpanded ? "▲" : "▼")
      ),
      isExpanded
        ? e(
            "div",
            { className: "px-4 pb-4 flex flex-col gap-2" },
            rows.map(renderResourceRow)
          )
        : null
    );
  }

  if (bundles.length === 0 && chaptersWithFiles.length === 0) {
    return e(
      "p",
      { className: "text-sm text-slate text-center py-10" },
      `No ${typeLabel} added for this subject yet.`
    );
  }

  return e(
    "div",
    { className: "flex flex-col gap-3 mt-4" },
    renderBundles(),
    chaptersWithFiles.map(renderChapter)
  );
}
