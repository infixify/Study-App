// app/focus/page.tsx
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
  { id: "games", name: "Games & Social Media", icon: "🎮" },
];

export default function StudyPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [targetExam, setTargetExam] = useState<string>("JEE");

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
  const [manualQs, setManualQs] = useState<number>(20);
  const [manualDate, setManualDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [manualError, setManualError] = useState<string | null>(null);

  // Active Available Subjects Filtered By Exam Target:
  // JEE = Physics, Chemistry, Mathematics (NO BIOLOGY)
  // NEET = Physics, Chemistry, Biology (NO MATHEMATICS)
  const availableSubjects: SubjectType[] =
    targetExam === "NEET"
      ? ["Physics", "Chemistry", "Biology"]
      : ["Physics", "Chemistry", "Mathematics"];

  useEffect(() => {
    async function loadUser() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("users")
        .select("target_exam")
        .eq("uid", user.id)
        .maybeSingle();

      if (profile?.target_exam) {
        setTargetExam(profile.target_exam);
        if (profile.target_exam === "NEET" && selectedSub === "Mathematics") {
          setSelectedSub("Biology");
        }
      }
    }
    loadUser();

    // Load persistent blocked apps
    const savedBlocks = localStorage.getItem("prepwise_blocked_apps");
    if (savedBlocks) {
      try {
        setBlockedApps(JSON.parse(savedBlocks));
      } catch (e) {}
    }
  }, []);

  const toggleAppBlock = (appId: string) => {
    let updated: string[];
    if (blockedApps.includes(appId)) {
      updated = blockedApps.filter((id) => id !== appId);
    } else {
      updated = [...blockedApps, appId];
    }
    setBlockedApps(updated);
    localStorage.setItem("prepwise_blocked_apps", JSON.stringify(updated));
  };

  // Timer Tick
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else if (!isActive && timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive]);

  const handleStartSession = () => {
    setShowPreModal(false);
    setSeconds(0);
    setStartTime(new Date());
    setIsActive(true);
  };

  const handleStopSession = () => {
    setIsActive(false);
    setSavedDuration(seconds);
    setShowPostModal(true);
  };

  const handleFinishAndSave = async (noQuestions: boolean) => {
    if (!userId) return;
    setSaving(true);
    const durationMinutes = Math.max(1, Math.round(savedDuration / 60));
    const today = new Date().toISOString().split("T")[0];

    try {
      // 1. Update daily_logs study_time_minutes
      const { data: dailyRow } = await supabase
        .from("daily_logs")
        .select("study_time_minutes")
        .eq("user_id", userId)
        .eq("log_date", today)
        .maybeSingle();

      const newMins = (dailyRow?.study_time_minutes || 0) + durationMinutes;
      await supabase.from("daily_logs").upsert(
        {
          user_id: userId,
          log_date: today,
          study_time_minutes: newMins,
        },
        { onConflict: "user_id,log_date" }
      );

      setSaving(false);
      setShowPostModal(false);
      setSeconds(0);
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const handleSaveManualEntry = async () => {
    if (!userId) return;
    setSaving(true);
    setManualError(null);

    try {
      const { data: dailyRow } = await supabase
        .from("daily_logs")
        .select("study_time_minutes")
        .eq("user_id", userId)
        .eq("log_date", manualDate)
        .maybeSingle();

      const newMins = (dailyRow?.study_time_minutes || 0) + manualMinutes;
      await supabase.from("daily_logs").upsert(
        {
          user_id: userId,
          log_date: manualDate,
          study_time_minutes: newMins,
        },
        { onConflict: "user_id,log_date" }
      );

      setSaving(false);
      setShowManualModal(false);
    } catch (err) {
      setSaving(false);
      setManualError("Failed to save entry");
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? hrs + ":" : ""}${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-paper pb-28">
      <AppHeader />

      <main className="max-w-md mx-auto px-5 pt-4 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-ink">Focus Mode</h1>
            <p className="text-xs text-slate mt-0.5">
              Target: <span className="font-bold text-teal">{targetExam}</span>{" "}
              • Zero Distractions
            </p>
          </div>
          <button
            onClick={() => setShowManualModal(true)}
            className="text-xs font-bold text-teal bg-teal/10 px-3 py-1.5 rounded-full hover:bg-teal/20 transition-all border border-teal/20"
          >
            + Log Offline
          </button>
        </div>

        {/* Live Timer Card */}
        <div className="bg-white rounded-ticket border border-ink/10 p-6 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="text-[11px] font-bold text-slate uppercase tracking-wider mb-2">
            {isActive
              ? `🔥 Studying ${selectedSub} (${selectedTask})`
              : "Ready to focus?"}
          </div>

          <div className="font-mono text-5xl font-black text-ink my-3 tracking-tight">
            {formatTimer(seconds)}
          </div>

          {/* Controls */}
          {!isActive ? (
            <button
              onClick={() => setShowPreModal(true)}
              className="mt-4 px-8 py-3.5 bg-teal text-white font-bold text-sm rounded-2xl shadow-md shadow-teal/20 hover:bg-teal/90 transition-all"
            >
              ▶ Start Focus Session
            </button>
          ) : (
            <button
              onClick={handleStopSession}
              className="mt-4 px-8 py-3.5 bg-rose-600 text-white font-bold text-sm rounded-2xl shadow-md shadow-rose-600/20 hover:bg-rose-700 transition-all"
            >
              ■ Stop & Log Session
            </button>
          )}
        </div>

        {/* YPT-Style App Blocker Selector */}
        <div className="bg-white rounded-ticket border border-ink/10 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-ink flex items-center gap-1.5">
              <span>🛡️</span>
              <span>Distraction Blocker (YPT Mode)</span>
            </h3>
            <span className="text-[10px] font-bold text-slate">
              {blockedApps.length} Blocked
            </span>
          </div>
          <p className="text-[11px] text-slate mb-3">
            Tap apps to toggle blocking during active focus sessions.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {APP_LIST.map((app) => {
              const isBlocked = blockedApps.includes(app.id);
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => toggleAppBlock(app.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    isBlocked
                      ? "bg-rose-50 border-rose-200 text-rose-800 shadow-2xs"
                      : "bg-paper/50 border-ink/10 text-slate hover:bg-paper"
                  }`}
                >
                  <span>{app.icon}</span>
                  <span className="truncate flex-1 text-left">{app.name}</span>
                  <span className="text-[10px]">{isBlocked ? "⛔" : "✓"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Pre-Session Modal */}
      {showPreModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <h3 className="text-sm font-bold text-ink">Choose Subject</h3>
              <button
                onClick={() => setShowPreModal(false)}
                className="w-6 h-6 rounded-full bg-ink/5 text-xs text-ink/60"
              >
                ✕
              </button>
            </div>

            {/* Subject Selector (Filtered for JEE/NEET) */}
            <div>
              <label className="text-[11px] font-bold text-slate block mb-1">
                Subject
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {availableSubjects.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSub(sub)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedSub === sub
                        ? "bg-teal text-white border-teal shadow-xs"
                        : "bg-paper/60 border-ink/10 text-ink"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Task Category */}
            <div>
              <label className="text-[11px] font-bold text-slate block mb-1">
                Category
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "theory", label: "🎥 Theory" },
                  { id: "questions", label: "✍️ Practice" },
                  { id: "revision", label: "🔄 Revision" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedTask(item.id as StudyTaskType)}
                    className={`py-2 rounded-xl text-[11px] font-bold border transition-all ${
                      selectedTask === item.id
                        ? "bg-marigold/20 text-ink border-marigold shadow-xs"
                        : "bg-paper/60 border-ink/10 text-slate"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleStartSession}
              className="w-full py-3 rounded-xl bg-teal text-white font-bold text-xs shadow-md shadow-teal/20 hover:bg-teal/90"
            >
              Start Focus Session
            </button>
          </div>
        </div>
      )}

      {/* Post-Session Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-4">
            <h3 className="text-base font-black text-ink text-center">
              Session Finished!
            </h3>
            <p className="text-xs text-slate text-center">
              Studied {selectedSub} for {Math.round(savedDuration / 60)} mins.
            </p>

            <button
              disabled={saving}
              onClick={() => handleFinishAndSave(true)}
              className="w-full py-3 rounded-xl bg-teal text-white font-bold text-xs"
            >
              {saving ? "Saving..." : "✓ Save Study Time"}
            </button>
          </div>
        </div>
      )}

      {/* Manual Offline Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <h3 className="text-sm font-bold text-ink">Log Offline Study</h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="w-6 h-6 rounded-full bg-ink/5 text-xs text-ink/60"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate block mb-1">
                Subject
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {availableSubjects.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setManualSub(sub)}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      manualSub === sub
                        ? "bg-teal text-white border-teal shadow-xs"
                        : "bg-paper/60 border-ink/10 text-ink"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate block mb-1">
                  Minutes
                </label>
                <input
                  type="number"
                  min={1}
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(parseInt(e.target.value) || 0)}
                  className="w-full p-2 text-center text-xs font-bold rounded-lg border border-ink/15"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate block mb-1">
                  Questions
                </label>
                <input
                  type="number"
                  min={0}
                  value={manualQs}
                  onChange={(e) => setManualQs(parseInt(e.target.value) || 0)}
                  className="w-full p-2 text-center text-xs font-bold rounded-lg border border-ink/15"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate block mb-1">
                Date
              </label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full p-2 text-xs rounded-lg border border-ink/15"
              />
            </div>

            <button
              disabled={saving}
              onClick={handleSaveManualEntry}
              className="w-full py-2.5 rounded-xl bg-ink text-paper font-bold text-xs"
            >
              {saving ? "Saving..." : "Add to Daily Study Hours"}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
