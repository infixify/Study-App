"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { loadAndReconcileStreak, saveFocusSession, MIN_STREAK_SECONDS } from "@/lib/focus";
import AppHeader from "@/components/dashboard/AppHeader";
import BottomNav from "@/components/dashboard/BottomNav";

declare global {
  interface Window {
    AppBridge?: { postMessage: (message: string) => void };
    onNativeFCMToken?: (token: string) => void;
    __nativeInstalledApps?: { name: string; packageName: string }[];
    onInstalledAppsReady?: (apps: { name: string; packageName: string }[]) => void;
    onNativeRequestStopFocus?: () => void;
    onNativeDirectStopFocus?: () => void;
    onNativeFocusTimerSync?: (seconds: number) => void;
    onNativeRestoreActiveSession?: (sess: {
      subject: string;
      mode: string;
      elapsedSeconds: number;
      camEnabled: boolean;
      blockerEnabled: boolean;
    }) => void;
    onAccessibilityStatus?: (granted: boolean) => void;
    onOverlayPermissionResult?: (granted: boolean) => void;
  }
}

type SubjectType = "Physics" | "Chemistry" | "Mathematics" | "Biology";
type StudyTaskType = "theory" | "questions" | "revision";

interface AppItem {
  id: string;
  name: string;
  icon: string;
}

const WEB_FALLBACK_APPS: AppItem[] = [
  { id: "pdf_reader", name: "PDF Reader", icon: "📄" },
  { id: "calculator", name: "Calculator", icon: "🧮" },
  { id: "youtube", name: "YouTube", icon: "▶️" },
  { id: "whatsapp", name: "WhatsApp", icon: "💬" },
  { id: "instagram", name: "Instagram", icon: "📸" },
  { id: "telegram", name: "Telegram", icon: "✈️" },
  { id: "snapchat", name: "Snapchat", icon: "👻" },
  { id: "games", name: "Games & Social Media", icon: "🎮" },
];

function nativeToAppItem(n: { name: string; packageName: string }): AppItem {
  return { id: n.packageName, name: n.name, icon: "📱" };
}

