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

    const today = new Date().toISOString().slice(0, 10);

    const { data: sessions } = await supabase
      .from("focus_sessions")
      .select("duration_seconds, study_type, subject")
      .eq("user_id", user.id)
      .gte("started_at", `${today}T00:00:00`)
      .lte("started_at", `${today}T23:59:59`);

    let tMins = 0;
    let pMins = 0;
    let rMins = 0;
    const subMap: { [sub: string]: number } = {};

    if (sessions && sessions.length > 0) {
      sessions.forEach((s) => {
        const mins = Math.round((s.duration_seconds || 0) / 60);
        if (s.study_type === "theory") tMins += mins;
        else if (s.study_type === "revision") rMins += mins;
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

  // Handle Quick Manual Log Submit
  const handleQuickLogSubmit = async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user || logDuration <= 0) return;

    setSavingLog(true);
    const today = new Date().toISOString().slice(0, 10);

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
      console.error("Quick log error:", e);
    } finally {
      setSavingLog(false);
    }
  };

  const effectiveTotal = Math.max(studiedMinutes, theoryMins + practiceMins + revisionMins);
  const totalTarget = Math.max(1, targetMinutes);
  const overallPct = Math.min(100, Math.round((effectiveTotal / totalTarget) * 100));

  const sumDetailed = theoryMins + practiceMins + revisionMins;
  const theoryPct = sumDetailed > 0 ? (theoryMins / sumDetailed) * 100 : 0;
  const practicePct = sumDetailed > 0 ? (practiceMins / sumDetailed) * 100 : 0;
  const revisionPct = sumDetailed > 0 ? (revisionMins / sumDetailed) * 100 : 0;

  const chronological = [...recentLogs].reverse();
  const weekSlice = chronological.slice(-7);
  const monthSlice = chronological.slice(-30);
  const activeSlice = view === "week" ? weekSlice : view === "month" ? monthSlice : [];

  const totalMinutesInView = activeSlice.reduce((sum, l) => sum + l.study_time_minutes, 0);
  const avgMinutesInView = activeSlice.length ? Math.round(totalMinutesInView / activeSlice.length) : 0;
  const maxMinutesInView = Math.max(1, ...activeSlice.map((l) => l.study_time_minutes));

  return (
    <div className="rounded-ticket border border-ink/10 bg-white p-5 shadow-xs relative">
      {/* Header with View Tabs + Quick "+ Log" Button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-ink">Study Hours & Analytics</h3>
          <p className="text-[11px] text-slate">Lectures vs Practice vs Revision</p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* ⚡ JEETrack-Style Quick Log Button */}
          <button
            type="button"
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal text-white text-[11px] font-bold shadow-xs hover:bg-teal/90 active:scale-95 transition-all"
          >
            <span>+</span>
            <span>Log</span>
          </button>

          <div className="flex gap-0.5 bg-ink/5 rounded-full p-0.5">
            {(["today", "week", "month"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`text-[11px] font-semibold px-2 py-1 rounded-full transition-all ${
                  view === v ? "bg-white text-ink shadow-xs" : "text-slate hover:text-ink"
                }`}
              >
                {v === "today" ? "Today" : v === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "today" && (
        <div className="flex flex-col gap-4">
          {/* Big Summary Row */}
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-ink font-mono tracking-tight">
                {formatHrs(effectiveTotal)}
              </span>
              <span className="text-xs text-slate ml-1.5 font-medium">
                / {formatHrs(targetMinutes)} target
              </span>
            </div>
            {questionsToday > 0 && (
              <span className="text-xs font-bold text-teal bg-teal/10 px-2.5 py-1 rounded-full border border-teal/20">
                🎯 {questionsToday} Qs Solved
              </span>
            )}
          </div>

          {/* 1. Target Progress Bar */}
          <div>
            <div className="h-2 rounded-full bg-ink/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal transition-all duration-500"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate mt-1">
              <span>{overallPct}% completed</span>
              <span>
                {overallPct >= 100
                  ? "🎉 Target Achieved!"
                  : `${formatHrs(Math.max(0, targetMinutes - effectiveTotal))} remaining`}
              </span>
            </div>
          </div>

          {/* 2. 3-Color Segmented Distribution Bar */}
          <div className="rounded-xl border border-ink/8 p-3.5 bg-paper/40">
            <div className="flex items-center justify-between text-xs font-bold text-ink mb-2">
              <span>Activity Distribution</span>
              <span className="text-[10px] text-slate font-medium">Optimal: 1:2 Theory:Practice</span>
            </div>

            <div className="h-3 rounded-full bg-ink/8 overflow-hidden flex w-full">
              {theoryPct > 0 && (
                <div
                  style={{ width: `${theoryPct}%` }}
                  className="h-full bg-sky-500 transition-all duration-300"
                  title={`Theory: ${formatHrs(theoryMins)}`}
                />
              )}
              {practicePct > 0 && (
                <div
                  style={{ width: `${practicePct}%` }}
                  className="h-full bg-emerald-500 transition-all duration-300"
                  title={`Practice: ${formatHrs(practiceMins)}`}
                />
              )}
              {revisionPct > 0 && (
                <div
                  style={{ width: `${revisionPct}%` }}
                  className="h-full bg-purple-500 transition-all duration-300"
                  title={`Revision: ${formatHrs(revisionMins)}`}
                />
              )}
            </div>

            <div className="grid grid-cols-3 gap-1 mt-3 pt-2 border-t border-ink/5 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-sky-700">
                  <span className="w-2 h-2 rounded-full bg-sky-500" /> Theory
                </div>
                <div className="text-xs font-bold text-ink mt-0.5">{formatHrs(theoryMins)}</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Practice
                </div>
                <div className="text-xs font-bold text-ink mt-0.5">{formatHrs(practiceMins)}</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-purple-700">
                  <span className="w-2 h-2 rounded-full bg-purple-500" /> Revision
                </div>
                <div className="text-xs font-bold text-ink mt-0.5">{formatHrs(revisionMins)}</div>
              </div>
            </div>
          </div>

          {/* 3. Subject-Wise Breakdown Pills */}
          {Object.keys(subjectSplit).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate uppercase tracking-wider mr-1">
                Subjects:
              </span>
              {Object.entries(subjectSplit).map(([sub, mins]) => (
                <span
                  key={sub}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-ink/10 text-ink shadow-2xs"
                >
                  {sub}: <strong className="font-mono text-teal">{formatHrs(mins)}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Week / Month Historical Graph */}
      {(view === "week" || view === "month") && (
        <>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-xs text-slate">
              {view === "week" ? "Last 7 Days" : "Last 30 Days"}
            </p>
            <p className="text-xs font-bold text-ink">Daily Avg: {formatHrs(avgMinutesInView)}</p>
          </div>

          {activeSlice.length === 0 ? (
            <p className="text-xs text-slate py-8 text-center">No study logs recorded yet.</p>
          ) : (
            <div className="flex items-end gap-1.5 h-28 pt-2">
              {activeSlice.map((l) => {
                const barHeightPct = Math.max(6, Math.round((l.study_time_minutes / maxMinutesInView) * 100));
                const hitTarget = l.study_time_minutes >= l.target_minutes;
                return (
                  <div key={l.log_date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <div className="w-full flex items-end justify-center h-20">
                      <div
                        className={`w-full max-w-[20px] rounded-t-sm transition-all ${
                          hitTarget ? "bg-teal" : "bg-marigold/80"
                        }`}
                        style={{ height: `${barHeightPct}%` }}
                        title={`${formatHrs(l.study_time_minutes)} on ${l.log_date}`}
                      />
                    </div>
                    {view === "week" && (
                      <p className="text-[9px] font-bold text-slate">
                        {new Date(l.log_date).toLocaleDateString("en-IN", { weekday: "narrow" })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 🚀 QUICK LOG MODAL */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-3.5 border border-ink/10">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <div>
                <h4 className="text-base font-black text-ink">Quick Study Log</h4>
                <p className="text-[11px] text-slate">Record your practice or class directly</p>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate hover:bg-ink/5"
              >
                ✕
              </button>
            </div>

            {/* Subject Selector */}
            <div>
              <label className="text-[11px] font-bold text-ink block mb-1">Subject</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(["Physics", "Chemistry", "Mathematics", "Biology"] as SubjectType[]).map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setLogSub(sub)}
                    className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition-all ${
                      logSub === sub
                        ? "border-teal bg-teal/10 text-teal"
                        : "border-ink/12 text-ink hover:border-ink/20"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Task Type */}
            <div>
              <label className="text-[11px] font-bold text-ink block mb-1">Category</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "theory", label: "🎥 Theory" },
                  { id: "questions", label: "✍️ Practice" },
                  { id: "revision", label: "🔄 Revision" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLogTask(item.id as StudyTaskType)}
                    className={`py-1.5 px-1 rounded-xl border text-[10.5px] font-bold transition-all ${
                      logTask === item.id
                        ? "border-marigold bg-marigold/15 text-ink"
                        : "border-ink/12 text-ink"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration & Questions */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-ink block mb-1">Minutes</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={logDuration}
                  onChange={(e) => setLogDuration(parseInt(e.target.value) || 0)}
                  className="w-full text-center text-sm font-bold p-2 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-ink block mb-1">Questions</label>
                <input
                  type="number"
                  min={0}
                  value={logQs}
                  onChange={(e) => setLogQs(parseInt(e.target.value) || 0)}
                  className="w-full text-center text-sm font-bold p-2 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={savingLog || logDuration <= 0}
              onClick={handleQuickLogSubmit}
              className="w-full py-3 rounded-xl bg-ink text-paper font-bold text-xs shadow-md hover:bg-ink-100 disabled:opacity-40 transition-all mt-1"
            >
              {savingLog ? "Logging…" : "✓ Add to Today's Study"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
    }
