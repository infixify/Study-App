// components/syllabus/ChapterCard.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  CheckCircle2, Clock, Circle, Plus, Minus, 
  HelpCircle, Check, X, Calendar, Flame, ArrowUpRight 
} from "lucide-react";

interface ChapterCardProps {
  chapter: {
    id: string;
    chapter_name: string;
    subject: string;
    class_level: string;
    total_questions_solved?: number;
    accuracy?: number;
  };
  userId: string;
  initialStatus?: "not_started" | "ongoing" | "completed";
  initialRevision?: number;
  onUpdate?: () => void;
}

export default function ChapterCard({
  chapter,
  userId,
  initialStatus = "not_started",
  initialRevision = 0,
  onUpdate
}: ChapterCardProps) {
  const [status, setStatus] = useState<"not_started" | "ongoing" | "completed">(initialStatus);
  const [revisionCount, setRevisionCount] = useState<number>(initialRevision);
  const [showPracticeModal, setShowPracticeModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Practice Modal State
  const [attempted, setAttempted] = useState<number>(30);
  const [correct, setCorrect] = useState<number>(24);
  const [incorrect, setIncorrect] = useState<number>(4);
  const [unattempted, setUnattempted] = useState<number>(2);
  const [attemptDate, setAttemptDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState<string>("10:00");
  const [endTime, setEndTime] = useState<string>("11:00");
  const [submittingPractice, setSubmittingPractice] = useState<boolean>(false);
  const [practiceStats, setPracticeStats] = useState({
    solved: chapter.total_questions_solved || 0,
    accuracy: chapter.accuracy || 0,
  });

  // 1. Status Update Handler
  const handleStatusChange = async (newStatus: "not_started" | "ongoing" | "completed") => {
    setStatus(newStatus);
    try {
      await supabase.from("chapter_progress").upsert({
        user_id: userId,
        chapter_id: chapter.id,
        status: newStatus,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,chapter_id" });
      onUpdate?.();
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  // 2. Revision Handler with [ + / - ] logic
  const handleRevisionDelta = async (delta: number) => {
    const updated = Math.max(0, revisionCount + delta);
    setRevisionCount(updated);
    try {
      await supabase.from("chapter_progress").upsert({
        user_id: userId,
        chapter_id: chapter.id,
        revision_count: updated,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,chapter_id" });
      onUpdate?.();
    } catch (err) {
      console.error("Revision update error:", err);
    }
  };

  // 3. Question Practice Logger with Smart Anti-Duplication
  const handleSavePractice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPractice(true);
    try {
      const startMin = parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]);
      const endMin = parseInt(endTime.split(":")[0]) * 60 + parseInt(endTime.split(":")[1]);
      const practiceDurationMinutes = Math.max(1, endMin >= startMin ? endMin - startMin : (1440 - startMin) + endMin);
      const computedAccuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

      // Check anti-dupe: Did user already run focus timer during this slot?
      const { data: existingFocus } = await supabase
        .from("daily_logs")
        .select("practice_minutes")
        .eq("user_id", userId)
        .eq("log_date", attemptDate)
        .maybeSingle();

      // Log to question_logs
      await supabase.from("question_logs").insert({
        user_id: userId,
        chapter_id: chapter.id,
        chapter_name: chapter.chapter_name,
        subject: chapter.subject,
        question_count: attempted,
        correct_count: correct,
        incorrect_count: incorrect,
        unattempted_count: unattempted,
        log_date: attemptDate,
        duration_minutes: practiceDurationMinutes,
        accuracy: computedAccuracy,
        created_at: new Date().toISOString()
      });

      // Update chapter_progress rolling numbers
      const newTotalSolved = practiceStats.solved + attempted;
      const newAvgAcc = practiceStats.solved === 0 ? computedAccuracy : Math.round((practiceStats.accuracy + computedAccuracy) / 2);

      await supabase.from("chapter_progress").upsert({
        user_id: userId,
        chapter_id: chapter.id,
        total_questions_solved: newTotalSolved,
        accuracy: newAvgAcc,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,chapter_id" });

      setPracticeStats({ solved: newTotalSolved, accuracy: newAvgAcc });
      setShowPracticeModal(false);
      onUpdate?.();
    } catch (err) {
      console.error("Practice log failed:", err);
    } finally {
      setSubmittingPractice(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all mb-3.5">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div>
          <span className="text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 mb-1.5 inline-block">
            Class {chapter.class_level} • {chapter.subject}
          </span>
          <h3 className="font-bold text-base sm:text-lg text-slate-900 leading-snug">
            {chapter.chapter_name}
          </h3>
        </div>
      </div>

      {/* 1. Status Selector (Not Started | Ongoing | Completed) */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100/90 rounded-xl mb-3.5">
        <button
          onClick={() => handleStatusChange("not_started")}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
            status === "not_started"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Circle className="w-3.5 h-3.5 text-slate-400" />
          <span>Not Started</span>
        </button>

        <button
          onClick={() => handleStatusChange("ongoing")}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
            status === "ongoing"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-200" />
          <span>Ongoing</span>
        </button>

        <button
          onClick={() => handleStatusChange("completed")}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
            status === "completed"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
          <span>Completed</span>
        </button>
      </div>

      {/* 2. Revision & Question Practice Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Revision Counter (+ / -) */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">🔄 Revision:</span>
            <span className="text-sm font-extrabold text-indigo-600 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md">
              {revisionCount}x
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleRevisionDelta(-1)}
              disabled={revisionCount === 0}
              className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              title="Decrease revision"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleRevisionDelta(1)}
              className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors"
              title="Add revision"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Question Practice Card */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Practice Stats</div>
            <div className="text-xs font-extrabold text-slate-900 mt-0.5">
              {practiceStats.solved > 0 ? (
                <span>
                  {practiceStats.solved} Qs • <span className="text-emerald-600">{practiceStats.accuracy}% Acc</span>
                </span>
              ) : (
                <span className="text-slate-400 font-medium">No Qs logged yet</span>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowPracticeModal(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Practice</span>
          </button>
        </div>
      </div>

      {/* Question Practice Popup Modal */}
      {showPracticeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <div>
                <h4 className="font-extrabold text-lg text-slate-900">Log Question Practice</h4>
                <p className="text-xs text-slate-500 mt-0.5">{chapter.chapter_name}</p>
              </div>
              <button 
                onClick={() => setShowPracticeModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePractice} className="space-y-4">
              {/* Question Attempt Counters */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Attempted Qs</label>
                  <input
                    type="number"
                    min="1"
                    value={attempted}
                    onChange={(e) => {
                      const att = parseInt(e.target.value) || 0;
                      setAttempted(att);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-emerald-700 block mb-1">Correct (✅)</label>
                  <input
                    type="number"
                    min="0"
                    max={attempted}
                    value={correct}
                    onChange={(e) => setCorrect(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-emerald-900 font-bold text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-rose-700 block mb-1">Incorrect (❌)</label>
                  <input
                    type="number"
                    min="0"
                    value={incorrect}
                    onChange={(e) => setIncorrect(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-rose-50/50 border border-rose-300 rounded-xl text-rose-900 font-bold text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Unattempted (⚪)</label>
                  <input
                    type="number"
                    min="0"
                    value={unattempted}
                    onChange={(e) => setUnattempted(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-bold text-sm focus:ring-2 focus:ring-slate-400 outline-none"
                  />
                </div>
              </div>

              {/* Timing & Date */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Practice Date</label>
                <input
                  type="date"
                  value={attemptDate}
                  onChange={(e) => setAttemptDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  required
                />
              </div>

              {/* Summary Pill */}
              <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-600">Calculated Accuracy:</span>
                <span className="font-extrabold text-emerald-700 text-sm">
                  {attempted > 0 ? Math.round((correct / attempted) * 100) : 0}%
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPracticeModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPractice}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all disabled:opacity-50"
                >
                  {submittingPractice ? "Saving Log..." : "Save Practice Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