const SYNC_INTERVAL_SECONDS = 60;
const FACE_API_MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
const PRESENCE_CHECK_INTERVAL_SECONDS = 2;
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

  const [allowedApps, setAllowedApps] = useState<string[]>([]);
  const [allApps, setAllApps] = useState<AppItem[]>([]);
  const [appsLoaded, setAppsLoaded] = useState(false);
  const [showAppsModal, setShowAppsModal] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [appsSearch, setAppsSearch] = useState("");

  const [postStreakResult, setPostStreakResult] = useState<{ counted: boolean; newStreak: number } | null>(null);
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

  // Toggle states
  const [faceVerificationEnabled, setFaceVerificationEnabled] = useState(false);
  const [appBlockerEnabled, setAppBlockerEnabled] = useState(false);

  // Permission states
  const [overlayGranted, setOverlayGranted] = useState(false);
  const [usageGranted, setUsageGranted] = useState(false);
  const [showUsageSteps, setShowUsageSteps] = useState(false);

  // Camera / face-api state
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

  const isVerifiedSession = faceVerificationEnabled && appBlockerEnabled && overlayGranted && usageGranted;

  function applyNativeApps(raw: { name: string; packageName: string }[]) {
    const items = raw.map(nativeToAppItem);
    setAllApps(items);
    setAppsLoaded(true);
  }

  async function checkOverlayPermission(): Promise<boolean> {
    if (!isNativeApp) return false;
    return new Promise<boolean>((resolve) => {
      const prev = window.onOverlayPermissionResult;
      window.onOverlayPermissionResult = (granted: boolean) => {
        window.onOverlayPermissionResult = prev;
        setOverlayGranted(granted);
        resolve(granted);
      };
      try {
        window.AppBridge!.postMessage(JSON.stringify({ action: "checkOverlayPermission" }));
      } catch (_) { resolve(false); }
      setTimeout(() => { window.onOverlayPermissionResult = prev; resolve(false); }, 3000);
    });
  }

  async function checkUsagePermission(): Promise<boolean> {
    if (!isNativeApp) return false;
    return new Promise<boolean>((resolve) => {
      const prev = window.onAccessibilityStatus;
      window.onAccessibilityStatus = (granted: boolean) => {
        window.onAccessibilityStatus = prev;
        setUsageGranted(granted);
        resolve(granted);
      };
      try {
        window.AppBridge!.postMessage(JSON.stringify({ action: "checkUsagePermission" }));
      } catch (_) { resolve(false); }
      setTimeout(() => { window.onAccessibilityStatus = prev; resolve(false); }, 3000);
    });
  }

  // 1. Direct Stop without popup
  const handleDirectStopAndSave = async () => {
    if (typeof window !== "undefined" && window.AppBridge) {
      try {
        window.AppBridge.postMessage(JSON.stringify({ action: "stopStrictTimer" }));
        window.AppBridge.postMessage(JSON.stringify({ action: "stopFocusNotification" }));
        window.AppBridge.postMessage(JSON.stringify({ action: "vibrate", type: "heavy" }));
      } catch (err) {}
    }

    const duration = seconds;
    setIsActive(false);
    if (faceVerificationEnabled) cleanupVerifiedMode();

    if (!userId || !startTime) {
      setSeconds(0);
      return;
    }

    setSaving(true);
    try {
      await flushDiffToDailyLogs(duration);
      const endedAt = new Date();
      const streakResult = await saveFocusSession(userId, startTime, endedAt);
      if (streakResult.countedForStreak) {
        setCurrentStreak(streakResult.newStreak);
        setPostStreakResult({ counted: true, newStreak: streakResult.newStreak });
      } else {
        setPostStreakResult({ counted: false, newStreak: currentStreak });
      }
    } catch (_) {}

    setSaving(false);
    setSeconds(0);
    lastSyncedSecondsRef.current = 0;
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.AppBridge) {
      setIsNativeApp(true);
    }

    if (typeof window !== "undefined") {
      // Direct stop action from Notification
      window.onNativeDirectStopFocus = () => {
        handleDirectStopAndSave();
      };
      window.onNativeRequestStopFocus = () => {
        handleDirectStopAndSave();
      };
      window.onNativeFocusTimerSync = (secs: number) => {
        setSeconds(secs);
      };
      // Option 2 Restore
      window.onNativeRestoreActiveSession = (sess) => {
        if (sess && sess.elapsedSeconds > 0) {
          setIsActive(true);
          setSelectedSub((sess.subject as SubjectType) || "Physics");
          setSelectedTask((sess.mode === "Practice" ? "questions" : sess.mode === "Theory" ? "theory" : "revision") as StudyTaskType);
          setSeconds(sess.elapsedSeconds);
          setFaceVerificationEnabled(sess.camEnabled);
          setAppBlockerEnabled(sess.blockerEnabled);
          setStartTime(new Date(Date.now() - sess.elapsedSeconds * 1000));
        }
      };
    }

    const savedFace = localStorage.getItem("prepwise_face_toggle");
    const savedBlocker = localStorage.getItem("prepwise_blocker_toggle");
    if (savedFace === "true") setFaceVerificationEnabled(true);
    if (savedBlocker === "true") setAppBlockerEnabled(true);

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
      }

      try {
        const streakInfo = await loadAndReconcileStreak(user.id);
        setCurrentStreak(streakInfo.currentStreak);
        if (streakInfo.streakWasReset) setStreakWasReset(true);
      } catch (e) {}
    }
    loadUser();

    const savedAllowed = localStorage.getItem("prepwise_allowed_apps");
    if (savedAllowed) {
      try { setAllowedApps(JSON.parse(savedAllowed)); } catch (e) {}
    }

    if (typeof window !== "undefined" && window.__nativeInstalledApps && window.__nativeInstalledApps.length > 0) {
      applyNativeApps(window.__nativeInstalledApps);
    } else {
      if (typeof window !== "undefined") {
        window.onInstalledAppsReady = (apps) => applyNativeApps(apps);
      }
      setTimeout(() => {
        if (!appsLoaded) {
          setAllApps(WEB_FALLBACK_APPS);
          setAppsLoaded(true);
        }
      }, 2000);
    }
  }, []);

  useEffect(() => {
    if (!isNativeApp) return;
    checkOverlayPermission();
    checkUsagePermission();
  }, [isNativeApp]);

  // Point 1: Cam toggle with overlay redirect & toast
  async function handleFaceToggle() {
    const next = !faceVerificationEnabled;
    if (next) {
      if (isNativeApp) {
        const granted = await checkOverlayPermission();
        if (!granted) {
          try {
            window.AppBridge!.postMessage(JSON.stringify({ action: "requestOverlayPermission" }));
          } catch (_) {}
          let tries = 0;
          const poll = setInterval(async () => {
            tries++;
            const g = await checkOverlayPermission();
            if (g || tries > 30) {
              clearInterval(poll);
              if (g) {
                setFaceVerificationEnabled(true);
                localStorage.setItem("prepwise_face_toggle", "true");
              }
            }
          }, 1000);
          return;
        }
      }
      setFaceVerificationEnabled(true);
      localStorage.setItem("prepwise_face_toggle", "true");
    } else {
      setFaceVerificationEnabled(false);
      localStorage.setItem("prepwise_face_toggle", "false");
    }
  }

  async function handleAppBlockerToggle() {
    const next = !appBlockerEnabled;
    if (next) {
      if (isNativeApp) {
        const granted = await checkUsagePermission();
        if (!granted) {
          setShowUsageSteps(true);
          return;
        }
      }
      setAppBlockerEnabled(true);
      localStorage.setItem("prepwise_blocker_toggle", "true");
    } else {
      setAppBlockerEnabled(false);
      localStorage.setItem("prepwise_blocker_toggle", "false");
    }
  }

  async function handleUsagePermissionGranted() {
    const granted = await checkUsagePermission();
    if (granted) {
      setShowUsageSteps(false);
      setAppBlockerEnabled(true);
      localStorage.setItem("prepwise_blocker_toggle", "true");
    }
  }

  const filteredApps = appsSearch.trim()
    ? allApps.filter((a) => a.name.toLowerCase().includes(appsSearch.toLowerCase()))
    : allApps;

  const toggleAppAllowed = (appId: string) => {
    const updated = allowedApps.includes(appId)
      ? allowedApps.filter((id) => id !== appId)
      : [...allowedApps, appId];
    setAllowedApps(updated);
    localStorage.setItem("prepwise_allowed_apps", JSON.stringify(updated));

    if (isActive && appBlockerEnabled && typeof window !== "undefined" && window.AppBridge) {
      try {
        window.AppBridge.postMessage(JSON.stringify({ action: "startStrictTimer", allowedApps: updated }));
      } catch (err) {}
    }
  };

  const handleBlockAll = () => {
    setAllowedApps([]);
    localStorage.setItem("prepwise_allowed_apps", JSON.stringify([]));
    if (isActive && appBlockerEnabled && typeof window !== "undefined" && window.AppBridge) {
      try {
        window.AppBridge.postMessage(JSON.stringify({ action: "startStrictTimer", allowedApps: [] }));
      } catch (err) {}
    }
  };

  async function flushDiffToDailyLogs(currentSeconds: number) {
    if (!userId) return;
    const diffSeconds = currentSeconds - lastSyncedSecondsRef.current;
    if (diffSeconds <= 0) return;
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes <= 0) return;

    const today = new Date().toISOString().split("T")[0];
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
      { user_id: userId, log_date: today, study_time_minutes: newMins, theory_minutes: newTheory, practice_minutes: newPractice, revision_minutes: newRevision },
      { onConflict: "user_id,log_date" }
    );
    lastSyncedSecondsRef.current += diffMinutes * 60;
  }

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
      if (typeof window !== "undefined" && window.AppBridge) {
        try { window.AppBridge.postMessage(JSON.stringify({ action: "requestCamera" })); } catch (_) {}
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraError(null);
      return true;
    } catch (e: any) {
      setCameraError("Camera permission required for Face Verification.");
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
      const result = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.4 }));
      detected = !!result;
    } catch (e) { detected = false; }

    if (detected) {
      missedChecksRef.current = 0;
      setPresencePaused((prev) => {
        if (prev) {
          if (typeof window !== "undefined" && window.AppBridge) {
            try { window.AppBridge.postMessage(JSON.stringify({ action: "updateCamStatus", status: "verified" })); } catch (_) {}
          }
          return false;
        }
        return prev;
      });
    } else {
      missedChecksRef.current += 1;
      if (missedChecksRef.current >= MAX_CONSECUTIVE_MISSES) {
        setPresencePaused((prev) => {
          if (!prev) {
            if (typeof window !== "undefined" && window.AppBridge) {
              try { window.AppBridge.postMessage(JSON.stringify({ action: "updateCamStatus", status: "lost" })); } catch (_) {}
            }
            return true;
          }
          return prev;
        });
      }
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
    if (faceVerificationEnabled) {
      setCameraError(null);
      const camOk = await startCamera();
      if (!camOk) return;
      await loadFaceModels();
      missedChecksRef.current = 0;
      lastPresenceLogSecondsRef.current = 0;
      sessionIdRef.current = `${Date.now()}`;
      presenceIntervalRef.current = setInterval(runPresenceCheck, PRESENCE_CHECK_INTERVAL_SECONDS * 1000);
    }

    if (typeof window !== "undefined" && window.AppBridge) {
      try {
        window.AppBridge.postMessage(JSON.stringify({
          action: "startFocusNotification",
          subject: selectedSub,
          mode: selectedTask === "questions" ? "Practice" : selectedTask === "theory" ? "Theory" : "Revision",
          initialSeconds: 0,
          camEnabled: faceVerificationEnabled,
          blockerEnabled: appBlockerEnabled,
          allowedApps: appBlockerEnabled ? allowedApps : [],
        }));
        window.AppBridge.postMessage(JSON.stringify({ action: "vibrate", type: "light" }));
      } catch (err) {}
    }

    setShowPreModal(false);
    setSeconds(0);
    lastSyncedSecondsRef.current = 0;
    setStartTime(new Date());
    setIsActive(true);
    setPresencePaused(false);
    setPostStreakResult(null);
  };

  const handleSaveManualEntry = async () => {
    if (!userId) return;
    setSaving(true);
    setManualError(null);
    try {
      const { data: dailyRow } = await supabase.from("daily_logs").select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes").eq("user_id", userId).eq("log_date", manualDate).maybeSingle();
      const newMins = (dailyRow?.study_time_minutes || 0) + manualMinutes;
      const newTheory = (dailyRow?.theory_minutes || 0) + (manualTask === "theory" ? manualMinutes : 0);
      const newPractice = (dailyRow?.practice_minutes || 0) + (manualTask === "questions" ? manualMinutes : 0);
      const newRevision = (dailyRow?.revision_minutes || 0) + (manualTask === "revision" ? manualMinutes : 0);

      await supabase.from("daily_logs").upsert(
        { user_id: userId, log_date: manualDate, study_time_minutes: newMins, theory_minutes: newTheory, practice_minutes: newPractice, revision_minutes: newRevision },
        { onConflict: "user_id,log_date" }
      );

      const today = new Date().toISOString().split("T")[0];
      if (manualDate === today && newMins * 60 >= MIN_STREAK_SECONDS) {
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

  function ToggleSwitch({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`shrink-0 w-11 h-6 rounded-full flex items-center px-0.5 transition-all duration-200 ${on ? "bg-teal justify-end" : "bg-ink/15 justify-start"} ${disabled ? "opacity-40" : ""}`}
      >
        <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-28">
      <AppHeader />
      <video ref={videoRef} muted playsInline className="hidden" />

      <main className="max-w-md mx-auto px-5 pt-4 flex flex-col gap-5">
        {/* Header */}
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

        {/* Streak banner */}
        {(currentStreak > 0 || streakWasReset) && (
          <div className={`rounded-ticket border px-4 py-3 flex items-center gap-3 ${streakWasReset ? "bg-coral/10 border-coral/20" : "bg-marigold/10 border-marigold/20"}`}>
            <span className="text-xl">{streakWasReset ? "💔" : "🔥"}</span>
            <div>
              <p className="text-xs font-bold text-ink">
                {streakWasReset ? "Streak reset — you missed a day" : `${currentStreak}-day streak`}
              </p>
              <p className="text-[10px] text-slate">
                {streakWasReset ? "Start a session today to begin a new streak." : "Keep it going — study at least 2 min today!"}
              </p>
            </div>
          </div>
        )}

        {postStreakResult && (
          <div className="rounded-ticket border border-teal/20 bg-teal/10 px-4 py-3 flex items-center gap-3">
            <span className="text-xl">{postStreakResult.counted ? "🔥" : "⏱️"}</span>
            <div>
              <p className="text-xs font-bold text-ink">
                {postStreakResult.counted ? `Streak updated: ${postStreakResult.newStreak} day${postStreakResult.newStreak !== 1 ? "s" : ""}!` : "Session saved & logged ✓ (min 2 min for streak count)"}
              </p>
            </div>
          </div>
        )}

        {/* Presence paused banner */}
        {isActive && presencePaused && (
          <div className="rounded-ticket border border-coral/30 bg-coral/10 px-4 py-3 flex items-center gap-3">
            <span className="text-xl">⏸️</span>
            <div>
              <p className="text-xs font-bold text-ink">Paused — we can't see you</p>
              <p className="text-[10px] text-slate">Come back into camera view to resume your timer.</p>
            </div>
          </div>
        )}

        {cameraError && (
          <div className="rounded-ticket border border-coral/30 bg-coral/10 px-4 py-3">
            <p className="text-xs font-bold text-ink">⚠️ {cameraError}</p>
          </div>
        )}

        {/* Main Timer Card */}
        <div className="bg-white rounded-ticket border border-ink/10 p-6 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="text-[11px] font-bold text-slate uppercase tracking-wider mb-2 flex items-center gap-1.5">
            {isActive && faceVerificationEnabled && (
              <span className={`inline-block w-2 h-2 rounded-full ${presencePaused ? "bg-coral animate-pulse" : "bg-teal"}`} />
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
              ▶ Start Study Timer
            </button>
          ) : (
            <button
              disabled={saving}
              onClick={handleDirectStopAndSave}
              className="mt-4 px-8 py-3.5 bg-rose-600 text-white font-bold text-sm rounded-2xl shadow-md shadow-rose-600/20 hover:bg-rose-700 transition-all"
            >
              {saving ? "Saving..." : "■ Stop & Log Session"}
            </button>
          )}
        </div>

        {/* Feature Toggles */}
        <div className="bg-white rounded-ticket border border-ink/10 shadow-xs overflow-hidden">
          <div className="bg-marigold/10 border-b border-marigold/20 px-4 py-2.5 flex items-start gap-2">
            <span className="text-sm mt-0.5">🏆</span>
            <p className="text-[10px] text-ink/70 leading-relaxed">
              <span className="font-bold text-ink">Leaderboard entries</span> are counted when{" "}
              <span className="font-bold text-marigold">both toggles are ON</span>. Study data is always saved regardless.
            </p>
          </div>

          {/* Face Verification Toggle */}
          <div className="px-4 py-4 border-b border-ink/6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${faceVerificationEnabled ? "bg-teal/15" : "bg-ink/5"}`}>
                  <span className="text-lg">🎥</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-ink">Face Verification</p>
                  <p className="text-[10px] text-slate mt-0.5 leading-relaxed">
                    {faceVerificationEnabled
                      ? overlayGranted
                        ? "✓ Active — timer pauses if you leave"
                        : "⏳ Please allow 'Display over other apps'..."
                      : "Camera confirms you're present. Nothing recorded or uploaded."}
                  </p>
                </div>
              </div>
              <ToggleSwitch
                on={faceVerificationEnabled && overlayGranted}
                onToggle={handleFaceToggle}
                disabled={isActive}
              />
            </div>
          </div>

          {/* App Blocker Toggle */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${appBlockerEnabled ? "bg-rose-50" : "bg-ink/5"}`}>
                  <span className="text-lg">🛡️</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-ink">App Blocker</p>
                  <p className="text-[10px] text-slate mt-0.5 leading-relaxed">
                    {appBlockerEnabled
                      ? usageGranted
                        ? `✓ Active — ${allowedApps.length === 0 ? "all apps blocked" : `${allowedApps.length} app allowed`}`
                        : "⏳ Waiting for Usage Access..."
                      : "Blocks distracting apps during study. Needs Usage Access."}
                  </p>
                </div>
              </div>
              <ToggleSwitch
                on={appBlockerEnabled && usageGranted}
                onToggle={handleAppBlockerToggle}
                disabled={isActive}
              />
            </div>

            {appBlockerEnabled && usageGranted && (
              <div className="mt-3 ml-12">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-slate font-medium">
                    {allowedApps.length === 0 ? "🔒 All apps blocked" : `${allowedApps.length} app(s) allowed`}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowAppsModal(true); setAppsSearch(""); }}
                    className="text-[11px] font-bold text-teal bg-teal/10 hover:bg-teal/20 px-2.5 py-1 rounded-lg border border-teal/20 transition-all flex items-center gap-1 shadow-2xs"
                  >
                    <span>⚙️</span>
                    <span>Manage Allowed Apps</span>
                  </button>
                </div>

                {allowedApps.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {allowedApps.map((id) => {
                      const app = allApps.find((a) => a.id === id) || { name: id, icon: "📱" };
                      return (
                        <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal/10 border border-teal/20 text-teal text-[10px] font-bold">
                          <span>{app.icon} {app.name}</span>
                          <button type="button" onClick={() => toggleAppAllowed(id)} className="hover:text-rose-500 ml-0.5 font-bold">
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Allowed Apps Modal (Point 4: Clean list, + Add App removed) */}
      {showAppsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-ink/10 max-h-[85vh] flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <span>🛡️</span> Select Allowed Apps
                </h3>
                <p className="text-[10px] text-slate mt-0.5">
                  Keep select apps unlocked. All other apps stay blocked.
                  {isNativeApp && <span className="ml-1 text-teal font-bold">• {allApps.length} installed</span>}
                </p>
              </div>
              <button onClick={() => setShowAppsModal(false)} className="w-7 h-7 rounded-full bg-ink/5 text-xs text-ink/70 flex items-center justify-center font-bold">✕</button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={appsSearch}
                onChange={(e) => setAppsSearch(e.target.value)}
                placeholder="Search installed apps..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-ink/15 focus:border-teal outline-none pl-7"
              />
              <span className="absolute left-2.5 top-2.5 text-slate/50 text-xs">🔍</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate font-medium">Tap app to Whitelist/Block:</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = filteredApps.map((a) => a.id);
                    setAllowedApps(allIds);
                    localStorage.setItem("prepwise_allowed_apps", JSON.stringify(allIds));
                  }}
                  className="text-[10px] font-bold text-teal bg-teal/10 px-2 py-1 rounded-lg border border-teal/20"
                >
                  Select All
                </button>
                {allowedApps.length > 0 && (
                  <button type="button" onClick={handleBlockAll} className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                    Block All
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 pr-1">
              {!appsLoaded ? (
                <p className="text-[11px] text-slate text-center py-6">Loading apps…</p>
              ) : filteredApps.length === 0 ? (
                <p className="text-[11px] text-slate text-center py-6">No apps found</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredApps.map((app) => {
                    const isAllowed = allowedApps.includes(app.id);
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => toggleAppAllowed(app.id)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${isAllowed ? "bg-teal/10 border-teal/40 text-teal shadow-2xs" : "bg-paper/40 border-ink/10 text-slate hover:bg-paper"}`}
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
              )}
            </div>

            <button type="button" onClick={() => setShowAppsModal(false)} className="w-full py-3 rounded-xl bg-ink text-white font-bold text-xs shadow-md">
              Save Allowed Apps ({allowedApps.length} Allowed)
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

            <div className={`rounded-xl px-3 py-2.5 border text-[10px] leading-relaxed ${isVerifiedSession ? "bg-teal/8 border-teal/25 text-teal" : "bg-ink/5 border-ink/10 text-slate"}`}>
              {isVerifiedSession
                ? "✅ Verified session — counts for Leaderboard!"
                : `ℹ️ ${!faceVerificationEnabled && !appBlockerEnabled ? "Both toggles off" : !faceVerificationEnabled ? "Face Verification off" : "App Blocker off"}. Study data is saved to your personal stats.`}
            </div>

            <button
              onClick={handleStartSession}
              disabled={modelsLoading}
              className="w-full py-3 rounded-xl bg-teal text-white font-bold text-xs shadow-md shadow-teal/20 hover:bg-teal/90 disabled:opacity-50"
            >
              {modelsLoading ? "Loading camera check…" : "▶ Start Study Timer"}
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
            {manualError && <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2 rounded-lg">⚠️ {manualError}</p>}
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
                <input type="number" min={1} value={manualMinutes} onChange={(e) => setManualMinutes(parseInt(e.target.value) || 0)}
                  className="w-full p-2 text-center text-xs font-bold rounded-lg border border-ink/15" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate block mb-1">Questions</label>
                <input type="number" min={0} value={manualQs} onChange={(e) => setManualQs(parseInt(e.target.value) || 0)}
                  className="w-full p-2 text-center text-xs font-bold rounded-lg border border-ink/15" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate block mb-1">Date</label>
              <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="w-full p-2 text-xs rounded-lg border border-ink/15" />
            </div>
            <button disabled={saving} onClick={handleSaveManualEntry} className="w-full py-2.5 rounded-xl bg-ink text-paper font-bold text-xs">
              {saving ? "Saving..." : "Add to Daily Study Hours"}
            </button>
          </div>
        </div>
      )}

      {/* Usage Access Modal */}
      {showUsageSteps && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                🛡️ Enable App Blocker
              </h3>
              <button onClick={() => setShowUsageSteps(false)} className="w-6 h-6 rounded-full bg-ink/5 text-xs text-ink/60 flex items-center justify-center">✕</button>
            </div>
            <p className="text-[11px] text-slate leading-relaxed">
              App Blocker needs <span className="font-bold text-ink">Usage Access</span> permission to detect which apps you open and block them during study.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  try { window.AppBridge!.postMessage(JSON.stringify({ action: "requestUsagePermission" })); } catch (_) {}
                }}
                className="w-full py-3 rounded-xl bg-teal text-white font-bold text-xs shadow-md shadow-teal/20"
              >
                Open Settings →
              </button>
              <button
                onClick={handleUsagePermissionGranted}
                className="w-full py-2.5 rounded-xl bg-ink/8 text-ink font-bold text-xs"
              >
                ✓ Done, I granted it
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
