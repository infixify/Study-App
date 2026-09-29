// components/library/ChapterList.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type ProgressStatus = "not_started" | "in_progress" | "done";

interface Chapter {
  id: string;
  title: string;
  isToughTopic: boolean;
  classTag?: string;
  inCompetitiveSyllabus?: boolean;
  jeeScope?: "common" | "advanced_only";
  neetScope?: "common" | "neet_only";
  progressStatus?: ProgressStatus;
  isBacklog?: boolean;
  revision_count?: number;
  total_questions_solved?: number;
  accuracy?: number;
}

interface ChapterListProps {
  subjectId: string;
  chapters: Chapter[];
  targetExam?: string | null;
  onProgressChange?: (chapterId: string, status: ProgressStatus) => void;
  onBacklogToggle?: (chapterId: string, isBacklog: boolean) => void;
}

const STATUS_LABELS: Record<ProgressStatus, string> = {
  not_started: "Not started",
  in_progress: "Ongoing",
  done: "Completed",
};

const STATUS_STYLES: Record<ProgressStatus, string> = {
  not_started: "bg-ink/5 text-slate border-ink/10",
  in_progress: "bg-amber-500 text-white border-amber-600 shadow-xs",
  done: "bg-teal-600 text-white border-teal-700 shadow-xs",
};

