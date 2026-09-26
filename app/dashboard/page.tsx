"use client";

import { useState } from "react";
import GreetingHeader from "@/components/dashboard/GreetingHeader";
import CountdownCard from "@/components/dashboard/CountdownCard";
import StudyTimeTracker from "@/components/dashboard/StudyTimeTracker";
import TaskWidget from "@/components/dashboard/TaskWidget";
import AnalyticsRadar from "@/components/dashboard/AnalyticsRadar";
import BottomNav from "@/components/dashboard/BottomNav";
import AiChatSheet from "@/components/dashboard/AiChatSheet";

// Mock user/profile data — replace with a real query against `users`,
// `daily_logs`, `tasks`, and `test_attempts` once wired to Supabase.
const MOCK_STATE = {
  name: "Aarav",
  streak: 12,
  targetExam: "JEE" as const,
  examDate: "2027-01-24", // JEE Mains Jan session
  studiedMinutesToday: 165,
  targetMinutesToday: 240,
  tasks: [
    { id: "1", title: "Rotational Motion — PYQs (Ch. 9)", type: "todo" as const, done: false },
    { id: "2", title: "Organic Chem: Name reactions revision", type: "todo" as const, done: false },
    { id: "3", title: "Mock Test #14 — review mistakes", type: "backlog" as const, done: false },
    { id: "4", title: "Vectors — 3D geometry problems", type: "backlog" as const, done: false },
  ],
  accuracy: 74,
  consistency: 82,
};

export default function DashboardPage() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper pb-28">
      <div className="max-w-md mx-auto px-5 pt-8">
        <GreetingHeader name={MOCK_STATE.name} streak={MOCK_STATE.streak} />

        <CountdownCard examDate={MOCK_STATE.examDate} examLabel="JEE Mains" />

        <StudyTimeTracker
          studiedMinutes={MOCK_STATE.studiedMinutesToday}
          targetMinutes={MOCK_STATE.targetMinutesToday}
        />

        <TaskWidget tasks={MOCK_STATE.tasks} />

        <AnalyticsRadar
          accuracy={MOCK_STATE.accuracy}
          consistency={MOCK_STATE.consistency}
        />
      </div>

      {/* Module 5: Universal Helper AI */}
      <button
        onClick={() => setChatOpen(true)}
        aria-label="Open AI study mentor"
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-ink text-paper shadow-lg shadow-ink/20 flex items-center justify-center text-xl hover:scale-105 active:scale-95 transition-transform z-30"
      >
        ✨
      </button>

      <AiChatSheet open={chatOpen} onClose={() => setChatOpen(false)} />

      <BottomNav />
    </div>
  );
}
