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
          .select("chapter_id, status")
          .eq("user_id", user.id),
      ]);

      const progressMap = new Map<string, ProgressStatus>(
        (progressRows ?? []).map((p) => [p.chapter_id, p.status as ProgressStatus])
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
          .map((c) => ({
            id: c.id,
            title: c.title,
            isToughTopic: c.is_tough_topic,
            classTag: s.class_level,
            inCompetitiveSyllabus: c.in_competitive_syllabus,
            jeeScope: (c.jee_scope ?? "common") as "common" | "advanced_only",
            neetScope: (c.neet_scope ?? "common") as "common" | "neet_only",
            progressStatus: progressMap.get(c.id) ?? "not_started",
          }));
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

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-ink/60 text-sm">Loading your library…</p>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="min-h-screen bg-paper pb-28">
        <div className="max-w-md mx-auto px-5 pt-8">
          <h1 className="font-display text-2xl text-ink mb-4">Library</h1>
          <p className="text-ink/60 text-sm">
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
    <div className="min-h-screen bg-paper pb-28">
      <div className="max-w-md mx-auto px-5 pt-8">
        <h1 className="font-display text-2xl text-ink mb-4">Library</h1>

        <SubjectTabs
          subjects={subjects}
          activeId={activeSubject.id}
          onChange={setActiveSubjectId}
        />

        <ChapterList
          key={activeSubject.id}
          subjectId={activeSubject.id}
          chapters={activeSubject.chapters}
          targetExam={targetExam}
          onProgressChange={handleProgressChange}
        />
      </div>

      <BottomNav />
    </div>
  );
}
