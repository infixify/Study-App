// app/library/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase, classLevelsForContent } from "@/lib/supabase";
import SubjectTabs from "@/components/library/SubjectTabs";
import ChapterList from "@/components/library/ChapterList";
import BottomNav from "@/components/dashboard/BottomNav";

type ProgressStatus = "not_started" | "in_progress" | "done";

interface ChapterItem {
  id: string;
  title: string;
  isToughTopic: boolean;
  classTag: string;
  inCompetitiveSyllabus: boolean;
  jeeScope: "common" | "advanced_only";
  neetScope: "common" | "neet_only";
  progressStatus: ProgressStatus;
  isBacklog: boolean;
}

interface SubjectItem {
  id: string;
  name: string;
  chapters: ChapterItem[];
}

export default function LibraryPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [targetExam, setTargetExam] = useState<string | null>(null);
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
          setTargetExam(profile.target_exam);
          setLoading(false);
        }
        return;
      }

      const subjectRowIds = subjectRows.map((s) => s.id);

      const [{ data: chapterRows }, { data: progressRows }] = await Promise.all([
        supabase
          .from("chapters")
          .select("id, subject_id, title, is_tough_topic, display_order, in_competitive_syllabus, jee_scope, neet_scope")
          .in("subject_id", subjectRowIds)
          .order("display_order", { ascending: true }),
        supabase
          .from("chapter_progress")
          .select("chapter_id, status, is_backlog")
          .eq("user_id", user.id),
      ]);

      const progressMap = new Map<string, { status: ProgressStatus; isBacklog: boolean }>(
        (progressRows ?? []).map((p) => [
          p.chapter_id,
          { status: p.status as ProgressStatus, isBacklog: p.is_backlog ?? false },
        ])
      );

      const grouped = new Map<string, SubjectItem>();
      const sortedSubjectRows = [...subjectRows].sort((a, b) =>
        a.class_level < b.class_level ? -1 : a.class_level > b.class_level ? 1 : 0
      );

      for (const s of sortedSubjectRows) {
        const key = s.name;
        if (!grouped.has(key)) {
          grouped.set(key, { id: key, name: s.name, chapters: [] });
        }
        const entry = grouped.get(key)!;
        const chaptersForThisRow = (chapterRows ?? [])
          .filter((c) => c.subject_id === s.id)
          .filter((c) => {
            if (s.class_level !== "Dropper") return true;
            return c.in_competitive_syllabus !== false;
          })
          .map((c) => {
            const prog = progressMap.get(c.id);
            return {
              id: c.id,
              title: c.title,
              isToughTopic: c.is_tough_topic,
              classTag: s.class_level,
              inCompetitiveSyllabus: c.in_competitive_syllabus,
              jeeScope: (c.jee_scope ?? "common") as "common" | "advanced_only",
              neetScope: (c.neet_scope ?? "common") as "common" | "neet_only",
              progressStatus: prog?.status ?? "not_started",
              isBacklog: prog?.isBacklog ?? false,
            };
          });
        entry.chapters.push(...chaptersForThisRow);
      }

      const finalSubjects = Array.from(grouped.values());
      if (!cancelled) {
        setSubjects(finalSubjects);
        setActiveSubjectId(finalSubjects[0]?.id ?? null);
        setTargetExam(profile.target_exam);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleProgressChange(chapterId: string, status: ProgressStatus) {
    setSubjects((prev) =>
      prev.map((subj) => ({
        ...subj,
        chapters: subj.chapters.map((ch) =>
          ch.id === chapterId ? { ...ch, progressStatus: status } : ch
        ),
      }))
    );
  }

  function handleBacklogToggle(chapterId: string, isBacklog: boolean) {
    setSubjects((prev) =>
      prev.map((subj) => ({
        ...subj,
        chapters: subj.chapters.map((ch) =>
          ch.id === chapterId ? { ...ch, isBacklog } : ch
        ),
      }))
    );
  }

  function getSubjectStats(subj: SubjectItem) {
    const total = subj.chapters.length;
    const done = subj.chapters.filter((c) => c.progressStatus === "done").length;
    const backlogs = subj.chapters.filter((c) => c.isBacklog).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, backlogs, pct };
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090E17] flex items-center justify-center">
        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold animate-pulse">
          Loading syllabus tracker…
        </p>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090E17] pb-28">
        <div className="max-w-md mx-auto px-5 pt-8">
          <h1 className="font-display text-2xl font-black text-slate-900 dark:text-white mb-2">
            Syllabus
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs">
            No subjects found yet for your class/exam. Check back soon.
          </p>
        </div>
        <BottomNav />
      </div>
    );
  }

  const activeSubject =
    subjects.find((s) => s.id === activeSubjectId) ?? subjects[0];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090E17] text-slate-900 dark:text-slate-100 pb-28">
      <div className="max-w-md mx-auto px-5 pt-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Syllabus
          </h1>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
            Chapter tracker & backlogs
          </span>
        </div>

        {/* Subject Pills (Physics / Chemistry / Maths) */}
        <SubjectTabs
          subjects={subjects}
          activeId={activeSubject.id}
          onChange={setActiveSubjectId}
        />

        {/* Subject Progress Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 mb-2">
          {subjects.map((subj) => {
            const { done, total, backlogs, pct } = getSubjectStats(subj);
            return (
              <div
                key={subj.id}
                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121A29] p-3 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {subj.name}
                  </p>
                  {backlogs > 0 && (
                    <span className="text-[9.5px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 px-1.5 py-0.5 rounded-full">
                      {backlogs} bl
                    </span>
                  )}
                </div>

                <div className="w-full h-1.5 bg-slate-100 dark:bg-white/10 rounded-full mt-2.5 overflow-hidden">
                  <div
                    className="h-full bg-teal transition-all duration-300 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                  {done}/{total} done ({pct}%)
                </p>
              </div>
            );
          })}
        </div>

        {/* Chapters List with Status, Revision & Practice Tracking */}
        <ChapterList
          key={activeSubject.id}
          subjectId={activeSubject.id}
          chapters={activeSubject.chapters}
          targetExam={targetExam || undefined}
          onProgressChange={handleProgressChange}
          onBacklogToggle={handleBacklogToggle}
        />
      </div>
      <BottomNav />
    </div>
  );
}
