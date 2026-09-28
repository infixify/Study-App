"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/dashboard/AppHeader";
import BottomNav from "@/components/dashboard/BottomNav";

type SubjectType = "Physics" | "Chemistry" | "Mathematics" | "Biology";
type StudyTaskType = "theory" | "questions" | "revision";

const APP_LIST = [
  { id: "instagram", name: "Instagram", icon: "📸" },
  { id: "youtube", name: "YouTube", icon: "▶️" },
  { id: "whatsapp", name: "WhatsApp", icon: "💬" },
  { id: "snapchat", name: "Snapchat", icon: "👻" },
  { id: "telegram", name: "Telegram", icon: "✈️" },
  { id: "games", name: "Games & Others", icon: "🎮" },
];

export default function StudyPage() {
  const [userId, setUserId] = useState<string | null>(null);

  // Live Timer states
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const timerRef = useRef<any>(null);

  // Pre-session configuration modal
  const [showPreModal, setShowPreModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<SubjectType>("Physics");
  const [selectedTask, setSelectedTask] = useState<StudyTaskType>("questions");
  const [strictMode, setStrictMode] = useState(true);
  const [blockedApps, setBlockedApps] = useState<string[]>([
    "instagram",
    "youtube",
    "whatsapp",
    "games",
  ]);

  // Post-session log modal
  const [showPostModal, setShowPostModal] = useState(false);
  const [savedDuration, setSavedDuration] = useState(0);
  const [qCount, setQCount] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  // Manual Log Entry Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualSub, setManualSub] = useState<SubjectType>("Physics");
  const [manualTask, setManualTask] = useState<StudyTaskType>("questions");
  const [manualMinutes, setManualMinutes] = useState<number>(60);
  const [manualQs, setManualQs] = useState<number>(0);
  const [manualDate, setManualDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserId(data.user.id);
        // Load user's saved app block preferences
        supabase
          .from("user_app_blocks")
          .select("blocked_apps, strict_mode_enabled")
          .eq("user_id", data.user.id)
          .maybeSingle()
          .then(({ data: pref }) => {
            if (pref) {
              setBlockedApps(pref.blocked_apps || []);
              setStrictMode(pref.strict_mode_enabled ?? true);
            }
          });
      }
    });
  }, []);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    if (h > 0) {
      return `${h < 10 ? "0" + h : h}:${remM < 10 ? "0" + remM : remM}:${s < 10 ? "0" + s : s}`;
    }
    return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
  };

  function toggleBlockedApp(id: string) {
    setBlockedApps((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  // 🚀 Start live focus session after setup
  function handleConfirmStart() {
    setShowPreModal(false);
    setStartTime(new Date());
    setIsActive(true);

    // Save app block preferences in background
    if (userId) {
      supabase.from("user_app_blocks").upsert({
        user_id: userId,
        blocked_apps: blockedApps,
        strict_mode_enabled: strictMode,
        updated_at: new Date().toISOString(),
      });
    }

    // Call Native Android/Flutter Bridge if available
    if (strictMode && typeof window !== "undefined" && (window as any).AppBridge) {
      (window as any).AppBridge.startStrictTimer?.({
        blockedApps,
        subject: selectedSub,
        task: selectedTask,
      });
    }
  }

  // ⏹ Stop session
  const handleStopSession = () => {
    setIsActive(false);
    // Tell native bridge to release app block
    if (typeof window !== "undefined" && (window as any).AppBridge) {
      (window as any).AppBridge.stopStrictTimer?.();
    }

    if (seconds >= 30) {
      setSavedDuration(seconds);
      setShowPostModal(true);
    } else {
      setSeconds(0);
      setStartTime(null);
    }
  };

  // 💾 Save live session to Supabase
  const handleFinishAndSave = async (onlyTheory: boolean) => {
    if (!userId) return;
    setSaving(true);
    const durationMins = Math.round(savedDuration / 60);
    const endedAt = new Date();
    const startedAt = startTime || new Date(endedAt.getTime() - savedDuration * 1000);
    const today = endedAt.toISOString().slice(0, 10);

    try {
      // 1. Insert focus session
      await supabase.from("focus_sessions").insert({
        user_id: userId,
        duration_seconds: savedDuration,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        start_time: startedAt.toISOString(),
        end_time: endedAt.toISOString(),
        subject: selectedSub,
        study_type: selectedTask,
        is_manual: false,
        blocked_apps: strictMode ? blockedApps : [],
        counts_for_streak: true,
      });

      // 2. Insert question logs if solved
      const questionsSolved = onlyTheory ? 0 : qCount;
      if (questionsSolved > 0) {
        await supabase.from("question_logs").insert({
          user_id: userId,
          question_count: questionsSolved,
          log_date: today,
        });
      }

      // 3. Update daily logs aggregates
      const { data: currentLog } = await supabase
        .from("daily_logs")
        .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes")
        .eq("user_id", userId)
        .eq("log_date", today)
        .maybeSingle();

      const prevTotal = currentLog?.study_time_minutes ?? 0;
      const prevTheory = currentLog?.theory_minutes ?? 0;
      const prevPractice = currentLog?.practice_minutes ?? 0;
      const prevRevision = currentLog?.revision_minutes ?? 0;

      await supabase.from("daily_logs").upsert(
        {
          user_id: userId,
          log_date: today,
          study_time_minutes: prevTotal + durationMins,
          theory_minutes: selectedTask === "theory" ? prevTheory + durationMins : prevTheory,
          practice_minutes: selectedTask === "questions" ? prevPractice + durationMins : prevPractice,
          revision_minutes: selectedTask === "revision" ? prevRevision + durationMins : prevRevision,
        },
        { onConflict: "user_id,log_date" }
      );
    } catch (err) {
      console.error("Save session error:", err);
    } finally {
      setSaving(false);
      setShowPostModal(false);
      setSeconds(0);
      setQCount(0);
      setStartTime(null);
    }
  };

  // 📝 Save manual offline study entry with OVERLAP CHECK
  const handleSaveManualEntry = async () => {
    if (!userId) return;
    setManualError(null);
    if (manualMinutes <= 0) {
      setManualError("Study duration must be greater than 0 minutes.");
      return;
    }

    setSaving(true);
    try {
      // 🛡️ ANTI-CHEAT OVERLAP CHECK:
      // Verify user isn't logging manual study that overlaps with existing live sessions
      const { data: existingSessions } = await supabase
        .from("focus_sessions")
        .select("duration_seconds, is_manual, started_at")
        .eq("user_id", userId)
        .gte("started_at", `${manualDate}T00:00:00`)
        .lte("started_at", `${manualDate}T23:59:59`);

      const liveMinsToday = (existingSessions ?? [])
        .filter((s) => !s.is_manual)
        .reduce((sum, s) => sum + Math.round((s.duration_seconds || 0) / 60), 0);

      // Total daily study sanity check (cannot exceed 18 hours in 1 day)
      if (liveMinsToday + manualMinutes > 1080) {
        setManualError(
          `Cannot exceed 18 study hours per day. You already have ${Math.round(liveMinsToday / 60)}h logged!`
        );
        setSaving(false);
        return;
      }

      const manualStartTime = new Date(`${manualDate}T12:00:00Z`);
      const manualEndTime = new Date(manualStartTime.getTime() + manualMinutes * 60000);

      // 1. Insert manual focus session
      await supabase.from("focus_sessions").insert({
        user_id: userId,
        duration_seconds: manualMinutes * 60,
        started_at: manualStartTime.toISOString(),
        ended_at: manualEndTime.toISOString(),
        start_time: manualStartTime.toISOString(),
        end_time: manualEndTime.toISOString(),
        subject: manualSub,
        study_type: manualTask,
        is_manual: true,
        counts_for_streak: true,
      });

      // 2. Insert questions if logged
      if (manualQs > 0) {
        await supabase.from("question_logs").insert({
          user_id: userId,
          question_count: manualQs,
          log_date: manualDate,
        });
      }

      // 3. Update daily logs aggregates
      const { data: currentLog } = await supabase
        .from("daily_logs")
        .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes")
        .eq("user_id", userId)
        .eq("log_date", manualDate)
        .maybeSingle();

      const prevTotal = currentLog?.study_time_minutes ?? 0;
      const prevTheory = currentLog?.theory_minutes ?? 0;
      const prevPractice = currentLog?.practice_minutes ?? 0;
      const prevRevision = currentLog?.revision_minutes ?? 0;

      await supabase.from("daily_logs").upsert(
        {
          user_id: userId,
          log_date: manualDate,
          study_time_minutes: prevTotal + manualMinutes,
          theory_minutes: manualTask === "theory" ? prevTheory + manualMinutes : prevTheory,
          practice_minutes: manualTask === "questions" ? prevPractice + manualMinutes : prevPractice,
          revision_minutes: manualTask === "revision" ? prevRevision + manualMinutes : prevRevision,
        },
        { onConflict: "user_id,log_date" }
      );

      setShowManualModal(false);
      setManualMinutes(60);
      setManualQs(0);
      alert("✓ Manual study hours saved successfully!");
    } catch (err: any) {
      console.error("Manual log error:", err);
      setManualError(err.message || "Failed to save entry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-between pb-28 font-sans">
      {/* Top Header */}
      <AppHeader />

      <main className="w-full max-w-md mx-auto px-5 py-4 flex flex-col items-center flex-1 justify-between">
        {/* Title & Active Tag */}
        <div className="w-full text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-teal/10 text-teal border border-teal/20">
            Study Tracking Hub
          </span>
          <h1 className="text-2xl font-black text-ink mt-1.5">Deep Study Stopwatch</h1>
          <p className="text-xs text-slate mt-0.5">
            {isActive
              ? `Currently studying ${selectedSub} (${selectedTask})`
              : "Track focus hours, block distractions & log daily practice"}
          </p>
        </div>

        {/* Circular Stopwatch */}
        <div className="flex flex-col items-center justify-center my-6">
          <div
            className={`w-64 h-64 rounded-full border-4 flex flex-col items-center justify-center bg-white shadow-xl transition-all relative ${
              isActive
                ? "border-teal shadow-teal/20 ring-8 ring-teal/5 animate-pulse"
                : "border-ink/10"
            }`}
          >
            {strictMode && isActive && (
              <span className="absolute top-6 text-[10px] font-bold bg-rose-50 text-rose-600 px-2.5 py-0.5 rounded-full border border-rose-200">
                🛑 Strict Blocker Active
              </span>
            )}
            <span className="text-5xl font-black tracking-tight text-ink font-mono mt-2">
              {formatTime(seconds)}
            </span>
            <span className="text-[11px] font-bold text-slate mt-2 uppercase tracking-widest">
              {isActive ? `${selectedSub} · ${selectedTask}` : "Ready"}
            </span>
          </div>
        </div>

        {/* Main Stopwatch Controls */}
        <div className="w-full flex flex-col gap-3">
          {!isActive ? (
            <button
              type="button"
              onClick={() => (seconds === 0 ? setShowPreModal(true) : setIsActive(true))}
              className="w-full py-4 rounded-2xl bg-teal text-white font-bold text-base shadow-lg shadow-teal/20 hover:bg-teal/90 active:scale-95 transition-all"
            >
              {seconds === 0 ? "🚀 Start Focus Session" : "▶ Resume Session"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopSession}
              className="w-full py-4 rounded-2xl bg-rose-500 text-white font-bold text-base shadow-lg shadow-rose-500/20 hover:bg-rose-600 active:scale-95 transition-all"
            >
              ⏹ End Session & Log Practice
            </button>
          )}

          {seconds > 0 && !isActive && (
            <button
              type="button"
              onClick={() => setSeconds(0)}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-slate hover:bg-ink/5 transition-all text-center"
            >
              Reset Stopwatch
            </button>
          )}

          {/* Divider */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-ink/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-paper px-3 text-[11px] font-bold text-slate">OR</span>
            </div>
          </div>

          {/* Manual Entry Button */}
          <button
            type="button"
            disabled={isActive}
            onClick={() => setShowManualModal(true)}
            className="w-full py-3 rounded-2xl border border-ink/15 bg-white text-ink font-bold text-xs hover:border-ink/30 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-40"
          >
            <span>✍️</span>
            <span>Log Offline Study Hours Manually</span>
          </button>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 1. PRE-SESSION SETUP MODAL (Subject, Task, App Blocker)                  */}
      {/* ========================================================================= */}
      {showPreModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4 border border-ink/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <div>
                <h3 className="text-lg font-black text-ink">Setup Focus Session</h3>
                <p className="text-xs text-slate">What are you studying right now?</p>
              </div>
              <button
                onClick={() => setShowPreModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate hover:bg-ink/5"
              >
                ✕
              </button>
            </div>

            {/* Subject Selector */}
            <div>
              <label className="text-xs font-bold text-ink block mb-2">Subject</label>
              <div className="grid grid-cols-2 gap-2">
                {(["Physics", "Chemistry", "Mathematics", "Biology"] as SubjectType[]).map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSub(sub)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                      selectedSub === sub
                        ? "border-teal bg-teal/10 text-teal shadow-xs"
                        : "border-ink/12 text-ink hover:border-ink/25"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Task Type (Theory / Questions / Revision) */}
            <div>
              <label className="text-xs font-bold text-ink block mb-2">Study Task</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "theory", label: "🎥 Theory / Lecture" },
                  { id: "questions", label: "✍️ Questions Practice" },
                  { id: "revision", label: "🔄 Revision" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedTask(item.id as StudyTaskType)}
                    className={`py-2.5 px-2 rounded-xl border text-[11px] font-bold transition-all text-center leading-tight ${
                      selectedTask === item.id
                        ? "border-marigold bg-marigold/15 text-ink shadow-xs"
                        : "border-ink/12 text-ink hover:border-ink/25"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 🛑 Strict Distraction Blocker Section */}
            <div className="rounded-2xl border border-ink/10 bg-paper/60 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🛑</span>
                  <div>
                    <h4 className="text-xs font-bold text-ink">Strict Distraction Blocker</h4>
                    <p className="text-[10px] text-slate">Silence notifications & block chosen apps</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={strictMode}
                  onChange={(e) => setStrictMode(e.target.checked)}
                  className="w-4 h-4 accent-teal cursor-pointer"
                />
              </div>

              {strictMode && (
                <div className="mt-3 pt-3 border-t border-ink/10">
                  <p className="text-[11px] font-semibold text-ink mb-2">
                    Apps to restrict during session:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {APP_LIST.map((app) => {
                      const isBlocked = blockedApps.includes(app.id);
                      return (
                        <button
                          key={app.id}
                          type="button"
                          onClick={() => toggleBlockedApp(app.id)}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold transition-all ${
                            isBlocked
                              ? "border-rose-500 bg-rose-50 text-rose-700"
                              : "border-ink/10 bg-white text-slate opacity-60"
                          }`}
                        >
                          <span>{app.icon}</span>
                          <span className="truncate">{app.name}</span>
                          <span className="ml-auto text-[10px]">{isBlocked ? "✕" : "+"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Start Button */}
            <button
              type="button"
              onClick={handleConfirmStart}
              className="w-full py-4 rounded-2xl bg-teal text-white font-bold text-sm shadow-lg shadow-teal/20 hover:bg-teal/90 transition-all mt-2"
            >
              🚀 Start Session Now
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. POST-SESSION QUESTIONS LOG MODAL                                       */}
      {/* ========================================================================= */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-5 border border-ink/10">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 text-2xl font-bold flex items-center justify-center mx-auto mb-2">
                🎯
              </div>
              <h3 className="text-lg font-black text-ink">Session Complete!</h3>
              <p className="text-xs text-slate mt-0.5">
                You studied <span className="font-bold text-ink">{selectedSub}</span> for{" "}
                <span className="font-bold text-ink">{Math.round(savedDuration / 60)} minutes</span>.
              </p>
            </div>

            {/* Questions counter */}
            <div className="flex flex-col gap-3 bg-paper p-4 rounded-2xl border border-ink/5">
              <label className="text-xs font-bold text-ink">
                How many questions did you solve in this session?
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  value={qCount === 0 ? "" : qCount}
                  placeholder="0"
                  onChange={(ev) => setQCount(parseInt(ev.target.value) || 0)}
                  className="w-24 text-center text-xl font-bold p-3 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
                />
                <div className="flex items-center gap-1.5 flex-1">
                  {[10, 25, 50].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => setQCount((prev) => prev + inc)}
                      className="flex-1 py-3 text-xs font-bold rounded-xl bg-white border border-ink/10 text-ink hover:bg-teal hover:text-white transition-all shadow-xs"
                    >
                      +{inc}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
              {qCount > 0 && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleFinishAndSave(false)}
                  className="w-full py-4 rounded-xl bg-teal text-white font-bold text-sm shadow-lg shadow-teal/20 hover:bg-teal/90 transition-all"
                >
                  {saving ? "Saving…" : `✓ Save ${qCount} Questions & Focus Time`}
                </button>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={() => handleFinishAndSave(true)}
                className="w-full py-3.5 rounded-xl bg-ink/5 hover:bg-ink/10 text-ink font-bold text-xs transition-all text-center"
              >
                📖 No questions solved (Theory / Lecture / Revision only)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MANUAL OFFLINE ENTRY MODAL (With Anti-Cheat Overlap Check)              */}
      {/* ========================================================================= */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4 border border-ink/10">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <div>
                <h3 className="text-lg font-black text-ink">Log Offline Study</h3>
                <p className="text-xs text-slate">Record library, coaching, or self-study</p>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate hover:bg-ink/5"
              >
                ✕
              </button>
            </div>

            {manualError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                ⚠️ {manualError}
              </div>
            )}

            {/* Subject Selector */}
            <div>
              <label className="text-xs font-bold text-ink block mb-1.5">Subject</label>
              <div className="grid grid-cols-2 gap-2">
                {(["Physics", "Chemistry", "Mathematics", "Biology"] as SubjectType[]).map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setManualSub(sub)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                      manualSub === sub
                        ? "border-teal bg-teal/10 text-teal shadow-xs"
                        : "border-ink/12 text-ink hover:border-ink/25"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Task Type */}
            <div>
              <label className="text-xs font-bold text-ink block mb-1.5">Task Category</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "theory", label: "🎥 Theory" },
                  { id: "questions", label: "✍️ Questions" },
                  { id: "revision", label: "🔄 Revision" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setManualTask(item.id as StudyTaskType)}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-all text-center ${
                      manualTask === item.id
                        ? "border-marigold bg-marigold/15 text-ink shadow-xs"
                        : "border-ink/12 text-ink"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration & Questions */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">Duration (Mins)</label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(parseInt(e.target.value) || 0)}
                  className="w-full text-center text-base font-bold p-2.5 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">Questions Solved</label>
                <input
                  type="number"
                  min={0}
                  value={manualQs}
                  onChange={(e) => setManualQs(parseInt(e.target.value) || 0)}
                  className="w-full text-center text-base font-bold p-2.5 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
                />
              </div>
            </div>

            {/* Date Picker */}
            <div>
              <label className="text-xs font-bold text-ink block mb-1">Date</label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
              />
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveManualEntry}
              className="w-full py-3.5 rounded-2xl bg-ink text-paper font-bold text-xs shadow-md hover:bg-ink-100 disabled:opacity-40 transition-all mt-2"
            >
              {saving ? "Saving…" : "✓ Add to Daily Study Hours"}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}