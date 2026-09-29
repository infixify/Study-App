"use client";

import { createElement as e, useEffect, useState } from "react";
import { supabase, classLevelsForContent } from "@/lib/supabase";
import SubjectTabs from "@/components/library/SubjectTabs";
import BottomNav from "@/components/dashboard/BottomNav";
import ResourceChapterList, { RESOURCE_TYPES } from "@/components/resources/ResourceChapterList";
import type { ChapterItem, Resource } from "@/components/resources/ResourceChapterList";

interface SubjectItem {
  id: string;
  name: string;
  subjectRowIds: string[];
  chapters: ChapterItem[];
}

export default function ResourcesPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("class_level, target_exam")
        .eq("uid", user.id)
        .maybeSingle();

      if (!profile?.class_level || !profile?.target_exam) {
        if (!cancelled) setLoading(false);
        return;
      }

      const classLevels = classLevelsForContent(profile.class_level as any);

      const { data: subjectData } = await supabase
        .from("subjects")
        .select("id, name, class_level, display_order")
        .eq("target_exam", profile.target_exam)
        .in("class_level", classLevels)
        .order("display_order", { ascending: true });

      const subjectRows: any[] = subjectData ?? [];

      if (subjectRows.length === 0) {
        if (!cancelled) {
          setSubjects([]);
          setLoading(false);
        }
        return;
      }

      const subjectRowIds: string[] = subjectRows.map((s) => s.id);

      const [chapterRes, chapterResourceRes, subjectResourceRes] = await Promise.all([
        supabase
          .from("chapters")
          .select("id, subject_id, title, display_order, in_competitive_syllabus")
          .in("subject_id", subjectRowIds)
          .order("display_order", { ascending: true }),
        supabase
          .from("resources")
          .select("id, title, url, category, chapter_id, subject_id, display_order, chapters!inner(subject_id)")
          .in("chapters.subject_id", subjectRowIds)
          .order("display_order", { ascending: true }),
        supabase
          .from("resources")
          .select("id, title, url, category, chapter_id, subject_id, display_order")
          .in("subject_id", subjectRowIds)
          .is("chapter_id", null)
          .order("display_order", { ascending: true }),
      ]);

      const chapterRows: any[] = chapterRes.data ?? [];
      const allResources: Resource[] = [
        ...((chapterResourceRes.data ?? []) as any[]),
        ...((subjectResourceRes.data ?? []) as any[]),
      ].map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        category: r.category,
        chapter_id: r.chapter_id ?? null,
        subject_id: r.subject_id ?? null,
      }));

      const grouped = new Map<string, SubjectItem>();
      const sortedSubjectRows = [...subjectRows].sort((a, b) =>
        a.class_level < b.class_level ? -1 : a.class_level > b.class_level ? 1 : 0
      );

      for (const s of sortedSubjectRows) {
        if (!grouped.has(s.name)) {
          grouped.set(s.name, { id: s.name, name: s.name, subjectRowIds: [], chapters: [] });
        }
        const entry = grouped.get(s.name)!;
        entry.subjectRowIds.push(s.id);
        const chaptersForRow: ChapterItem[] = chapterRows
          .filter((c) => c.subject_id === s.id)
          .filter((c) => {
            if (s.class_level !== "Dropper") return true;
            return c.in_competitive_syllabus !== false;
          })
          .map((c) => ({ id: c.id, title: c.title, classTag: s.class_level }));
        entry.chapters.push(...chaptersForRow);
      }

      if (!cancelled) {
        setSubjects(Array.from(grouped.values()));
        setResources(allResources);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function subjectHasFiles(subj: SubjectItem, category: string): boolean {
    return resources.some(
      (r) =>
        r.category === category &&
        ((r.chapter_id !== null && subj.chapters.some((c) => c.id === r.chapter_id)) ||
          (r.chapter_id === null &&
            r.subject_id !== null &&
            subj.subjectRowIds.indexOf(r.subject_id) !== -1))
    );
  }

  function openType(key: string) {
    const firstWithFiles = subjects.find((s) => subjectHasFiles(s, key));
    setActiveSubjectId((firstWithFiles ?? subjects[0]).id);
    setActiveType(key);
  }

  if (loading) {
    return e(
      "div",
      { className: "min-h-screen bg-paper flex items-center justify-center" },
      e("p", { className: "text-ink/60 text-sm" }, "Loading resources…")
    );
  }

  if (subjects.length === 0) {
    return e(
      "div",
      { className: "min-h-screen bg-paper pb-28" },
      e(
        "div",
        { className: "max-w-md mx-auto px-5 pt-8" },
        e("h1", { className: "font-display text-3xl text-ink mb-2" }, "Resources"),
        e("p", { className: "text-ink/60 text-sm" }, "No subjects found yet for your class/exam. Check back soon.")
      ),
      e(BottomNav)
    );
  }

  const activeTypeDef = RESOURCE_TYPES.find((t) => t.key === activeType);
  const activeSubject = subjects.find((s) => s.id === activeSubjectId) ?? subjects[0];

  let body;

  if (!activeTypeDef) {
    body = e(
      "div",
      null,
      e("h1", { className: "font-display text-3xl text-ink mb-1" }, "Resources"),
      e("p", { className: "text-slate text-sm mb-6" }, "Pick what you're looking for."),
      e(
        "div",
        { className: "grid grid-cols-3 gap-3" },
        RESOURCE_TYPES.map((t) => {
          const has = resources.some((r) => r.category === t.key);
          return e(
            "button",
            {
              key: t.key,
              disabled: !has,
              onClick: () => openType(t.key),
              className: has
                ? "bg-white rounded-ticket border border-ink/10 p-3 flex flex-col items-center gap-2 text-center"
                : "bg-ink/5 rounded-ticket border border-ink/5 p-3 flex flex-col items-center gap-2 text-center opacity-70",
            },
            e(
              "div",
              {
                className:
                  "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl " +
                  (has ? "bg-ink" : "bg-ink/40"),
              },
              t.icon
            ),
            e("span", { className: "text-xs font-medium " + (has ? "text-ink" : "text-ink/50") }, t.label),
            has ? null : e("span", { className: "text-[10px] text-ink/30" }, "Coming soon")
          );
        })
      )
    );
  } else {
    body = e(
      "div",
      null,
      e(
        "button",
        { onClick: () => setActiveType(null), className: "text-sm text-slate mb-3" },
        "← All types"
      ),
      e("h1", { className: "font-display text-3xl text-ink mb-4" }, activeTypeDef.label),
      e(SubjectTabs, {
        subjects: subjects,
        activeId: activeSubject.id,
        onChange: setActiveSubjectId,
      }),
      e(ResourceChapterList, {
        key: activeSubject.id + "-" + activeTypeDef.key,
        chapters: activeSubject.chapters,
        subjectRowIds: activeSubject.subjectRowIds,
        category: activeTypeDef.key,
        resources: resources,
      })
    );
  }

  return e(
    "div",
    { className: "min-h-screen bg-paper pb-28" },
    e("div", { className: "max-w-md mx-auto px-5 pt-8" }, body),
    e(BottomNav)
  );
}
