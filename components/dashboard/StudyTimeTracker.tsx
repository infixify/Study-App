// components/dashboard/StudyTimeTracker.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type LogPoint = { log_date: string; study_time_minutes: number; target_minutes: number };

interface StudyTimeTrackerProps {
  studiedMinutes: number;
  targetMinutes: number;
  recentLogs?: LogPoint[];
}

type ViewMode = "today" | "week" | "month";
type SubjectType = "Physics" | "Chemistry" | "Mathematics" | "Biology";
type StudyTaskType = "theory" | "questions" | "revision";

function formatHrs(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function StudyTimeTracker({
  studiedMinutes,
  targetMinutes,
  recentLogs = [],
}: StudyTimeTrackerProps) {
  const [view, setView] = useState<ViewMode>("today");

  // Detailed split breakdown
  const [theoryMins, setTheoryMins] = useState(0);
  const [practiceMins, setPracticeMins] = useState(0);
  const [revisionMins, setRevisionMins] = useState(0);
  const [subjectSplit, setSubjectSplit] = useState<{ [sub: string]: number }>({});
  const [questionsToday, setQuestionsToday] = useState(0);

  // Quick Log Modal State
  const [showLogModal, setShowLogModal] = useState(false);
  const [logSub, setLogSub] = useState<SubjectType>("Physics");
  const [logTask, setLogTask] = useState<StudyTaskType>("questions");
  const [logDuration, setLogDuration] = useState<number>(60);
  const [logQs, setLogQs] = useState<number>(0);
  const [savingLog, setSavingLog] = useState(false);

  const fetchDetailedBreakdown = async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    const { data: sessions } = await supabase
      .from("focus_sessions")
      .select("duration_seconds, study_type, task_type, mode, subject")
      .eq("user_id", user.id)
      .gte("started_at", `${today}T00:00:00`)
      .lte("started_at", `${today}T23:59:59`);

    let tMins = 0;
    let pMins = 0;
    let rMins = 0;
    const subMap: { [sub: string]: number } = {};

    if (sessions && sessions.length > 0) {
      sessions.forEach((s: any) => {
        const mins = Math.round((s.duration_seconds || 0) / 60);
        const task = (s.study_type || s.task_type || (s.mode ? s.mode.toLowerCase() : "")).toLowerCase();
        if (task === "theory") tMins += mins;
        else if (task === "revision") rMins += mins;
        else pMins += mins;

        const sub = s.subject || "General";
        subMap[sub] = (subMap[sub] || 0) + mins;
      });
    }

    setTheoryMins(tMins);
    setPracticeMins(pMins);
    setRevisionMins(rMins);
    setSubjectSplit(subMap);

    const { data: qLogs } = await supabase
      .from("question_logs")
      .select("question_count")
      .eq("user_id", user.id)
      .eq("log_date", today);

    const totalQ = (qLogs ?? []).reduce((sum, q) => sum + (q.question_count || 0), 0);
    setQuestionsToday(totalQ);
  };

  useEffect(() => {
    fetchDetailedBreakdown();
  }, [studiedMinutes]);

  const handleSaveLog = async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user || logDuration <= 0) return;

    setSavingLog(true);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - logDuration * 60000);

      // 1. Insert session
      await supabase.from("focus_sessions").insert({
        user_id: user.id,
        duration_seconds: logDuration * 60,
        started_at: startTime.toISOString(),
        ended_at: now.toISOString(),
        subject: logSub,
        study_type: logTask,
        task_type: logTask,
        mode: logTask === "theory" ? "Theory" : logTask === "revision" ? "Revision" : "Practice",
        is_manual: true,
        counts_for_streak: true,
      });

      // 2. Insert questions if entered
      if (logQs > 0) {
        await supabase.from("question_logs").insert({
          user_id: user.id,
          question_count: logQs,
          log_date: today,
        });
      }

      // 3. Update daily logs
      const { data: currentLog } = await supabase
        .from("daily_logs")
        .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes")
        .eq("user_id", user.id)
        .eq("log_date", today)
        .maybeSingle();

      const prevTotal = currentLog?.study_time_minutes ?? 0;
      const prevTheory = currentLog?.theory_minutes ?? 0;
      const prevPractice = currentLog?.practice_minutes ?? 0;
      const prevRevision = currentLog?.revision_minutes ?? 0;

      await supabase.from("daily_logs").upsert(
        {
          user_id: user.id,
          log_date: today,
          study_time_minutes: prevTotal + logDuration,
          theory_minutes: logTask === "theory" ? prevTheory + logDuration : prevTheory,
          practice_minutes: logTask === "questions" ? prevPractice + logDuration : prevPractice,
          revision_minutes: logTask === "revision" ? prevRevision + logDuration : prevRevision,
        },
        { onConflict: "user_id,log_date" }
      );

      await fetchDetailedBreakdown();
      setShowLogModal(false);
      setLogDuration(60);
      setLogQs(0);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingLog(false);
    }
  };

  const pct = targetMinutes > 0 ? Math.min(100, Math.round((studiedMinutes / targetMinutes) * 100)) : 0;
  const totalBreakdown = theoryMins + practiceMins + revisionMins;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⏱️</span>
          <span className="text-sm font-bold text-slate-100">Study Time & Splits</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogModal(true)}
            className="text-[11px] bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 font-bold px-2.5 py-1 rounded-lg border border-teal-500/30 transition-all flex items-center gap-1"
          >
            <span>+</span> Log Study
          </button>
        </div>
      </div>

      {/* Main Big Counter Card */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Today Studied</div>
          <div className="text-3xl font-black font-mono text-white tracking-tight mt-0.5">
            {formatHrs(studiedMinutes)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Goal: {formatHrs(targetMinutes)} ({pct}%)
          </div>
        </div>

        {/* Circular Progress Ring */}
        <div className="relative w-14 h-14 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-slate-800"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-teal-400 transition-all duration-500"
              strokeDasharray={`${pct}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute text-[11px] font-bold font-mono text-slate-200">{pct}%</span>
        </div>
      </div>

      {/* Task Split Progress Multi-bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] font-semibold text-slate-400">
          <span>Task Split</span>
          <span className="text-slate-500">{totalBreakdown > 0 ? formatHrs(totalBreakdown) : "0m"} total</span>
        </div>
        <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex">
          {totalBreakdown > 0 ? (
            <>
              <div
                style={{ width: `${(practiceMins / totalBreakdown) * 100}%` }}
                className="bg-emerald-500 h-full"
                title={`Practice: ${practiceMins}m`}
              />
              <div
                style={{ width: `${(theoryMins / totalBreakdown) * 100}%` }}
                className="bg-sky-500 h-full"
                title={`Theory: ${theoryMins}m`}
              />
              <div
                style={{ width: `${(revisionMins / totalBreakdown) * 100}%` }}
                className="bg-purple-500 h-full"
                title={`Revision: ${revisionMins}m`}
              />
            </>
          ) : (
            <div className="w-full bg-slate-800 h-full" />
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Practice ({formatHrs(practiceMins)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Theory ({formatHrs(theoryMins)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Revision ({formatHrs(revisionMins)})</span>
          </div>
        </div>
      </div>

      {/* Subject Split Breakdown Chips */}
      {Object.keys(subjectSplit).length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-semibold text-slate-400">By Subject</div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(subjectSplit).map(([sub, mins]) => (
              <div
                key={sub}
                className="p-2 bg-slate-950/40 border border-slate-800/60 rounded-xl text-center"
              >
                <div className="text-[10px] text-slate-400 truncate">{sub}</div>
                <div className="text-xs font-bold font-mono text-slate-200 mt-0.5">{formatHrs(mins)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal for Quick Logging */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Log Completed Study</h3>
              <button
                onClick={() => setShowLogModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Subject Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Subject</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["Physics", "Chemistry", "Mathematics", "Biology"] as SubjectType[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setLogSub(s)}
                    className={`py-1.5 text-xs rounded-xl font-medium border text-center transition-all ${
                      logSub === s
                        ? "bg-teal-500/20 border-teal-500 text-teal-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Task Type */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Task Type</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["questions", "theory", "revision"] as StudyTaskType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setLogTask(t)}
                    className={`py-1.5 text-xs rounded-xl font-medium border text-center capitalize transition-all ${
                      logTask === t
                        ? "bg-teal-500/20 border-teal-500 text-teal-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Duration (Minutes)</label>
              <div className="flex gap-2">
                {[30, 45, 60, 90, 120].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setLogDuration(m)}
                    className={`flex-1 py-1 text-xs rounded-lg border font-mono ${
                      logDuration === m
                        ? "bg-teal-500 text-slate-950 font-bold border-teal-500"
                        : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={600}
                value={logDuration}
                onChange={(e) => setLogDuration(parseInt(e.target.value) || 0)}
                className="w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            {/* Questions count if practice */}
            {logTask === "questions" && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Questions Solved (Optional)</label>
                <input
                  type="number"
                  min={0}
                  value={logQs}
                  onChange={(e) => setLogQs(parseInt(e.target.value) || 0)}
                  placeholder="e.g. 25"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            )}

            <button
              onClick={handleSaveLog}
              disabled={savingLog || logDuration <= 0}
              className="w-full py-3 bg-teal-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-teal-500/20 disabled:opacity-50 transition-all"
            >
              {savingLog ? "Saving..." : `Save ${logDuration} Mins Study`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
