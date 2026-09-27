"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Chapter {
  id: string;
  title: string;
  classTag?: string;
}

interface Resource {
  id: string;
  title: string;
  url: string;
  category: string;
  chapter_id: string;
  subject_id: string | null;
}

interface ResourceChapterListProps {
  chapters: Chapter[];
  subjectRowIds: string[];
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: "ncert", label: "NCERT" },
  { key: "full_notes", label: "Notes" },
  { key: "short_notes", label: "Short Notes" },
  { key: "formula_sheet", label: "Formula Sheets" },
  { key: "pyq", label: "PYQs" },
  { key: "mock_test", label: "Mock Tests" },
];

export default function ResourceChapterList({ chapters, subjectRowIds }: ResourceChapterListProps) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingResources(true);
    setExpandedChapterId(null);
    setOpenCategory(null);

    async function load() {
      const chapterIds = chapters.map((c) => c.id);
      if (chapterIds.length === 0) {
        if (!cancelled) {
          setResources([]);
          setLoadingResources(false);
        }
        return;
      }

      const [{ data: chapterResources }, { data: subjectResources }] = await Promise.all([
        supabase.from("resources").select("id, title, url, category, chapter_id, subject_id").in("chapter_id", chapterIds),
        subjectRowIds.length > 0
          ? supabase.from("resources").select("id, title, url, category, chapter_id, subject_id").in("subject_id", subjectRowIds).is("chapter_id", null)
          : Promise.resolve({ data: [] as Resource[] }),
      ]);

      if (!cancelled) {
        setResources([...(chapterResources ?? []), ...(subjectResources ?? [])]);
        setLoadingResources(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [chapters, subjectRowIds]);

  function toggleChapter(chapterId: string) {
    setOpenCategory(null);
    setExpandedChapterId((prev) => (prev === chapterId ? null : chapterId));
  }

  function countFor(chapterId: string, category: string) {
    return resources.filter((r) => r.chapter_id === chapterId && r.category === category).length;
  }

  function subjectWideCountFor(category: string) {
    return resources.filter((r) => r.chapter_id === null && r.category === category).length;
  }

  return (
    <div className="flex flex-col gap-3 mt-4">
      {chapters.map((ch) => {
        const isExpanded = expandedChapterId === ch.id;
        return (
          <div
            key={ch.id}
            className="bg-white rounded-ticket border border-ink/10 overflow-hidden"
          >
            <button
              onClick={() => toggleChapter(ch.id)}
              className="w-full px-4 py-3 flex items-center gap-2 text-left"
            >
              {ch.classTag && (
                <span className="shrink-0 text-[10px] font-semibold text-ink/60 bg-ink/5 px-2 py-1 rounded-full">
                  {ch.classTag === "Dropper" ? "Dropper" : `Class ${ch.classTag}`}
                </span>
              )}
              <span className="text-sm font-medium text-ink flex-1">{ch.title}</span>
              <span className="text-ink/40 text-xs">{isExpanded ? "▲" : "▼"}</span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4">
                {loadingResources ? (
                  <p className="text-xs text-slate py-2">Loading…</p>
                ) : openCategory ? (
                  <div>
                    <button
                      onClick={() => setOpenCategory(null)}
                      className="text-xs text-teal font-medium mb-2"
                    >
                      ← Back
                    </button>
                    <div className="flex flex-col gap-2">
                      {resources
                        .filter(
                          (r) =>
                            r.category === openCategory &&
                            (r.chapter_id === ch.id || r.chapter_id === null)
                        )
                        .map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between bg-paper rounded-lg px-3 py-2 border border-ink/5"
                          >
                            <span className="text-xs text-ink">{r.title}</span>
                            <div className="flex gap-2 shrink-0">
                              
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-semibold text-teal"
                              >
                                View
                              </a>
                              
                                href={r.url}
                                download
                                className="text-[11px] font-semibold text-marigold"
                              >
                                Download
                              </a>
                            </div>
                          </div>
                        ))}
                      {resources.filter(
                        (r) =>
                          r.category === openCategory &&
                          (r.chapter_id === ch.id || r.chapter_id === null)
                      ).length === 0 && (
                        <p className="text-xs text-slate py-2">No resources yet.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map((cat) => {
                      const count = countFor(ch.id, cat.key) + subjectWideCountFor(cat.key);
                      return (
                        <button
                          key={cat.key}
                          onClick={() => setOpenCategory(cat.key)}
                          disabled={count === 0}
                          className={`text-xs font-medium py-2 rounded-lg border ${
                            count > 0
                              ? "border-teal/30 bg-teal/10 text-teal"
                              : "border-ink/10 bg-ink/5 text-ink/30"
                          }`}
                        >
                          {cat.label} {count > 0 ? `(${count})` : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {chapters.length === 0 && (
        <p className="text-sm text-slate text-center py-8">No chapters yet.</p>
      )}
    </div>
  );
                            }
