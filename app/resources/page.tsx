"use client";

import { useEffect, useState } from "react";
import { supabase, classLevelsForContent } from "@/lib/supabase";
import SubjectTabs from "@/components/library/SubjectTabs";
import ResourceChapterList from "@/components/resources/ResourceChapterList";
import BottomNav from "@/components/dashboard/BottomNav";

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

      if (!cancelled) {
        setSubjects(finalSubjects);
        setActiveSubjectId(finalSubjects[0]?.id ?? null);
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
        <p className="text-ink/60 text-sm">Loading resources…</p>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="min-h-screen bg-paper pb-28">
        <div className="max-w-md mx-auto px-5 pt-8">
          <h1 className="font-display text-2xl text-ink mb-4">Resources</h1>
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
        <h1 className="font-display text-2xl text-ink mb-4">Resources</h1>

        <SubjectTabs
          subjects={subjects}
          activeId={activeSubject.id}
          onChange={setActiveSubjectId}
        />

        <ResourceChapterList
          key={activeSubject.id}
          chapters={activeSubject.chapters}
          subjectRowIds={activeSubject.subjectRowIds}
        />
      </div>

      <BottomNav />
    </div>
  );
        }
