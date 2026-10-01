// app/focus/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { loadAndReconcileStreak, saveFocusSession, MIN_STREAK_SECONDS } from "@/lib/focus";
import AppHeader from "@/components/dashboard/AppHeader";
import BottomNav from "@/components/dashboard/BottomNav";

// AppBridge TypeScript Declaration for Native Communication
declare global {
  interface Window {
    AppBridge?: {
      postMessage: (message: string) => void;
    };
    onNativeFCMToken?: (token: string) => void;
  }
}

type SubjectType = "Physics" | "Chemistry" | "Mathematics" | "Biology";
type StudyTaskType = "theory" | "questions" | "revision";

interface AppItem {
  id: string;
  name: string;
  icon: string;
}

const DEFAULT_APP_LIST: AppItem[] = [
  { id: "pdf_reader", name: "PDF Reader", icon: "📄" },
  { id: "calculator", name: "Calculator", icon: "🧮" },
  { id: "youtube", name: "YouTube", icon: "▶️" },
  { id: "whatsapp", name: "WhatsApp", icon: "💬" },
  { id: "instagram", name: "Instagram", icon: "📸" },
  { id: "telegram", name: "Telegram", icon: "✈️" },
  { id: "snapchat", name: "Snapchat", icon: "👻" },
  { id: "games", name: "Games & Social Media", icon: "🎮" },
];

const SYNC_INTERVAL_SECONDS = 60;
const FACE_API_MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
const PRESENCE_CHECK_INTERVAL_SECONDS = 15;
const MAX_CONSECUTIVE_MISSES = 3;
const PRESENCE_LOG_INTERVAL_SECONDS = 60;
const LIVENESS_CHALLENGE_INTERVAL_SECONDS = 1200;
const LIVENESS_CHALLENGE_WINDOW_SECONDS = 20;

