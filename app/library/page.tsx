"use client";

import { useState } from "react";
import SubjectTabs from "@/components/library/SubjectTabs";
import ChapterList from "@/components/library/ChapterList";
import BottomNav from "@/components/dashboard/BottomNav";

// Mock data — matches the shape of `subjects`/`chapters` in schema.sql.
// Replace with a real Supabase query once lib/supabase.ts has a real client:
//   supabase.from("subjects").select("*").eq("target_exam", ...).in("class_level", classLevelsForContent(...))
//   supabase.from("chapters").select("*").eq("subject_id", activeSubjectId)
const MOCK_SUBJECTS = [
  {
    id: "phy",
    name: "Physics",
    chapters: [
      { id: "p1", title: "Kinematics", isToughTopic: false },
      { id: "p2", title: "Laws of Motion", isToughTopic: false },
      { id: "p3", title: "Work, Energy & Power", isToughTopic: true },
      { id: "p4", title: "Rotational Motion", isToughTopic: true },
    ],
  },
  {
    id: "chem",
    name: "Chemistry",
    chapters: [
      { id: "c1", title: "Mole Concept", isToughTopic: false },
      { id: "c2", title: "Chemical Bonding", isToughTopic: true },
      { id: "c3", title: "Equilibrium", isToughTopic: true },
    ],
  },
  {
    id: "math",
    name: "Maths",
    chapters: [
      { id: "m1", title: "Trigonometry", isToughTopic: true },
      { id: "m2", title: "Straight Lines", isToughTopic: false },
      { id: "m3", title: "Calculus Basics", isToughTopic: true },
    ],
  },
];

export default function LibraryPage() {
  const [activeSubjectId, setActiveSubjectId] = useState(MOCK_SUBJECTS[0].id);

  const activeSubject =
    MOCK_SUBJECTS.find((s) => s.id === activeSubjectId) ?? MOCK_SUBJECTS[0];

  return (
    <div className="min-h-screen bg-paper pb-28">
      <div className="max-w-md mx-auto px-5 pt-8">
        <h1 className="font-display text-2xl text-ink mb-4">Library</h1>

        <SubjectTabs
          subjects={MOCK_SUBJECTS}
          activeId={activeSubjectId}
          onChange={setActiveSubjectId}
        />

        {/* key={activeSubject.id} forces a clean remount per subject —
            this is what was missing before and caused the switching bug */}
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
