"use client";

import { createElement as e, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface BacklogItem {
  chapterId: string;
  chapterTitle: string;
  subjectName: string;
}

export function BacklogRadar({ userId }: { userId: string }) {
  const [backlogs, setBacklogs] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBacklogs() {
      if (!userId) return;
      try {
        const { data } = await supabase
          .from("chapter_progress")
          .select("chapter_id, chapters(title, subjects(name))")
          .eq("user_id", userId)
          .eq("is_backlog", true);

        if (data) {
          const mapped: BacklogItem[] = data
            .filter((d: any) => d.chapters)
            .map((d: any) => ({
              chapterId: d.chapter_id,
              chapterTitle: d.chapters.title,
              subjectName: d.chapters.subjects?.name || "General",
            }));
          setBacklogs(mapped);
        }
      } catch (e) {
        console.error("Backlog load error:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchBacklogs();
  }, [userId]);

  if (loading || backlogs.length === 0) {
    // Agar koi backlog nahi hai toh clean congratulations message
    return e(
      "div",
      { className: "w-full p-4 bg-emerald-50/60 border border-emerald-200/70 rounded-2xl flex items-center justify-between" },
      e(
        "div",
        { className: "flex items-center gap-3" },
        e("div", { className: "w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-lg font-bold" }, "✓"),
        e(
          "div",
          null,
          e("h4", { className: "text-xs font-bold text-emerald-900" }, "Zero Backlogs!"),
          e("p", { className: "text-[11px] text-emerald-700" }, "You are on track with your coaching syllabus.")
        )
      ),
      e(
        "a",
        { href: "/resources", className: "text-[11px] font-bold text-emerald-700 hover:underline" },
        "Syllabus →"
      )
    );
  }

  return e(
    "div",
    { className: "w-full p-5 bg-white border border-rose-200/80 rounded-2xl shadow-sm flex flex-col gap-3" },
    e(
      "div",
      { className: "flex items-center justify-between" },
      e(
        "div",
        { className: "flex items-center gap-2" },
        e("span", { className: "flex h-2.5 w-2.5 relative" },
          e("span", { className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" }),
          e("span", { className: "relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" })
        ),
        e("h3", { className: "text-sm font-bold text-ink" }, "Backlog Radar"),
        e("span", { className: "px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700" }, backlogs.length + " pending")
      ),
      e("a", { href: "/resources", className: "text-xs font-bold text-teal hover:underline" }, "Clear in Library →")
    ),

    // List of backlogs
    e(
      "div",
      { className: "flex flex-col gap-1.5" },
      backlogs.slice(0, 3).map((b) =>
        e(
          "div",
          { key: b.chapterId, className: "flex items-center justify-between p-2 rounded-xl bg-paper/60 border border-ink/5" },
          e(
            "div",
            { className: "flex items-center gap-2 overflow-hidden pr-2" },
            e("span", { className: "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-ink/10 text-slate" }, b.subjectName),
            e("span", { className: "text-xs font-semibold text-ink truncate" }, b.chapterTitle)
          ),
          e("span", { className: "text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full whitespace-nowrap" }, "Backlog")
        )
      ),
      backlogs.length > 3
        ? e("p", { className: "text-[11px] text-slate text-center pt-1" }, "+" + (backlogs.length - 3) + " more backlogs pending")
        : null
    )
  );
}