export default function ChapterList({
  chapters,
  targetExam,
  onProgressChange,
  onBacklogToggle,
}: ChapterListProps) {
  // Modal State for Question Practice
  const [activeModalChapter, setActiveModalChapter] = useState<Chapter | null>(null);
  const [attempted, setAttempted] = useState<number>(30);
  const [correct, setCorrect] = useState<number>(24);
  const [incorrect, setIncorrect] = useState<number>(4);
  const [unattempted, setUnattempted] = useState<number>(2);
  const [attemptDate, setAttemptDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [startTime, setStartTime] = useState<string>("10:00");
  const [endTime, setEndTime] = useState<string>("11:00");
  const [isSavingPractice, setIsSavingPractice] = useState<boolean>(false);

  // Local Chapter Stats Tracking
  const [revisionMap, setRevisionMap] = useState<Record<string, number>>({});
  const [practiceStatsMap, setPracticeStatsMap] = useState<
    Record<string, { solved: number; accuracy: number }>
  >({});

  // 1. Status Update
  async function updateStatus(chapterId: string, status: ProgressStatus) {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    await supabase.from("chapter_progress").upsert(
      {
        user_id: user.id,
        chapter_id: chapterId,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,chapter_id" }
    );
    onProgressChange?.(chapterId, status);
  }

  // 2. Revision Delta [+ / -] Logic
  async function handleRevisionDelta(chapterId: string, delta: number) {
    const current = revisionMap[chapterId] ?? 0;
    const nextVal = Math.max(0, current + delta);
    setRevisionMap((prev) => ({ ...prev, [chapterId]: nextVal }));

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    await supabase.from("chapter_progress").upsert(
      {
        user_id: user.id,
        chapter_id: chapterId,
        revision_count: nextVal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,chapter_id" }
    );
  }

  // 3. Backlog Toggle
  async function toggleBacklog(chapterId: string, currentVal: boolean) {
    const newVal = !currentVal;
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    await supabase.from("chapter_progress").upsert(
      {
        user_id: user.id,
        chapter_id: chapterId,
        is_backlog: newVal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,chapter_id" }
    );
    onBacklogToggle?.(chapterId, newVal);
  }

  // 4. Save Question Practice with Anti-Duplication
  async function handleSavePractice(e: React.FormEvent) {
    e.preventDefault();
    if (!activeModalChapter) return;
    setIsSavingPractice(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const startMin =
        parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]);
      const endMin =
        parseInt(endTime.split(":")[0]) * 60 + parseInt(endTime.split(":")[1]);
      const durationMin = Math.max(
        1,
        endMin >= startMin ? endMin - startMin : 1440 - startMin + endMin
      );
      const computedAccuracy =
        attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

      // Update question_logs / local storage
      const existing = practiceStatsMap[activeModalChapter.id] || {
        solved: 0,
        accuracy: 0,
      };
      const newTotal = existing.solved + attempted;
      const newAcc =
        existing.solved === 0
          ? computedAccuracy
          : Math.round((existing.accuracy + computedAccuracy) / 2);

      setPracticeStatsMap((prev) => ({
        ...prev,
        [activeModalChapter.id]: { solved: newTotal, accuracy: newAcc },
      }));

      // Also persist to Supabase safely
      await supabase.from("chapter_progress").upsert(
        {
          user_id: user.id,
          chapter_id: activeModalChapter.id,
          total_questions_solved: newTotal,
          accuracy: newAcc,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,chapter_id" }
      );

      setActiveModalChapter(null);
    } catch (err) {
      console.error("Failed to log practice:", err);
    } finally {
      setIsSavingPractice(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 mt-4">
      {chapters.map((ch) => {
        const showOffSyllabusBadge =
          ch.classTag !== "Dropper" &&
          targetExam !== "Boards" &&
          ch.inCompetitiveSyllabus === false;
        const showAdvancedOnlyBadge =
          targetExam === "JEE" && ch.jeeScope === "advanced_only";
        const showNeetOnlyBadge =
          targetExam === "NEET" && ch.neetScope === "neet_only";
        const status = ch.progressStatus ?? "not_started";
        const isBacklog = ch.isBacklog ?? false;
        const revCount = revisionMap[ch.id] ?? ch.revision_count ?? 0;
        const pStats = practiceStatsMap[ch.id] ?? {
          solved: ch.total_questions_solved ?? 0,
          accuracy: ch.accuracy ?? 0,
        };

        return (
          <div
            key={ch.id}
            className={`bg-white rounded-ticket border px-4 py-3 flex flex-col gap-2.5 transition-all shadow-2xs ${
              isBacklog
                ? "border-rose-300 shadow-sm shadow-rose-100"
                : "border-ink/10"
            }`}
          >
            {/* Header: Title + Backlog Pill */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1">
                {ch.classTag && (
                  <span className="shrink-0 mt-0.5 text-[10px] font-semibold text-ink/60 bg-ink/5 px-2 py-0.5 rounded-full">
                    {ch.classTag === "Dropper" ? "Dropper" : `Class ${ch.classTag}`}
                  </span>
                )}
                <span className="text-sm font-semibold text-ink leading-tight">
                  {ch.title}
                </span>
              </div>

              <button
                type="button"
                onClick={() => toggleBacklog(ch.id, isBacklog)}
                title={isBacklog ? "Clear backlog" : "Mark as backlog"}
                className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                  isBacklog
                    ? "bg-rose-500 text-white border-rose-600 shadow-xs"
                    : "bg-white text-slate border-ink/10 hover:border-rose-300 hover:text-rose-500"
                }`}
              >
                {isBacklog ? "🚨 Backlog" : "+ Backlog"}
              </button>
            </div>

            {/* Badges */}
            {(showOffSyllabusBadge ||
              showAdvancedOnlyBadge ||
              showNeetOnlyBadge ||
              ch.isToughTopic ||
              isBacklog) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {isBacklog && (
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                    Needs Attention
                  </span>
                )}
                {showOffSyllabusBadge && (
                  <span className="text-[10px] font-semibold text-ink/50 bg-ink/5 px-2 py-0.5 rounded-full whitespace-nowrap">
                    Not in {targetExam}
                  </span>
                )}
                {showAdvancedOnlyBadge && (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    Advanced only
                  </span>
                )}
                {showNeetOnlyBadge && (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    NEET only
                  </span>
                )}
                {ch.isToughTopic && (
                  <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                    Tough topic
                  </span>
                )}
              </div>
            )}

            {/* 1. Progress Status Selector: Not Started | Ongoing | Completed */}
            <div className="flex gap-1.5 mt-1">
              {(["not_started", "in_progress", "done"] as ProgressStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(ch.id, s)}
                  className={`flex-1 text-[11px] font-bold py-1.5 rounded-full border transition-all ${
                    status === s
                      ? STATUS_STYLES[s]
                      : "border-ink/10 text-ink/40 bg-white hover:bg-ink/5"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            {/* 2. Revision (+ / -) & Question Practice Modules */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-ink/5">
              {/* Revision Module with (+ / -) */}
              <div className="flex items-center justify-between bg-ink/5 rounded-xl px-2.5 py-1.5 border border-ink/5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-ink/70">Rev:</span>
                  <span className="text-xs font-black text-indigo-600 bg-white px-1.5 py-0.2 rounded border border-indigo-100">
                    {revCount}x
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleRevisionDelta(ch.id, -1)}
                    disabled={revCount === 0}
                    className="w-6 h-6 rounded bg-white border border-ink/10 flex items-center justify-center text-xs font-bold text-ink/70 disabled:opacity-30 hover:bg-ink/5"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevisionDelta(ch.id, 1)}
                    className="w-6 h-6 rounded bg-indigo-600 text-white flex items-center justify-center text-xs font-bold hover:bg-indigo-700"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Question Practice Module */}
              <div className="flex items-center justify-between bg-ink/5 rounded-xl px-2.5 py-1.5 border border-ink/5">
                <div className="truncate pr-1">
                  <span className="text-[10px] font-semibold text-slate block leading-none">
                    Practice
                  </span>
                  <span className="text-[11px] font-extrabold text-ink leading-tight">
                    {pStats.solved > 0 ? `${pStats.solved} Qs (${pStats.accuracy}%)` : "0 Qs"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModalChapter(ch)}
                  className="px-2 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-extrabold shadow-2xs shrink-0"
                >
                  + Log
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {chapters.length === 0 && (
        <p className="text-sm text-slate text-center py-8">No chapters yet.</p>
      )}

      {/* Question Practice Popup Modal */}
      {activeModalChapter && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-ink/10 animate-in fade-in duration-150">
            <div className="flex items-start justify-between pb-2 border-b border-ink/10 mb-3">
              <div>
                <h4 className="font-bold text-sm text-ink">Log Question Practice</h4>
                <p className="text-[11px] text-slate truncate max-w-[220px]">
                  {activeModalChapter.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalChapter(null)}
                className="w-6 h-6 rounded-full bg-ink/5 text-ink/60 hover:text-ink text-xs font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePractice} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-ink/70 block mb-0.5">
                    Attempted Qs
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={attempted}
                    onChange={(e) => setAttempted(parseInt(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-ink/5 border border-ink/10 rounded-lg text-xs font-bold outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-teal-700 block mb-0.5">
                    Correct (✅)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={attempted}
                    value={correct}
                    onChange={(e) => setCorrect(parseInt(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-teal-50 border border-teal-200 rounded-lg text-xs font-bold outline-none text-teal-800"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-rose-700 block mb-0.5">
                    Incorrect (❌)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={incorrect}
                    onChange={(e) => setIncorrect(parseInt(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold outline-none text-rose-800"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate block mb-0.5">
                    Unattempted
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={unattempted}
                    onChange={(e) => setUnattempted(parseInt(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-ink/5 border border-ink/10 rounded-lg text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-ink/70 block mb-0.5">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2 py-1.5 bg-ink/5 border border-ink/10 rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-ink/70 block mb-0.5">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-2 py-1.5 bg-ink/5 border border-ink/10 rounded-lg text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-ink/70 block mb-0.5">
                  Date
                </label>
                <input
                  type="date"
                  value={attemptDate}
                  onChange={(e) => setAttemptDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-ink/5 border border-ink/10 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="p-2 bg-ink/5 rounded-lg flex items-center justify-between text-xs">
                <span className="text-slate text-[11px]">Accuracy:</span>
                <span className="font-black text-teal-700">
                  {attempted > 0 ? Math.round((correct / attempted) * 100) : 0}%
                </span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveModalChapter(null)}
                  className="flex-1 py-2 rounded-xl border border-ink/10 text-xs font-semibold text-slate hover:bg-ink/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPractice}
                  className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {isSavingPractice ? "Saving..." : "Save Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