export default function StudyPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [targetExam, setTargetExam] = useState<string>("JEE");

  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [streakWasReset, setStreakWasReset] = useState(false);

  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const timerRef = useRef<any>(null);

  const lastSyncedSecondsRef = useRef(0);
  const syncIntervalRef = useRef<any>(null);

  const [showPreModal, setShowPreModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<SubjectType>("Physics");
  const [selectedTask, setSelectedTask] = useState<StudyTaskType>("questions");
  const [strictMode, setStrictMode] = useState(true);

  // Allowed apps starts EMPTY (No default apps preloaded)
  const [allowedApps, setAllowedApps] = useState<string[]>([]);
  const [allApps, setAllApps] = useState<AppItem[]>(DEFAULT_APP_LIST);
  const [showAppsModal, setShowAppsModal] = useState(false);
  const [customAppName, setCustomAppName] = useState("");
  const [isNativeApp, setIsNativeApp] = useState(false);

  const [showPostModal, setShowPostModal] = useState(false);
  const [savedDuration, setSavedDuration] = useState(0);
  const [postStreakResult, setPostStreakResult] = useState<{ counted: boolean; newStreak: number } | null>(null);
  const [postQCount, setPostQCount] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const [showManualModal, setShowManualModal] = useState(false);
  const [manualSub, setManualSub] = useState<SubjectType>("Physics");
  const [manualTask, setManualTask] = useState<StudyTaskType>("questions");
  const [manualMinutes, setManualMinutes] = useState<number>(60);
  const [manualQs, setManualQs] = useState<number>(20);
  const [manualDate, setManualDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [manualError, setManualError] = useState<string | null>(null);

  // --- Verified Mode (camera presence check) state ---
  const [verifiedMode, setVerifiedMode] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [presencePaused, setPresencePaused] = useState(false);
  const [livenessPromptOpen, setLivenessPromptOpen] = useState(false);
  const [livenessSecondsLeft, setLivenessSecondsLeft] = useState(LIVENESS_CHALLENGE_WINDOW_SECONDS);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceapiRef = useRef<any>(null);
  const presenceIntervalRef = useRef<any>(null);
  const missedChecksRef = useRef(0);
  const lastPresenceLogSecondsRef = useRef(0);
  const livenessIntervalRef = useRef<any>(null);
  const livenessCountdownRef = useRef<any>(null);
  const sessionIdRef = useRef<string | null>(null);

  const availableSubjects: SubjectType[] =
    targetExam === "NEET"
      ? ["Physics", "Chemistry", "Biology"]
      : ["Physics", "Chemistry", "Mathematics"];

  useEffect(() => {
    // Detect if running inside Flutter Native Shell
    if (typeof window !== "undefined" && window.AppBridge) {
      setIsNativeApp(true);
    }

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

      try {
        const streakInfo = await loadAndReconcileStreak(user.id);
        setCurrentStreak(streakInfo.currentStreak);
        if (streakInfo.streakWasReset) setStreakWasReset(true);
      } catch (e) {}
    }
    loadUser();

    // Load any saved preference if the user had selected before
    const savedAllowed = localStorage.getItem("prepwise_allowed_apps");
    if (savedAllowed) {
      try {
        setAllowedApps(JSON.parse(savedAllowed));
      } catch (e) {}
    }

    const savedCustomApps = localStorage.getItem("prepwise_custom_apps");
    if (savedCustomApps) {
      try {
        const customParsed: AppItem[] = JSON.parse(savedCustomApps);
        setAllApps([...DEFAULT_APP_LIST, ...customParsed]);
      } catch (e) {}
    }
  }, []);

  const toggleAppAllowed = (appId: string) => {
    const updated = allowedApps.includes(appId)
      ? allowedApps.filter((id) => id !== appId)
      : [...allowedApps, appId];
    setAllowedApps(updated);
    localStorage.setItem("prepwise_allowed_apps", JSON.stringify(updated));

    // Update Flutter bridge dynamically if session is active
    if (isActive && typeof window !== "undefined" && window.AppBridge) {
      try {
        window.AppBridge.postMessage(
          JSON.stringify({
            action: "startStrictTimer",
            allowedApps: updated,
          })
        );
      } catch (err) {}
    }
  };

  const handleAddCustomApp = () => {
    const trimmed = customAppName.trim();
    if (!trimmed) return;
    const newId = `custom_${trimmed.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;
    const newApp: AppItem = { id: newId, name: trimmed, icon: "📱" };

    const updatedApps = [...allApps, newApp];
    setAllApps(updatedApps);
    
    // Automatically select the new app
    const updatedAllowed = [...allowedApps, newId];
    setAllowedApps(updatedAllowed);
    localStorage.setItem("prepwise_allowed_apps", JSON.stringify(updatedAllowed));

    // Persist custom app list
    const customOnly = updatedApps.filter(
      (a) => !DEFAULT_APP_LIST.some((d) => d.id === a.id)
    );
    localStorage.setItem("prepwise_custom_apps", JSON.stringify(customOnly));

    setCustomAppName("");
  };

  const handleBlockAll = () => {
    setAllowedApps([]);
    localStorage.setItem("prepwise_allowed_apps", JSON.stringify([]));
    if (isActive && typeof window !== "undefined" && window.AppBridge) {
      try {
        window.AppBridge.postMessage(
          JSON.stringify({
            action: "startStrictTimer",
            allowedApps: [],
          })
        );
      } catch (err) {}
    }
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
      .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes")
      .eq("user_id", userId)
      .eq("log_date", today)
      .maybeSingle();

    const newMins = (dailyRow?.study_time_minutes || 0) + diffMinutes;
    const newTheory = (dailyRow?.theory_minutes || 0) + (selectedTask === "theory" ? diffMinutes : 0);
    const newPractice = (dailyRow?.practice_minutes || 0) + (selectedTask === "questions" ? diffMinutes : 0);
    const newRevision = (dailyRow?.revision_minutes || 0) + (selectedTask === "revision" ? diffMinutes : 0);

    await supabase.from("daily_logs").upsert(
      {
        user_id: userId,
        log_date: today,
        study_time_minutes: newMins,
        theory_minutes: newTheory,
        practice_minutes: newPractice,
        revision_minutes: newRevision,
      },
      { onConflict: "user_id,log_date" }
    );
    lastSyncedSecondsRef.current += diffMinutes * 60;
  }

  // Timer only advances while active AND not presence-paused
  useEffect(() => {
    if (isActive && !presencePaused) {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, presencePaused]);

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
  }, [isActive, userId, selectedTask]);

  // Pause if the tab/app goes into the background during a Verified Mode session
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && isActive && verifiedMode) {
        setPresencePaused(true);
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isActive, verifiedMode]);

  async function loadFaceModels() {
    if (faceapiRef.current) return faceapiRef.current;
    setModelsLoading(true);
    try {
      const faceapi = await import("face-api.js");
      await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_API_MODEL_URL);
      faceapiRef.current = faceapi;
      return faceapi;
    } finally {
      setModelsLoading(false);
    }
  }

  async function startCamera(): Promise<boolean> {
    try {
      // Trigger native permission bridge if running inside Flutter app
      if (typeof window !== "undefined" && window.AppBridge) {
        try {
          window.AppBridge.postMessage(
            JSON.stringify({ action: "requestCamera" })
          );
        } catch (_) {}
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraError(null);
      return true;
    } catch (e: any) {
      console.warn("Camera access failed:", e);
      setCameraError(
        "Camera permission denied. Please allow camera access in app settings for Verified Mode."
      );
      return false;
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function runPresenceCheck() {
    const faceapi = faceapiRef.current;
    if (!faceapi || !videoRef.current || videoRef.current.readyState < 2) return;

    let detected = false;
    try {
      const result = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 })
      );
      detected = !!result;
    } catch (e) {
      detected = false;
    }

    if (detected) {
      missedChecksRef.current = 0;
      setPresencePaused((prev) => (prev ? false : prev));
    } else {
      missedChecksRef.current += 1;
      if (missedChecksRef.current >= MAX_CONSECUTIVE_MISSES) {
        setPresencePaused(true);
      }
    }

    setSeconds((s) => {
      if (s - lastPresenceLogSecondsRef.current >= PRESENCE_LOG_INTERVAL_SECONDS) {
        lastPresenceLogSecondsRef.current = s;
        if (userId && sessionIdRef.current) {
          supabase.from("focus_presence_checks").insert({
            user_id: userId,
            session_id: sessionIdRef.current,
            face_detected: detected,
            liveness_confirmed: false,
          });
        }
      }
      return s;
    });
  }

  function triggerLivenessChallenge() {
    setLivenessPromptOpen(true);
    setLivenessSecondsLeft(LIVENESS_CHALLENGE_WINDOW_SECONDS);
    livenessCountdownRef.current = setInterval(() => {
      setLivenessSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(livenessCountdownRef.current);
          setLivenessPromptOpen(false);
          setPresencePaused(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function handleConfirmLiveness() {
    clearInterval(livenessCountdownRef.current);
    setLivenessPromptOpen(false);
    if (userId && sessionIdRef.current) {
      supabase.from("focus_presence_checks").insert({
        user_id: userId,
        session_id: sessionIdRef.current,
        face_detected: true,
        liveness_confirmed: true,
      });
    }
  }

  function cleanupVerifiedMode() {
    if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
    if (livenessIntervalRef.current) clearInterval(livenessIntervalRef.current);
    if (livenessCountdownRef.current) clearInterval(livenessCountdownRef.current);
    stopCamera();
    setLivenessPromptOpen(false);
    setPresencePaused(false);
    sessionIdRef.current = null;
  }

  const handleStartSession = async () => {
    if (verifiedMode) {
      setCameraError(null);
      const camOk = await startCamera();
      if (!camOk) return;
      await loadFaceModels();
      missedChecksRef.current = 0;
      lastPresenceLogSecondsRef.current = 0;
      sessionIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      presenceIntervalRef.current = setInterval(runPresenceCheck, PRESENCE_CHECK_INTERVAL_SECONDS * 1000);
      livenessIntervalRef.current = setInterval(triggerLivenessChallenge, LIVENESS_CHALLENGE_INTERVAL_SECONDS * 1000);
    }

    // Trigger Native Flutter App Blocker & Wakelock
    if (typeof window !== "undefined" && window.AppBridge) {
      try {
        window.AppBridge.postMessage(
          JSON.stringify({
            action: "startStrictTimer",
            allowedApps: allowedApps,
          })
        );
        window.AppBridge.postMessage(
          JSON.stringify({
            action: "vibrate",
            type: "light",
          })
        );
      } catch (err) {
        console.error("AppBridge post error:", err);
      }
    }

    setShowPreModal(false);
    setSeconds(0);
    lastSyncedSecondsRef.current = 0;
    setStartTime(new Date());
    setIsActive(true);
    setPresencePaused(false);
    setPostStreakResult(null);
    setStreakWasReset(false);
    setPostQCount(0);
  };

  const handleStopSession = () => {
    // Release Native Flutter App Blocker & Trigger Completion Vibration
    if (typeof window !== "undefined" && window.AppBridge) {
      try {
        window.AppBridge.postMessage(
          JSON.stringify({
            action: "stopStrictTimer",
          })
        );
        window.AppBridge.postMessage(
          JSON.stringify({
            action: "vibrate",
            type: "heavy",
          })
        );
      } catch (err) {
        console.error("AppBridge stop error:", err);
      }
    }

    setIsActive(false);
    setSavedDuration(seconds);
    setShowPostModal(true);
    if (verifiedMode) cleanupVerifiedMode();
  };

  const handleFinishAndSave = async () => {
    if (!userId || !startTime) return;
    setSaving(true);

    try {
      await flushDiffToDailyLogs(savedDuration);

      const endedAt = new Date();
      const streakResult = await saveFocusSession(userId, startTime, endedAt);
      if (streakResult.countedForStreak) {
        setCurrentStreak(streakResult.newStreak);
        setPostStreakResult({ counted: true, newStreak: streakResult.newStreak });
      } else {
        setPostStreakResult({ counted: false, newStreak: currentStreak });
      }

      if (selectedTask === "questions" && postQCount > 0) {
        const today = new Date().toISOString().split("T")[0];
        const { data: subjectRow } = await supabase
          .from("subjects")
          .select("id")
          .eq("name", selectedSub)
          .eq("target_exam", targetExam)
          .limit(1)
          .maybeSingle();

        if (subjectRow?.id) {
          const { data: existing } = await supabase
            .from("question_logs")
            .select("id, question_count")
            .eq("user_id", userId)
            .eq("subject_id", subjectRow.id)
            .eq("log_date", today)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("question_logs")
              .update({ question_count: existing.question_count + postQCount })
              .eq("id", existing.id);
          } else {
            await supabase.from("question_logs").insert({
              user_id: userId,
              subject_id: subjectRow.id,
              question_count: postQCount,
              log_date: today,
            });
          }
        }
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
        .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes")
        .eq("user_id", userId)
        .eq("log_date", manualDate)
        .maybeSingle();

      const newMins = (dailyRow?.study_time_minutes || 0) + manualMinutes;
      const newTheory = (dailyRow?.theory_minutes || 0) + (manualTask === "theory" ? manualMinutes : 0);
      const newPractice = (dailyRow?.practice_minutes || 0) + (manualTask === "questions" ? manualMinutes : 0);
      const newRevision = (dailyRow?.revision_minutes || 0) + (manualTask === "revision" ? manualMinutes : 0);

      await supabase.from("daily_logs").upsert(
        {
          user_id: userId,
          log_date: manualDate,
          study_time_minutes: newMins,
          theory_minutes: newTheory,
          practice_minutes: newPractice,
          revision_minutes: newRevision,
        },
        { onConflict: "user_id,log_date" }
      );

      const today = new Date().toISOString().split("T")[0];
      if (manualTask === "questions" && manualQs > 0 && manualDate === today) {
        const { data: subjectRow } = await supabase
          .from("subjects")
          .select("id")
          .eq("name", manualSub)
          .eq("target_exam", targetExam)
          .limit(1)
          .maybeSingle();

        if (subjectRow?.id) {
          const { data: existing } = await supabase
            .from("question_logs")
            .select("id, question_count")
            .eq("user_id", userId)
            .eq("subject_id", subjectRow.id)
            .eq("log_date", today)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("question_logs")
              .update({ question_count: existing.question_count + manualQs })
              .eq("id", existing.id);
          } else {
            await supabase.from("question_logs").insert({
              user_id: userId,
              subject_id: subjectRow.id,
              question_count: manualQs,
              log_date: today,
            });
          }
        }
      }

      const meetsStreakThreshold = newMins * 60 >= MIN_STREAK_SECONDS;
      if (manualDate === today && meetsStreakThreshold) {
        const syntheticEnd = new Date();
        const syntheticStart = new Date(syntheticEnd.getTime() - manualMinutes * 60 * 1000);
        const streakResult = await saveFocusSession(userId, syntheticStart, syntheticEnd);
        if (streakResult.countedForStreak) setCurrentStreak(streakResult.newStreak);
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
    return `${hrs > 0 ? hrs + ":" : ""}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-paper pb-28">
      <AppHeader />

      {/* Hidden video element feeds the face-detection model — nothing is ever uploaded or recorded */}
      <video ref={videoRef} muted playsInline className="hidden" />

      <main className="max-w-md mx-auto px-5 pt-4 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl text-ink">Focus Mode</h1>
              {isNativeApp && (
                <span className="text-[10px] font-black bg-teal/15 text-teal px-2 py-0.5 rounded-full border border-teal/30">
                  🛡️ Native Protected
                </span>
              )}
            </div>
            <p className="text-xs text-slate mt-0.5">
              Target: <span className="font-bold text-teal">{targetExam}</span> • Zero Distractions
            </p>
          </div>
          <button
            onClick={() => setShowManualModal(true)}
            className="text-xs font-bold text-teal bg-teal/10 px-3 py-1.5 rounded-full hover:bg-teal/20 transition-all border border-teal/20"
          >
            + Log Offline
          </button>
        </div>

        {(currentStreak > 0 || streakWasReset) && (
          <div className={`rounded-ticket border px-4 py-3 flex items-center gap-3 ${
            streakWasReset ? "bg-coral/10 border-coral/20" : "bg-marigold/10 border-marigold/20"
          }`}>
            <span className="text-xl">{streakWasReset ? "💔" : "🔥"}</span>
            <div>
              <p className="text-xs font-bold text-ink">
                {streakWasReset ? "Streak reset — you missed a day" : `${currentStreak}-day streak`}
              </p>
              <p className="text-[10px] text-slate">
                {streakWasReset
                  ? "Start a session today to begin a new streak."
                  : "Keep it going — study at least 2 min today!"}
              </p>
            </div>
          </div>
        )}

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

        {isActive && presencePaused && (
          <div className="rounded-ticket border border-coral/30 bg-coral/10 px-4 py-3 flex items-center gap-3">
            <span className="text-xl">⏸️</span>
            <div>
              <p className="text-xs font-bold text-ink">Paused — we can't see you</p>
              <p className="text-[10px] text-slate">
                Come back into camera view (or tap back into the app) to resume your timer.
              </p>
            </div>
          </div>
        )}

        {cameraError && (
          <div className="rounded-ticket border border-coral/30 bg-coral/10 px-4 py-3">
            <p className="text-xs font-bold text-ink">⚠️ {cameraError}</p>
          </div>
        )}

        {/* Main Focus Timer Card */}
        <div className="bg-white rounded-ticket border border-ink/10 p-6 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="text-[11px] font-bold text-slate uppercase tracking-wider mb-2 flex items-center gap-1.5">
            {isActive && verifiedMode && (
              <span className={`inline-block w-2 h-2 rounded-full ${presencePaused ? "bg-coral" : "bg-teal"}`} />
            )}
            {isActive ? `🔥 Studying ${selectedSub} (${selectedTask})` : "Ready to focus?"}
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

        {/* Clean Allowed Apps Card with Selector Button */}
        <div className="bg-white rounded-ticket border border-ink/10 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🛡️</span>
              <div>
                <h3 className="text-xs font-bold text-ink">Strict Focus App Blocker</h3>
                <p className="text-[11px] text-slate mt-0.5">
                  {allowedApps.length === 0
                    ? "All apps blocked by default (Full strict mode)"
                    : `${allowedApps.length} app${allowedApps.length > 1 ? "s" : ""} allowed during session`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAppsModal(true)}
              className="px-3.5 py-2 rounded-xl bg-teal/10 hover:bg-teal/20 text-teal text-xs font-bold border border-teal/25 transition-all flex items-center gap-1.5 shrink-0 shadow-2xs"
            >
              <span>⚙️</span>
              <span>{allowedApps.length === 0 ? "Select Apps" : "Edit Apps"}</span>
            </button>
          </div>

          {/* Show Allowed App Badges if user has allowed any */}
          {allowedApps.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-ink/5">
              {allowedApps.map((id) => {
                const app = allApps.find((a) => a.id === id) || { name: id, icon: "📱" };
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal/10 border border-teal/20 text-teal text-[11px] font-bold"
                  >
                    <span>{app.icon}</span>
                    <span>{app.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleAppAllowed(id)}
                      className="ml-0.5 text-slate/70 hover:text-ink text-[12px]"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="mt-2.5 pt-2.5 border-t border-ink/5 flex items-center justify-between">
              <span className="text-[10px] text-slate">
                🔒 0 apps allowed • Social media, games & browsers are completely locked
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Allowed Apps Selector Modal */}
      {showAppsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-ink/10 max-h-[85vh] flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <span>🛡️</span> Allowed Apps Settings
                </h3>
                <p className="text-[10px] text-slate">
                  {allowedApps.length} of {allApps.length} allowed
                </p>
              </div>
              <button
                onClick={() => setShowAppsModal(false)}
                className="w-7 h-7 rounded-full bg-ink/5 text-xs text-ink/70 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate">Tap an app to Allow or Block:</p>
              {allowedApps.length > 0 && (
                <button
                  type="button"
                  onClick={handleBlockAll}
                  className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200"
                >
                  Block All (0)
                </button>
              )}
            </div>

            {/* Apps Grid */}
            <div className="overflow-y-auto max-h-56 pr-1 space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                {allApps.map((app) => {
                  const isAllowed = allowedApps.includes(app.id);
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => toggleAppAllowed(app.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        isAllowed
                          ? "bg-teal/10 border-teal/40 text-teal shadow-2xs"
                          : "bg-paper/40 border-ink/10 text-slate hover:bg-paper"
                      }`}
                    >
                      <span className="text-base">{app.icon}</span>
                      <span className="truncate flex-1 text-left">{app.name}</span>
                      <span className={`text-[11px] font-black ${isAllowed ? "text-teal" : "text-rose-500"}`}>
                        {isAllowed ? "✓" : "⛔"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add Custom App Input */}
            <div className="pt-2 border-t border-ink/8">
              <label className="text-[10px] font-bold text-slate block mb-1">
                + Allow Another App (e.g. Physics Wallah, Chrome, Notion)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customAppName}
                  onChange={(e) => setCustomAppName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCustomApp()}
                  placeholder="App name..."
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-ink/15 focus:border-teal outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomApp}
                  disabled={!customAppName.trim()}
                  className="px-3 py-2 bg-teal text-white rounded-xl text-xs font-bold disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Done Button */}
            <button
              type="button"
              onClick={() => setShowAppsModal(false)}
              className="w-full py-3 rounded-xl bg-ink text-white font-bold text-xs shadow-md"
            >
              Done ({allowedApps.length} Allowed)
            </button>
          </div>
        </div>
      )}

      {/* Pre-Session Modal */}
      {showPreModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <h3 className="text-sm font-bold text-ink">Choose Subject</h3>
              <button onClick={() => setShowPreModal(false)} className="w-6 h-6 rounded-full bg-ink/5 text-xs text-ink/60">✕</button>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate block mb-1">Subject</label>
              <div className="grid grid-cols-3 gap-1.5">
                {availableSubjects.map((sub) => (
                  <button key={sub} type="button" onClick={() => setSelectedSub(sub)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${selectedSub === sub ? "bg-teal text-white border-teal shadow-xs" : "bg-paper/60 border-ink/10 text-ink"}`}>
                    {sub}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate block mb-1">Category</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[{ id: "theory", label: "🎥 Theory" }, { id: "questions", label: "✍️ Practice" }, { id: "revision", label: "🔄 Revision" }].map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedTask(item.id as StudyTaskType)}
                    className={`py-2 rounded-xl text-[11px] font-bold border transition-all ${selectedTask === item.id ? "bg-marigold/20 text-ink border-marigold shadow-xs" : "bg-paper/60 border-ink/10 text-slate"}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setVerifiedMode((v) => !v)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                verifiedMode ? "bg-teal/10 border-teal/40" : "bg-paper/60 border-ink/10"
              }`}
            >
              <div>
                <p className="text-xs font-bold text-ink">🎥 Verified Mode</p>
                <p className="text-[10px] text-slate mt-0.5 max-w-[220px]">
                  Uses your camera to confirm you're present. Nothing is ever recorded or uploaded — only a yes/no presence signal.
                </p>
              </div>
              <span className={`shrink-0 w-10 h-6 rounded-full flex items-center px-0.5 transition-all ${verifiedMode ? "bg-teal justify-end" : "bg-ink/15 justify-start"}`}>
                <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
              </span>
            </button>

            <button
              onClick={handleStartSession}
              disabled={modelsLoading}
              className="w-full py-3 rounded-xl bg-teal text-white font-bold text-xs shadow-md shadow-teal/20 hover:bg-teal/90 disabled:opacity-50"
            >
              {modelsLoading ? "Loading camera check…" : "Start Focus Session"}
            </button>
          </div>
        </div>
      )}

      {/* Post-Session Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-4">
            <h3 className="text-base font-black text-ink text-center">Session Finished! 🎉</h3>
            <p className="text-xs text-slate text-center">
              Studied {selectedSub} ({selectedTask}) for {Math.round(savedDuration / 60)} mins.
            </p>
            {savedDuration >= MIN_STREAK_SECONDS && (
              <p className="text-[11px] text-teal font-bold text-center">🔥 This session counts for your streak!</p>
            )}

            {selectedTask === "questions" && (
              <div>
                <label className="text-[11px] font-bold text-slate block mb-1 text-center">
                  ✍️ How many questions did you solve?
                </label>
                <input
                  type="number"
                  min={0}
                  value={postQCount}
                  onChange={(e) => setPostQCount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full p-2.5 text-center text-sm font-bold rounded-xl border border-ink/15 focus:border-teal outline-none"
                  placeholder="0"
                />
                <p className="text-[10px] text-slate text-center mt-1">
                  Will be added to your {selectedSub} question counter
                </p>
              </div>
            )}

            <button
              disabled={saving}
              onClick={handleFinishAndSave}
              className="w-full py-3 rounded-xl bg-teal text-white font-bold text-xs"
            >
              {saving ? "Saving..." : "✓ Save & Log Session"}
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
              <button onClick={() => setShowManualModal(false)} className="w-6 h-6 rounded-full bg-ink/5 text-xs text-ink/60">✕</button>
            </div>
            {manualError && (
              <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2 rounded-lg">⚠️ {manualError}</p>
            )}
            <div>
              <label className="text-[11px] font-bold text-slate block mb-1">Subject</label>
              <div className="grid grid-cols-3 gap-1.5">
                {availableSubjects.map((sub) => (
                  <button key={sub} type="button" onClick={() => setManualSub(sub)}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${manualSub === sub ? "bg-teal text-white border-teal shadow-xs" : "bg-paper/60 border-ink/10 text-ink"}`}>
                    {sub}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate block mb-1">Category</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[{ id: "theory", label: "🎥 Theory" }, { id: "questions", label: "✍️ Practice" }, { id: "revision", label: "🔄 Revision" }].map((item) => (
                  <button key={item.id} type="button" onClick={() => setManualTask(item.id as StudyTaskType)}
                    className={`py-1.5 rounded-lg text-[11px] font-bold border transition-all ${manualTask === item.id ? "bg-marigold/20 text-ink border-marigold shadow-xs" : "bg-paper/60 border-ink/10 text-slate"}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate block mb-1">Minutes</label>
                <input type="number" min={1} value={manualMinutes}
                  onChange={(e) => setManualMinutes(parseInt(e.target.value) || 0)}
                  className="w-full p-2 text-center text-xs font-bold rounded-lg border border-ink/15" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate block mb-1">
                  {manualTask === "questions" ? "Questions Solved" : "Questions (optional)"}
                </label>
                <input type="number" min={0} value={manualQs}
                  onChange={(e) => setManualQs(parseInt(e.target.value) || 0)}
                  className="w-full p-2 text-center text-xs font-bold rounded-lg border border-ink/15" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate block mb-1">Date</label>
              <input type="date" value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full p-2 text-xs rounded-lg border border-ink/15" />
            </div>
            {manualDate !== new Date().toISOString().split("T")[0] && (
              <p className="text-[10px] text-slate bg-ink/5 rounded-lg px-3 py-2">
                ℹ️ Past-date entries update study hours but not your streak (streak is today-only).
              </p>
            )}
            <button disabled={saving} onClick={handleSaveManualEntry}
              className="w-full py-2.5 rounded-xl bg-ink text-paper font-bold text-xs">
              {saving ? "Saving..." : "Add to Daily Study Hours"}
            </button>
          </div>
        </div>
      )}

      {/* Liveness challenge — small, non-blocking, bottom-anchored */}
      {livenessPromptOpen && (
        <div className="fixed bottom-24 left-0 right-0 z-50 px-4">
          <div className="max-w-sm mx-auto bg-ink text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3">
            <span className="text-xl">👋</span>
            <div className="flex-1">
              <p className="text-xs font-bold">Still there?</p>
              <p className="text-[10px] text-white/70">Tap to confirm — {livenessSecondsLeft}s left</p>
            </div>
            <button
              onClick={handleConfirmLiveness}
              className="px-3 py-2 rounded-xl bg-teal text-white text-xs font-bold shrink-0"
            >
              I'm here
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
