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
  targetExam?: string;
  onProgressChange?: (chapterId: string, status: ProgressStatus) => void;
  onBacklogToggle?: (chapterId: string, isBacklog: boolean) => void;
}

const STATUS_LABELS: Record<ProgressStatus, string> = {
  not_started: "Not started",
  in_progress: "Ongoing",
  done: "Completed",
};

const STATUS_STYLES: Record<ProgressStatus, string> = {
  not_started:
    "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-200",
  in_progress:
    "bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-500/25 font-bold",
  done:
    "bg-teal text-white border-teal shadow-sm shadow-teal/25 font-bold",
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

  // 3. Save Question Practice Log
  async function handleSavePractice() {
    if (!activeModalChapter) return;
    setIsSavingPractice(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const calcAccuracy =
        attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

      await supabase.from("question_practice_logs").insert({
        user_id: user.id,
        chapter_id: activeModalChapter.id,
        attempted,
        correct,
        incorrect,
        unattempted,
        attempt_date: attemptDate,
        start_time: startTime,
        end_time: endTime,
        accuracy: calcAccuracy,
      });

      const currentSolved =
        practiceStatsMap[activeModalChapter.id]?.solved ??
        activeModalChapter.total_questions_solved ??
        0;
      setPracticeStatsMap((prev) => ({
        ...prev,
        [activeModalChapter.id]: {
          solved: currentSolved + attempted,
          accuracy: calcAccuracy,
        },
      }));

      setActiveModalChapter(null);
    } catch (err) {
      console.error("Error saving practice log:", err);
    } finally {
      setIsSavingPractice(false);
    }
  }

  function toggleBacklog(chapterId: string, current: boolean) {
    onBacklogToggle?.(chapterId, !current);
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
            className={`rounded-2xl border p-4 flex flex-col gap-3 transition-all duration-200 shadow-sm ${
              isBacklog
                ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/50"
                : "bg-white dark:bg-[#121A29] border-slate-200 dark:border-white/10"
            }`}
          >
            {/* Header: Title + Class Badge + Backlog Pill */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1">
                {ch.classTag && (
                  <span className="shrink-0 mt-0.5 text-[9.5px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-md">
                    {ch.classTag === "Dropper" ? "Dropper" : `Class ${ch.classTag}`}
                  </span>
                )}
                <span className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {ch.title}
                </span>
              </div>

              <button
                type="button"
                onClick={() => toggleBacklog(ch.id, isBacklog)}
                title={isBacklog ? "Clear backlog" : "Mark as backlog"}
                className={`shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-all ${
                  isBacklog
                    ? "bg-rose-500 text-white border-rose-600 shadow-xs"
                    : "bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-rose-400 hover:text-rose-500"
                }`}
              >
                {isBacklog ? "🚨 Backlog" : "+ Backlog"}
              </button>
            </div>

            {/* Scope Badges */}
            {(showOffSyllabusBadge ||
              showAdvancedOnlyBadge ||
              showNeetOnlyBadge ||
              ch.isToughTopic) && (
              <div className="flex flex-wrap gap-1.5">
                {showOffSyllabusBadge && (
                  <span className="text-[9px] font-bold text-slate-500 bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded-md">
                    Boards Only
                  </span>
                )}
                {showAdvancedOnlyBadge && (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-md">
                    JEE Advanced Only
                  </span>
                )}
                {showNeetOnlyBadge && (
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                    NEET Specific
                  </span>
                )}
                {ch.isToughTopic && (
                  <span className="text-[9px] font-bold text-rose-700 bg-rose-100 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.5 rounded-md">
                    High Yield / Tough
                  </span>
                )}
              </div>
            )}

            {/* 3 Status Switcher Buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              {(["not_started", "in_progress", "done"] as ProgressStatus[]).map(
                (st) => {
                  const active = status === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => updateStatus(ch.id, st)}
                      className={`py-2 text-[11px] font-bold rounded-xl border transition-all ${
                        active
                          ? STATUS_STYLES[st]
                          : "bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200/70 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10"
                      }`}
                    >
                      {STATUS_LABELS[st]}
                    </button>
                  );
                }
              )}
            </div>

            {/* Revision & Practice Tracking Sub-Row */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              {/* Revision Box */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-[#162032] px-2.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-white/5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Rev:{" "}
                  <b className="text-teal dark:text-[#2DD4BF] font-black">
                    {revCount}x
                  </b>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleRevisionDelta(ch.id, -1)}
                    className="w-5 h-5 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 font-black text-xs flex items-center justify-center hover:bg-slate-100 active:scale-95"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevisionDelta(ch.id, 1)}
                    className="w-5 h-5 rounded-md bg-teal text-white font-black text-xs flex items-center justify-center hover:bg-teal/90 active:scale-95 shadow-xs"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Practice Log Box */}
              <button
                type="button"
                onClick={() => setActiveModalChapter(ch)}
                className="flex items-center justify-between bg-slate-50 dark:bg-[#162032] px-2.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-white/5 hover:border-teal text-left transition-colors"
              >
                <div>
                  <span className="text-[10px] text-slate-400 block leading-none">
                    Practice
                  </span>
                  <span className="text-[11px] font-bold text-slate-800 dark:text-white">
                    {pStats.solved} Qs
                  </span>
                </div>
                <span className="text-[10px] font-bold text-teal dark:text-[#2DD4BF]">
                  + Log
                </span>
              </button>
            </div>
          </div>
        );
      })}

      {/* QUESTION PRACTICE LOGGING MODAL */}
      {activeModalChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#141C2B] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
              <div>
                <h3 className="font-display text-base font-black text-slate-900 dark:text-white">
                  Log Question Practice
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                  {activeModalChapter.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalChapter(null)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Attempted Qs
                </label>
                <input
                  type="number"
                  value={attempted}
                  onChange={(e) => setAttempted(Number(e.target.value))}
                  className="w-full p-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-[#1A2438] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 outline-none focus:border-teal"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Correct (✅)
                </label>
                <input
                  type="number"
                  value={correct}
                  onChange={(e) => setCorrect(Number(e.target.value))}
                  className="w-full p-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-[#1A2438] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 outline-none focus:border-teal"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-rose-500 block mb-1">
                  Incorrect (❌)
                </label>
                <input
                  type="number"
                  value={incorrect}
                  onChange={(e) => setIncorrect(Number(e.target.value))}
                  className="w-full p-2 rounded-xl text-xs font-bold bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Unattempted
                </label>
                <input
                  type="number"
                  value={unattempted}
                  onChange={(e) => setUnattempted(Number(e.target.value))}
                  className="w-full p-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-[#1A2438] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 outline-none focus:border-teal"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-[#1A2438] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-[#1A2438] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-teal/10 dark:bg-teal/15 flex items-center justify-between text-xs font-bold text-teal dark:text-[#2DD4BF]">
              <span>Calculated Accuracy:</span>
              <span>
                {attempted > 0 ? Math.round((correct / attempted) * 100) : 0}%
              </span>
            </div>

            <button
              type="button"
              disabled={isSavingPractice}
              onClick={handleSavePractice}
              className="w-full py-3 bg-teal text-white rounded-xl text-xs font-bold shadow-md shadow-teal/20 hover:bg-teal/90 disabled:opacity-50"
            >
              {isSavingPractice ? "Saving Practice Log…" : "Save Practice Session"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
