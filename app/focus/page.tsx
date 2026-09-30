// app/focus/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { loadAndReconcileStreak, saveFocusSession, MIN_STREAK_SECONDS } from "@/lib/focus";
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
  { id: "pdf_reader", name: "PDF Reader", icon: "📄" },
  { id: "calculator", name: "Calculator", icon: "🧮" },
];

const SYNC_INTERVAL_SECONDS = 60;

export default function StudyPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [targetExam, setTargetExam] = useState<string>("JEE");

  // Streak state — populated on load via loadAndReconcileStreak()
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [streakWasReset, setStreakWasReset] = useState(false);

  // Live Timer states
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const timerRef = useRef<any>(null);

  const lastSyncedSecondsRef = useRef(0);
  const syncIntervalRef = useRef<any>(null);

  // Pre-session configuration modal
  const [showPreModal, setShowPreModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<SubjectType>("Physics");
  const [selectedTask, setSelectedTask] = useState<StudyTaskType>("questions");
  const [strictMode, setStrictMode] = useState(true);

  const [allowedApps, setAllowedApps] = useState<string[]>(["pdf_reader", "calculator"]);

  // Post-session log modal
  const [showPostModal, setShowPostModal] = useState(false);
  const [savedDuration, setSavedDuration] = useState(0);
  const [postStreakResult, setPostStreakResult] = useState<{ counted: boolean; newStreak: number } | null>(null);
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

      // Load streak — also detects missed days and resets in DB if needed.
      try {
        const streakInfo = await loadAndReconcileStreak(user.id);
        setCurrentStreak(streakInfo.currentStreak);
        if (streakInfo.streakWasReset) {
          setStreakWasReset(true);
        }
      } catch (e) {
        // Non-fatal — streak display just stays at 0 if this fails.
      }
    }
    loadUser();

    const savedAllowed = localStorage.getItem("prepwise_allowed_apps");
    if (savedAllowed) {
      try {
        setAllowedApps(JSON.parse(savedAllowed));
      } catch (e) {}
    }
  }, []);

  const toggleAppAllowed = (appId: string) => {
    let updated: string[];
    if (allowedApps.includes(appId)) {
      updated = allowedApps.filter((id) => id !== appId);
    } else {
      updated = [...allowedApps, appId];
    }
    setAllowedApps(updated);
    localStorage.setItem("prepwise_allowed_apps", JSON.stringify(updated));
  };

  async function flushDiffToDailyLogs(currentSeconds: number, dateOverride?: string) {
    if (!userId) return;
    const diffSeconds = currentSeconds - lastSyncedSecondsRef.current;
    if (diffSeconds <= 0) return;

    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes <= 0) return;

    const today = dateOverride ?? new Date().toISOString().split("T")[0];

    const { data: dailyRow } = await supabase
      .from("daily_logs")
      .select("study_time_minutes")
      .eq("user_id", userId)
      .eq("log_date", today)
      .maybeSingle();

    const newMins = (dailyRow?.study_time_minutes || 0) + diffMinutes;
    await supabase.from("daily_logs").upsert(
      { user_id: userId, log_date: today, study_time_minutes: newMins },
      { onConflict: "user_id,log_date" }
    );

    lastSyncedSecondsRef.current += diffMinutes * 60;
  }

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

  // Debounced background sync
  useEffect(() => {
    if (isActive) {
      syncIntervalRef.current = setInterval(() => {
        setSeconds((currentSeconds) => {
          flushDiffToDailyLogs(currentSeconds);
          return currentSeconds;
        });
      }, SYNC_INTERVAL_SECONDS * 1000);
    } else if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
    return () => clearInterval(syncIntervalRef.current);
  }, [isActive, userId]);

  const handleStartSession = () => {
    setShowPreModal(false);
    setSeconds(0);
    lastSyncedSecondsRef.current = 0;
    setStartTime(new Date());
    setIsActive(true);
    setPostStreakResult(null);
    setStreakWasReset(false);
  };

  const handleStopSession = () => {
    setIsActive(false);
    setSavedDuration(seconds);
    setShowPostModal(true);
  };

  const handleFinishAndSave = async (noQuestions: boolean) => {
    if (!userId || !startTime) return;
    setSaving(true);

    try {
      // 1. Flush remaining daily_logs diff (earlier chunks already written).
      await flushDiffToDailyLogs(savedDuration);

      // 2. Save focus_sessions row + update streak columns in users table.
      //    saveFocusSession() handles the MIN_STREAK_SECONDS check internally —
      //    sessions shorter than 2 min don't update the streak.
      const endedAt = new Date();
      const streakResult = await saveFocusSession(userId, startTime, endedAt);
      if (streakResult.countedForStreak) {
        setCurrentStreak(streakResult.newStreak);
        setPostStreakResult({ counted: true, newStreak: streakResult.newStreak });
      } else {
        setPostStreakResult({ counted: false, newStreak: currentStreak });
      }

      setSaving(false);
      setShowPostModal(false);
      setSeconds(0);
      lastSyncedSecondsRef.current = 0;
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

      // Update streak only if:
      // - the manual entry is for today (past dates shouldn't retroactively
      //   fix a broken streak — that would be gameable)
      // - the total minutes for today's entry is at least MIN_STREAK_SECONDS/60
      const today = new Date().toISOString().split("T")[0];
      const meetsStreakThreshold = newMins * 60 >= MIN_STREAK_SECONDS;
      if (manualDate === today && meetsStreakThreshold) {
        // Reuse saveFocusSession with synthetic timestamps so the same
        // source-of-truth logic applies. Duration = manualMinutes in seconds.
        const syntheticEnd = new Date();
        const syntheticStart = new Date(syntheticEnd.getTime() - manualMinutes * 60 * 1000);
        const streakResult = await saveFocusSession(userId, syntheticStart, syntheticEnd);
        if (streakResult.countedForStreak) {
          setCurrentStreak(streakResult.newStreak);
        }
      }

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

        {/* Streak banner — shows current streak and a reset warning if applicable */}
        {(currentStreak > 0 || streakWasReset) && (
          <div className={`rounded-ticket border px-4 py-3 flex items-center gap-3 ${
            streakWasReset
              ? "bg-coral/10 border-coral/20"
              : "bg-marigold/10 border-marigold/20"
          }`}>
            <span className="text-xl">{streakWasReset ? "💔" : "🔥"}</span>
            <div>
              <p className="text-xs font-bold text-ink">
                {streakWasReset
                  ? "Streak reset — you missed a day"
                  : `${currentStreak}-day streak`}
              </p>
              <p className="text-[10px] text-slate">
                {streakWasReset
                  ? "Start a session today to begin a new streak."
                  : "Keep it going — study at least 2 min today!"}
              </p>
            </div>
          </div>
        )}

        {/* Post-session streak result toast */}
        {postStreakResult && !showPostModal && (
          <div className="rounded-ticket border border-teal/20 bg-teal/10 px-4 py-3 flex items-center gap-3">
            <span className="text-xl">{postStreakResult.counted ? "🔥" : "⏱️"}</span>
            <div>
              <p className="text-xs font-bold text-ink">
                {postStreakResult.counted
                  ? `Streak updated: ${postStreakResult.newStreak} day${postStreakResult.newStreak !== 1 ? "s" : ""}!`
                  : "Session saved — too short to count for streak (min 2 min)"}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-ticket border border-ink/10 p-6 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="text-[11px] font-bold text-slate uppercase tracking-wider mb-2">
            {isActive
              ? `🔥 Studying ${selectedSub} (${selectedTask})`
              : "Ready to focus?"}
          </div>

          <div className="font-mono text-5xl font-black text-ink my-3 tracking-tight">
            {formatTimer(seconds)}
          </div>

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

        {/* Allowed-Apps Selector */}
        <div className="bg-white rounded-ticket border border-ink/10 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-ink flex items-center gap-1.5">
              <span>🛡️</span>
              <span>Allowed Apps During Session</span>
            </h3>
            <span className="text-[10px] font-bold text-slate">
              {allowedApps.length} Allowed
            </span>
          </div>
          <p className="text-[11px] text-slate mb-3">
            Everything is blocked by default. Tap an app to allow it during focus sessions.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {APP_LIST.map((app) => {
              const isAllowed = allowedApps.includes(app.id);
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => toggleAppAllowed(app.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    isAllowed
                      ? "bg-teal/10 border-teal/30 text-teal shadow-2xs"
                      : "bg-paper/50 border-ink/10 text-slate hover:bg-paper"
                  }`}
                >
                  <span>{app.icon}</span>
                  <span className="truncate flex-1 text-left">{app.name}</span>
                  <span className="text-[10px]">{isAllowed ? "✓" : "⛔"}</span>
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
            {savedDuration >= MIN_STREAK_SECONDS && (
              <p className="text-[11px] text-teal font-bold text-center">
                🔥 This session counts for your streak!
              </p>
            )}

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

            {manualError && (
              <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2 rounded-lg">
                ⚠️ {manualError}
              </p>
            )}

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
