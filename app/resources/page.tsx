"use client";

import { useEffect, useState, createElement } from "react";
import { supabase, classLevelsForContent } from "@/lib/supabase";
import SubjectTabs from "@/components/library/SubjectTabs";
import ResourceChapterList, {
  RESOURCE_TYPES,
  Resource,
} from "@/components/resources/ResourceChapterList";
import BottomNav from "@/components/dashboard/BottomNav";

const e = createElement;

const RESOURCE_COLUMNS = "id, title, url, category, chapter_id, subject_id";

interface ChapterItem {
  id: string;
  title: string;
  classTag: string;
}

interface SubjectItem {
  id: string;
  name: string;
  subjectRowIds: string[];
  chapters: ChapterItem[];
}

export default function ResourcesPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("class_level, target_exam")
        .eq("uid", user.id)
        .maybeSingle();

      if (!profile?.class_level || !profile?.target_exam) {
        setLoading(false);
        return;
      }

      const classLevels = classLevelsForContent(profile.class_level as any);

      const { data: subjectRows } = await supabase
        .from("subjects")
        .select("id, name, class_level, display_order")
        .eq("target_exam", profile.target_exam)
        .in("class_level", classLevels)
        .order("display_order", { ascending: true });

      if (!subjectRows || subjectRows.length === 0) {
        if (!cancelled) {
          setSubjects([]);
          setLoading(false);
        }
        return;
      }

      const subjectRowIds = subjectRows.map((s) => s.id);

      const { data: chapterRows } = await supabase
        .from("chapters")
        .select("id, subject_id, title, display_order")
        .in("subject_id", subjectRowIds)
        .order("display_order", { ascending: true });

      const grouped = new Map<string, SubjectItem>();

      const sortedSubjectRows = [...subjectRows].sort((a, b) =>
        a.class_level < b.class_level ? -1 : a.class_level > b.class_level ? 1 : 0
      );

      for (const s of sortedSubjectRows) {
        const key = s.name;
        if (!grouped.has(key)) {
          grouped.set(key, { id: key, name: s.name, subjectRowIds: [], chapters: [] });
        }
        const entry = grouped.get(key)!;
        entry.subjectRowIds.push(s.id);
        const chaptersForThisRow = (chapterRows ?? [])
          .filter((c) => c.subject_id === s.id)
          .map((c) => ({
            id: c.id,
            title: c.title,
            classTag: s.class_level,
          }));
        entry.chapters.push(...chaptersForThisRow);
      }

      const finalSubjects = Array.from(grouped.values());

      // Fetch resources once, per subject (keeps each query's id list short),
      // so the type tiles can show accurate counts before any tap.
      const perSubject = await Promise.all(
        finalSubjects.map(async (s) => {
          const chapterIds = s.chapters.map((c) => c.id);
          const [chapterRes, bundleRes] = await Promise.all([
            chapterIds.length > 0
              ? supabase.from("resources").select(RESOURCE_COLUMNS).in("chapter_id", chapterIds)
              : Promise.resolve({ data: [] as Resource[] }),
            supabase
              .from("resources")
              .select(RESOURCE_COLUMNS)
              .in("subject_id", s.subjectRowIds)
              .is("chapter_id", null),
          ]);
          return [...(chapterRes.data ?? []), ...(bundleRes.data ?? [])] as Resource[];
        })
      );

      if (!cancelled) {
        setSubjects(finalSubjects);
        setActiveSubjectId(finalSubjects[0]?.id ?? null);
        setResources(perSubject.flat());
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
        e("h1", { className: "font-display text-2xl text-ink mb-4" }, "Resources"),
        e(
          "p",
          { className: "text-ink/60 text-sm" },
          "No subjects found yet for your class/exam. Check back soon."
        )
      ),
      e(BottomNav)
    );
  }

  const activeSubject = subjects.find((s) => s.id === activeSubjectId) ?? subjects[0];
  const activeTypeDef = RESOURCE_TYPES.find((t) => t.key === activeType) ?? null;

  function countForType(key: string) {
    return resources.filter((r) => r.category === key).length;
  }

  function renderTypeGrid() {
    return e(
      "div",
      null,
      e("h1", { className: "font-display text-2xl text-ink mb-1" }, "Resources"),
      e("p", { className: "text-slate text-sm mb-6" }, "Pick what you're looking for."),
      e(
        "div",
        { className: "grid grid-cols-3 gap-3" },
        RESOURCE_TYPES.map((t) => {
          const count = countForType(t.key);
          const available = count > 0;
          return e(
            "button",
            {
              key: t.key,
              onClick: () => setActiveType(t.key),
              disabled: !available,
              className: `flex flex-col items-center gap-2 rounded-ticket border p-3 text-center transition-transform ${
                available
                  ? "border-ink/10 bg-white active:scale-95"
                  : "border-ink/5 bg-ink/5 opacity-50"
              }`,
            },
            e(
              "span",
              {
                className:
                  "w-14 h-14 rounded-2xl bg-ink flex items-center justify-center text-2xl",
              },
              t.icon
            ),
            e("span", { className: "text-xs font-medium text-ink leading-tight" }, t.label),
            e(
              "span",
              { className: "text-[10px] text-slate" },
              available ? `${count} file${count === 1 ? "" : "s"}` : "Coming soon"
            )
          );
        })
      )
    );
  }

  function renderTypeView() {
    return e(
      "div",
      null,
      e(
        "button",
        { onClick: () => setActiveType(null), className: "text-sm text-slate mb-3" },
        "← All types"
      ),
      e(
        "h1",
        { className: "font-display text-2xl text-ink mb-4" },
        activeTypeDef ? activeTypeDef.label : ""
      ),
      e(SubjectTabs, {
        subjects,
        activeId: activeSubject.id,
        onChange: setActiveSubjectId,
      }),
      activeTypeDef
        ? e(ResourceChapterList, {
            key: activeSubject.id + activeTypeDef.key,
            chapters: activeSubject.chapters,
            subjectRowIds: activeSubject.subjectRowIds,
            category: activeTypeDef.key,
            resources,
          })
        : null
    );
  }

  return e(
    "div",
    { className: "min-h-screen bg-paper pb-28" },
    e(
      "div",
      { className: "max-w-md mx-auto px-5 pt-8" },
      activeTypeDef ? renderTypeView() : renderTypeGrid()
    ),
    e(BottomNav)
  );
}
