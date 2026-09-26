"use client";

import { useEffect, useState } from "react";
import { supabase, classLevelsForContent } from "@/lib/supabase";
import SubjectTabs from "@/components/library/SubjectTabs";
import ChapterList from "@/components/library/ChapterList";
import BottomNav from "@/components/dashboard/BottomNav";

interface ChapterItem {
  id: string;
  title: string;
  isToughTopic: boolean;
}

interface SubjectItem {
  id: string;
  name: string;
  chapters: ChapterItem[];
}

export default function LibraryPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
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
        .select("id, name, display_order")
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

      const subjectIds = subjectRows.map((s) => s.id);

      const { data: chapterRows } = await supabase
        .from("chapters")
        .select("id, subject_id, title, is_tough_topic, display_order")
        .in("subject_id", subjectIds)
        .order("display_order", { ascending: true });

      const bySubject: SubjectItem[] = subjectRows.map((s) => ({
        id: s.id,
        name: s.name,
        chapters: (chapterRows ?? [])
          .filter((c) => c.subject_id === s.id)
          .map((c) => ({
            id: c.id,
            title: c.title,
            isToughTopic: c.is_tough_topic,
          })),
      }));

      if (!cancelled) {
        setSubjects(bySubject);
        setActiveSubjectId(bySubject[0]?.id ?? null);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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

        {/* key={activeSubject.id} forces a clean remount per subject —
            this is what fixed the tab-switching bug earlier */}
        <ChapterList
          key={activeSubject.id}
          subjectId={activeSubject.id}
          chapters={activeSubject.chapters}
        />
      </div>

      <BottomNav />
    </div>
  );
}
