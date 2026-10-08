// app/focus/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { loadAndReconcileStreak, MIN_STREAK_SECONDS } from "@/lib/focus";
import AppHeader from "@/components/dashboard/AppHeader";
import BottomNav from "@/components/dashboard/BottomNav";

type SubjectType = "Physics" | "Chemistry" | "Mathematics" | "Biology";
type StudyTaskType = "theory" | "questions" | "revision";

interface AppItem {
  id: string; // Android packageName
  name: string;
  icon: string;
}

const WEB_FALLBACK_APPS: AppItem[] = [
  { id: "com.google.android.youtube", name: "YouTube", icon: "▶️" },
  { id: "com.whatsapp", name: "WhatsApp", icon: "💬" },
  { id: "com.google.android.calculator", name: "Calculator", icon: "🧮" },
  { id: "com.google.android.apps.pdfviewer", name: "PDF Viewer", icon: "📄" },
  { id: "org.telegram.messenger", name: "Telegram", icon: "✈️" },
  { id: "com.instagram.android", name: "Instagram", icon: "📸" },
  { id: "com.google.android.apps.docs", name: "Google Docs", icon: "📝" },
  { id: "com.adobe.reader", name: "Adobe Acrobat Reader", icon: "📕" },
];

function nativeToAppItem(n: { name: string; packageName: string }): AppItem {
  return { id: n.packageName, name: n.name, icon: "📱" };
}

const SYNC_INTERVAL_SECONDS = 60;

export default function FocusPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [targetExam, setTargetExam] = useState<string>("JEE");

  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [, setStreakWasReset] = useState(false);

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

  // ─── REDESIGNED FROM/TO TIME MODAL STATE ───
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualSub, setManualSub] = useState<SubjectType>("Physics");
  const [manualTask, setManualTask] = useState<StudyTaskType>("questions");
  const [manualFromTime, setManualFromTime] = useState<string>("14:00");
  const [manualToTime, setManualToTime] = useState<string>("16:30");
  const [manualDate, setManualDate] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  });
  const [manualError, setManualError] = useState<string | null>(null);

  const [faceVerificationEnabled, setFaceVerificationEnabled] = useState(false);
  const [appBlockerEnabled, setAppBlockerEnabled] = useState(false);

  const [overlayGranted, setOverlayGranted] = useState(false);
  const [usageGranted, setUsageGranted] = useState(false);
  const [showUsageSteps, setShowUsageSteps] = useState(false);

  const [nativeCamPaused, setNativeCamPaused] = useState(false);

  const availableSubjects: SubjectType[] =
    targetExam === "NEET"
      ? ["Physics", "Chemistry", "Biology"]
      : ["Physics", "Chemistry", "Mathematics"];

  const isVerifiedSession = faceVerificationEnabled && appBlockerEnabled && overlayGranted && usageGranted;

  const handleDirectStopAndSaveRef = useRef<(options?: { alreadyLogged?: boolean; elapsedSeconds?: number }) => Promise<void>>(() => Promise.resolve());

  // ─── LIVE CALCULATED TIME IN MINUTES ───
  const computedManualMinutes = useMemo(() => {
    if (!manualFromTime || !manualToTime) return 0;
    const [fH, fM] = manualFromTime.split(":").map(Number);
    const [tH, tM] = manualToTime.split(":").map(Number);
    let diff = (tH * 60 + tM) - (fH * 60 + fM);
    if (diff < 0) diff += 24 * 60; // Crosses midnight
    return diff;
  }, [manualFromTime, manualToTime]);

  const formattedComputedDuration = useMemo(() => {
    const hrs = Math.floor(computedManualMinutes / 60);
    const mins = computedManualMinutes % 60;
    if (hrs === 0) return `${mins} mins`;
    return `${hrs}h ${mins > 0 ? mins + "m" : ""} (${computedManualMinutes} mins)`;
  }, [computedManualMinutes]);

  function applyNativeApps(nativeList: any[]) {
    if (!Array.isArray(nativeList) || nativeList.length === 0) {
      setAllApps(WEB_FALLBACK_APPS);
      setAppsLoaded(true);
      return;
    }
    const mapped = nativeList.map(nativeToAppItem);
    setAllApps(mapped);
    setAppsLoaded(true);
  }

  async function checkOverlayPermission(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    const w = window as any;
    if (!w.AppBridge) return false;
    return new Promise<boolean>((resolve) => {
      const prev = w.onOverlayPermissionResult;
      w.onOverlayPermissionResult = (granted: boolean) => {
        w.onOverlayPermissionResult = prev;
        setOverlayGranted(granted);
        resolve(granted);
      };
      try {
        w.AppBridge.postMessage(JSON.stringify({ action: "checkOverlayPermission" }));
      } catch (_) { resolve(false); }
      setTimeout(() => { w.onOverlayPermissionResult = prev; resolve(false); }, 3000);
    });
  }

  async function checkUsagePermission(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    const w = window as any;
    if (!w.AppBridge) return false;
    return new Promise<boolean>((resolve) => {
      const prev = w.onAccessibilityStatus;
      w.onAccessibilityStatus = (granted: boolean) => {
        w.onAccessibilityStatus = prev;
        setUsageGranted(granted);
        resolve(granted);
      };
      try {
        w.AppBridge.postMessage(JSON.stringify({ action: "checkUsagePermission" }));
      } catch (_) { resolve(false); }
      setTimeout(() => { w.onAccessibilityStatus = prev; resolve(false); }, 3000);
    });
  }

  const handleDirectStopAndSave = async (options?: { alreadyLogged?: boolean; elapsedSeconds?: number }) => {
    setIsActive(false);
    setNativeCamPaused(false);

    const effectiveUid = userId || (typeof window !== "undefined" ? (window as any).__nativeAuth?.userId : null);

    if (options?.alreadyLogged) {
      setSeconds(0);
      lastSyncedSecondsRef.current = 0;
      if (effectiveUid) {
        try {
          const streakInfo = await loadAndReconcileStreak(effectiveUid);
          setCurrentStreak(streakInfo.currentStreak);
        } catch (_) {}
      }
      return;
    }

    const endedAt = new Date();
    const durationSecs = Math.max(
      seconds,
      options?.elapsedSeconds || 0,
      startTime ? Math.round((endedAt.getTime() - startTime.getTime()) / 1000) : 0
    );

    if (!effectiveUid || durationSecs <= 0) {
      setSeconds(0);
      lastSyncedSecondsRef.current = 0;
      if (typeof window !== "undefined") {
        const bridge = (window as any).AppBridge;
        if (bridge) {
          try {
            bridge.postMessage(JSON.stringify({ action: "stopStrictTimer" }));
            bridge.postMessage(JSON.stringify({ action: "stopFocusNotification", alreadyLogged: true }));
          } catch (_) {}
        }
      }
      return;
    }

    setSaving(true);
    try {
      const countsForStreak = durationSecs >= MIN_STREAK_SECONDS;
      const validSub = selectedSub || "Physics";
      const validMode = selectedTask || "questions";
      const taskModeString = validMode === "questions" ? "Practice" : validMode === "theory" ? "Theory" : "Revision";

      // 1. Calculate unsynced minutes and update daily_logs
      const remainingSecs = Math.max(0, durationSecs - lastSyncedSecondsRef.current);
      const remainingMins = Math.max(1, Math.round(remainingSecs / 60));
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

      const { data: dailyRow } = await supabase
        .from("daily_logs")
        .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes, verified_minutes")
        .eq("user_id", effectiveUid)
        .eq("log_date", today)
        .maybeSingle();

      const newMins = (dailyRow?.study_time_minutes || 0) + remainingMins;
      const newTheory = (dailyRow?.theory_minutes || 0) + (validMode === "theory" ? remainingMins : 0);
      const newPractice = (dailyRow?.practice_minutes || 0) + (validMode === "questions" ? remainingMins : 0);
      const newRevision = (dailyRow?.revision_minutes || 0) + (validMode === "revision" ? remainingMins : 0);
      const newVerified = (dailyRow?.verified_minutes || 0) + (isVerifiedSession ? remainingMins : 0);

      await supabase.from("daily_logs").upsert(
        {
          user_id: effectiveUid,
          log_date: today,
          study_time_minutes: newMins,
          theory_minutes: newTheory,
          practice_minutes: newPractice,
          revision_minutes: newRevision,
          verified_minutes: newVerified,
        },
        { onConflict: "user_id,log_date" }
      );
      lastSyncedSecondsRef.current = durationSecs;

      // 2. Direct session insert into focus_sessions
      const effectiveStart = startTime || new Date(endedAt.getTime() - durationSecs * 1000);
      try {
        await supabase.from("focus_sessions").insert({
          user_id: effectiveUid,
          started_at: effectiveStart.toISOString(),
          ended_at: endedAt.toISOString(),
          duration_seconds: durationSecs,
          counts_for_streak: countsForStreak,
          subject: validSub,
          task_type: validMode,
          mode: taskModeString,
          verified: isVerifiedSession,
        });
      } catch (err) {
        console.error("Direct session insert err:", err);
      }

      // 3. Auto-log questions if practice mode
      if (validMode === "questions" && remainingMins >= 2) {
        try {
          const estQs = Math.max(1, Math.round(remainingMins * 0.75));
          await supabase.from("question_logs").insert({
            user_id: effectiveUid,
            question_count: estQs,
            log_date: today,
            source: "timer",
          });
        } catch (_) {}
      }

      // 4. Notify native bridge that session has already been logged by Web
      if (typeof window !== "undefined") {
        const bridge = (window as any).AppBridge;
        if (bridge) {
          try {
            bridge.postMessage(JSON.stringify({ action: "stopStrictTimer" }));
            bridge.postMessage(JSON.stringify({ action: "stopFocusNotification", alreadyLogged: true }));
            bridge.postMessage(JSON.stringify({ action: "vibrate", type: "heavy" }));
          } catch (err) {}
        }
      }

      // 5. Reconcile streak
      const streakInfo = await loadAndReconcileStreak(effectiveUid);
      setCurrentStreak(streakInfo.currentStreak);
      setPostStreakResult({ counted: countsForStreak, newStreak: streakInfo.currentStreak });
    } catch (_) {}

    setSaving(false);
    setSeconds(0);
    lastSyncedSecondsRef.current = 0;
  };

  handleDirectStopAndSaveRef.current = handleDirectStopAndSave;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const w = window as any;
      if (w.AppBridge) {
        setIsNativeApp(true);
        try {
          w.AppBridge.postMessage(JSON.stringify({ action: "getInstalledApps" }));
        } catch (_) {}
      }

      w.onNativeDirectStopFocus = (payload?: any) => { handleDirectStopAndSaveRef.current(payload); };
      w.onNativeRequestStopFocus = () => { handleDirectStopAndSaveRef.current(); };
      w.onDirectLoggedSession = (payload?: any) => { handleDirectStopAndSaveRef.current(payload || { alreadyLogged: true }); };
      w.onNativeFocusTimerSync = (secs: number) => { setSeconds(secs); };
      w.onNativeRestoreActiveSession = (sess: any) => {
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

      if (w.__nativeInstalledApps && w.__nativeInstalledApps.length > 0) {
        applyNativeApps(w.__nativeInstalledApps);
      } else {
        w.onInstalledAppsReady = (apps: any) => applyNativeApps(apps);
        setTimeout(() => {
          if (!appsLoaded) {
            setAllApps(WEB_FALLBACK_APPS);
            setAppsLoaded(true);
          }
        }, 2000);
      }
    }

    const savedFace = localStorage.getItem("prepwise_face_toggle");
    const savedBlocker = localStorage.getItem("prepwise_blocker_toggle");
    if (savedFace === "true") setFaceVerificationEnabled(true);
    if (savedBlocker === "true") setAppBlockerEnabled(true);

    async function loadUser() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      const uid = user?.id || (typeof window !== "undefined" ? (window as any).__nativeAuth?.userId : null);
      if (!uid) return;
      setUserId(uid);

      const { data: profile } = await supabase
        .from("users")
        .select("target_exam")
        .eq("uid", uid)
        .maybeSingle();

      if (profile?.target_exam) setTargetExam(profile.target_exam);

      try {
        const streakInfo = await loadAndReconcileStreak(uid);
        setCurrentStreak(streakInfo.currentStreak);
        if (streakInfo.streakWasReset) setStreakWasReset(true);
      } catch (e) {}
    }
    loadUser();

    const savedAllowed = localStorage.getItem("prepwise_allowed_apps");
    if (savedAllowed) {
      try { setAllowedApps(JSON.parse(savedAllowed)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (!isNativeApp) return;
    checkOverlayPermission();
    checkUsagePermission();
  }, [isNativeApp]);

  async function handleFaceToggle() {
    const next = !faceVerificationEnabled;
    if (next) {
      if (isNativeApp && typeof window !== "undefined") {
        const w = window as any;
        const granted = await checkOverlayPermission();
        if (!granted) {
          try { w.AppBridge?.postMessage(JSON.stringify({ action: "requestOverlayPermission" })); } catch (_) {}
          let tries = 0;
          const poll = setInterval(async () => {
            tries++;
            const g = await checkOverlayPermission();
            if (g || tries > 30) {
              clearInterval(poll);
              if (g) { setFaceVerificationEnabled(true); localStorage.setItem("prepwise_face_toggle", "true"); }
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
        if (!granted) { setShowUsageSteps(true); return; }
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
    if (isActive && appBlockerEnabled && typeof window !== "undefined") {
      const bridge = (window as any).AppBridge;
      if (bridge) {
        try {
          bridge.postMessage(JSON.stringify({ action: "startStrictTimer", allowedApps: updated }));
        } catch (err) {}
      }
    }
  };

  const handleBlockAll = () => {
    setAllowedApps([]);
    localStorage.setItem("prepwise_allowed_apps", JSON.stringify([]));
    if (isActive && appBlockerEnabled && typeof window !== "undefined") {
      const bridge = (window as any).AppBridge;
      if (bridge) {
        try {
          bridge.postMessage(JSON.stringify({ action: "startStrictTimer", allowedApps: [] }));
        } catch (err) {}
      }
    }
  };

  async function flushDiffToDailyLogs(currentSeconds: number, verifiedSession?: boolean) {
    if (!userId) return;
    const diffSeconds = currentSeconds - lastSyncedSecondsRef.current;
    if (diffSeconds <= 0) return;
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes <= 0) return;

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const { data: dailyRow } = await supabase
      .from("daily_logs")
      .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes, verified_minutes")
      .eq("user_id", userId)
      .eq("log_date", today)
      .maybeSingle();

    const newMins = (dailyRow?.study_time_minutes || 0) + diffMinutes;
    const newTheory = (dailyRow?.theory_minutes || 0) + (selectedTask === "theory" ? diffMinutes : 0);
    const newPractice = (dailyRow?.practice_minutes || 0) + (selectedTask === "questions" ? diffMinutes : 0);
    const newRevision = (dailyRow?.revision_minutes || 0) + (selectedTask === "revision" ? diffMinutes : 0);
    const newVerified = (dailyRow?.verified_minutes || 0) + (verifiedSession ? diffMinutes : 0);

    await supabase.from("daily_logs").upsert(
      { user_id: userId, log_date: today, study_time_minutes: newMins, theory_minutes: newTheory, practice_minutes: newPractice, revision_minutes: newRevision, verified_minutes: newVerified },
      { onConflict: "user_id,log_date" }
    );
    lastSyncedSecondsRef.current += diffMinutes * 60;
  }

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      syncIntervalRef.current = setInterval(() => {
        setSeconds((currentSeconds) => {
          flushDiffToDailyLogs(currentSeconds, isVerifiedSession);
          return currentSeconds;
        });
      }, SYNC_INTERVAL_SECONDS * 1000);
    } else if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
    return () => clearInterval(syncIntervalRef.current);
  }, [isActive, userId, selectedTask, faceVerificationEnabled, appBlockerEnabled, overlayGranted, usageGranted]);

  const handleStartSession = async () => {
    if (typeof window !== "undefined") {
      const bridge = (window as any).AppBridge;
      if (bridge) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          bridge.postMessage(JSON.stringify({
            action: "startFocusNotification",
            userId: userId,
            accessToken: session?.access_token || "",
            subject: selectedSub || "Physics",
            mode: selectedTask === "questions" ? "Practice" : selectedTask === "theory" ? "Theory" : "Revision",
            initialSeconds: 0,
            camEnabled: faceVerificationEnabled,
            blockerEnabled: appBlockerEnabled,
            allowedApps: appBlockerEnabled ? allowedApps : [],
          }));
          bridge.postMessage(JSON.stringify({ action: "vibrate", type: "light" }));
        } catch (err) {}
      }
    }

    setShowPreModal(false);
    setSeconds(0);
    lastSyncedSecondsRef.current = 0;
    setStartTime(new Date());
    setIsActive(true);
    setNativeCamPaused(false);
    setPostStreakResult(null);
  };

  // ==========================================
  // FROM / TO TIME LOGGING (AUTO-COMPUTED)
  // ==========================================
  const handleSaveManualEntry = async () => {
    if (!userId) return;
    if (computedManualMinutes <= 0) {
      setManualError("To Time must be after From Time");
      return;
    }

    setSaving(true);
    setManualError(null);
    try {
      const chosenSub = manualSub || "Physics";
      const chosenTask = manualTask || "questions";
      const chosenMinutes = computedManualMinutes;

      // 1. Fetch current daily log for chosen date
      const { data: dailyRow } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", manualDate)
        .maybeSingle();

      const newMins = (dailyRow?.study_time_minutes || 0) + chosenMinutes;
      const newTheory = (dailyRow?.theory_minutes || 0) + (chosenTask === "theory" ? chosenMinutes : 0);
      const newPractice = (dailyRow?.practice_minutes || 0) + (chosenTask === "questions" ? chosenMinutes : 0);
      const newRevision = (dailyRow?.revision_minutes || 0) + (chosenTask === "revision" ? chosenMinutes : 0);

      // 2. Prepare payload
      const logPayload: Record<string, any> = {
        user_id: userId,
        log_date: manualDate,
        study_time_minutes: newMins,
        theory_minutes: newTheory,
        practice_minutes: newPractice,
        revision_minutes: newRevision,
      };

      await supabase.from("daily_logs").upsert(
        logPayload,
        { onConflict: "user_id,log_date" }
      );

      // 3. Construct synthetic timestamp matching manualDate
      const [year, month, day] = manualDate.split("-").map(Number);
      const sessionDate = new Date();
      sessionDate.setFullYear(year, month - 1, day);
      const syntheticEnd = new Date(sessionDate);
      const syntheticStart = new Date(syntheticEnd.getTime() - chosenMinutes * 60 * 1000);

      // 4. Single Direct Insert into focus_sessions
      const sessionPayload: Record<string, any> = {
        user_id: userId,
        started_at: syntheticStart.toISOString(),
        ended_at: syntheticEnd.toISOString(),
        duration_seconds: chosenMinutes * 60,
        counts_for_streak: chosenMinutes * 60 >= MIN_STREAK_SECONDS,
        subject: chosenSub,
        task_type: chosenTask,
        mode: chosenTask === "questions" ? "Practice" : chosenTask === "theory" ? "Theory" : "Revision",
        verified: false,
      };

      await supabase.from("focus_sessions").insert(sessionPayload);

      // 5. Reconcile streak if today
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      if (manualDate === todayStr && newMins * 60 >= MIN_STREAK_SECONDS) {
        const streakInfo = await loadAndReconcileStreak(userId);
        setCurrentStreak(streakInfo.currentStreak);
      }

      setSaving(false);
      setShowManualModal(false);
    } catch (err: any) {
      setSaving(false);
      setManualError(err?.message || "Failed to save entry");
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
        disabled={disabled}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          disabled ? "opacity-40 cursor-not-allowed" : ""
        } ${on ? "bg-teal-500" : "bg-slate-700"}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            on ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-24 select-none">
      <AppHeader />

      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-4 space-y-4">
        {/* Verification Status Banner */}
        {isActive && (
          <div
            className={`p-3 rounded-2xl border text-xs flex items-center justify-between transition-all ${
              isVerifiedSession
                ? "bg-teal-950/40 border-teal-500/40 text-teal-300"
                : "bg-slate-900 border-slate-800 text-slate-400"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isVerifiedSession ? "bg-teal-400 animate-pulse" : "bg-slate-500"}`} />
              <span className="font-medium">
                {isVerifiedSession ? "Strict Leaderboard Verified" : "Personal Study Mode"}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {faceVerificationEnabled && appBlockerEnabled ? "Cam & Block Active" : "Unmonitored"}
            </span>
          </div>
        )}

        {/* Camera Warning Banner (Live detection pause) */}
        {isActive && faceVerificationEnabled && nativeCamPaused && (
          <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-2xl flex items-center justify-between text-xs text-red-200 animate-pulse">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>Face missing — Timer paused</span>
            </div>
            <span className="text-[10px] bg-red-900/60 px-2 py-0.5 rounded-full font-mono">PAUSED</span>
          </div>
        )}

        {/* Main Stopwatch Cockpit */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-xl backdrop-blur relative overflow-hidden">
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
            {isActive && faceVerificationEnabled && (
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
            <span>
              {isActive ? `🔥 Studying ${selectedSub} (${selectedTask})` : "Ready to focus?"}
            </span>
          </div>

          <div className="font-mono text-5xl md:text-6xl font-black tracking-tight text-white py-2">
            {formatTimer(seconds)}
          </div>

          {!isActive ? (
            <div className="space-y-2">
              <button
                onClick={() => setShowPreModal(true)}
                className="w-full py-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-2xl shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all text-base flex items-center justify-center gap-2"
              >
                <span>▶ Start Focus Mode</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleDirectStopAndSave()}
              disabled={saving}
              className="w-full py-4 bg-red-500 hover:bg-red-400 text-white font-bold rounded-2xl shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all text-base disabled:opacity-50"
            >
              {saving ? "Saving..." : "■ Stop & Log Session"}
            </button>
          )}

          {postStreakResult && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
              {postStreakResult.counted ? (
                <span>🎉 Qualified! Current Streak: <strong>{postStreakResult.newStreak} days</strong></span>
              ) : (
                <span>Session logged. Study for 2+ mins to count for daily streak!</span>
              )}
            </div>
          )}
        </div>

        {/* ─── DUAL-TOGGLE STRICT MODE CONTROL PANEL ─── */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Strict Verification Toggles
            </span>
            <span className="text-[10px] text-teal-400 font-medium">Required for Leaderboard</span>
          </div>

          {/* Toggle 1: Face Verification */}
          <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm">📷</span>
                <span className="text-xs font-semibold text-slate-200">Face Verification</span>
                {faceVerificationEnabled && (
                  <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.2 rounded font-mono">ON</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Continuous presence check · Pauses timer if face lost
              </p>
            </div>
            <ToggleSwitch
              on={faceVerificationEnabled}
              onToggle={handleFaceToggle}
              disabled={isActive}
            />
          </div>

          {/* Toggle 2: App Blocker / Strict Lock */}
          <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🛡️</span>
                  <span className="text-xs font-semibold text-slate-200">Block Distracting Apps</span>
                  {appBlockerEnabled && (
                    <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.2 rounded font-mono">ON</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Blocks all apps except your allowed list
                </p>
              </div>
              <ToggleSwitch
                on={appBlockerEnabled}
                onToggle={handleAppBlockerToggle}
                disabled={isActive}
              />
            </div>

            {/* Allowed Apps Selector Container */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-medium">Whitelist:</span>
                <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-800 rounded-md text-teal-300 font-semibold">
                  {allowedApps.length} Allowed
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAppsModal(true)}
                className="text-xs font-bold bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 px-3 py-1.5 rounded-lg active:scale-95 transition-all flex items-center gap-1.5"
              >
                <span>Select Allowed Apps</span>
                <span className="text-[10px]">⚙️</span>
              </button>
            </div>
          </div>
        </div>

        {/* Offline Manual Entry Trigger Button */}
        <button
          onClick={() => setShowManualModal(true)}
          className="w-full py-3 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-2xl text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          <span>✍️ Studied offline? Log From / To Time</span>
        </button>
      </main>

      {/* ─── PRE-SESSION LAUNCH MODAL ─── */}
      {showPreModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white text-center">Customize Focus Session</h3>

            {/* Subject Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Subject</label>
              <div className="grid grid-cols-3 gap-2">
                {availableSubjects.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSub(sub)}
                    className={`py-2 px-1 text-xs rounded-xl font-medium border text-center transition-all ${
                      selectedSub === sub
                        ? "bg-teal-500/20 border-teal-500 text-teal-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Task Type Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Focus Task</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "questions", label: "Questions" },
                  { id: "theory", label: "Theory" },
                  { id: "revision", label: "Revision" },
                ].map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedTask(task.id as StudyTaskType)}
                    className={`py-2 px-1 text-xs rounded-xl font-medium border text-center transition-all ${
                      selectedTask === task.id
                        ? "bg-teal-500/20 border-teal-500 text-teal-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    {task.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPreModal(false)}
                className="flex-1 py-3 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartSession}
                className="flex-1 py-3 bg-teal-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-teal-500/20"
              >
                Start Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ALLOWED APPS SELECTION MODAL ─── */}
      {showAppsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Allowed Apps (Whitelist)</h3>
                <p className="text-[11px] text-slate-400">All other installed apps will be blocked</p>
              </div>
              <button
                onClick={() => setShowAppsModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="Search installed apps..."
              value={appsSearch}
              onChange={(e) => setAppsSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleBlockAll}
                className="flex-1 py-1.5 text-[11px] font-semibold bg-red-950/40 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-900/30 transition-all"
              >
                Block All Apps
              </button>
              <span className="text-xs text-slate-400 self-center font-mono">
                {allowedApps.length} Allowed
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[200px]">
              {filteredApps.map((app) => {
                const isAllowed = allowedApps.includes(app.id);
                return (
                  <div
                    key={app.id}
                    onClick={() => toggleAppAllowed(app.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isAllowed
                        ? "bg-teal-950/40 border-teal-500/40 text-teal-200"
                        : "bg-slate-950/50 border-slate-800/80 text-slate-300 hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{app.icon}</span>
                      <div className="text-left">
                        <div className="text-xs font-semibold">{app.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate max-w-[170px]">
                          {app.id}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-xs w-5 h-5 rounded-md flex items-center justify-center font-bold ${
                        isAllowed ? "bg-teal-500 text-slate-950" : "border border-slate-700 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowAppsModal(false)}
              className="w-full py-3 bg-teal-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-teal-500/20"
            >
              Done ({allowedApps.length} Allowed)
            </button>
          </div>
        </div>
      )}

      {/* ─── REDESIGNED FROM / TO TIME LOGGING MODAL ─── */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Log Past Study Time</h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {manualError && (
              <div className="p-2.5 bg-red-950/50 border border-red-500/40 rounded-xl text-xs text-red-200">
                {manualError}
              </div>
            )}

            {/* Date Picker */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Date</label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* From & To Time Inputs */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">From Time</label>
                <input
                  type="time"
                  value={manualFromTime}
                  onChange={(e) => setManualFromTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">To Time</label>
                <input
                  type="time"
                  value={manualToTime}
                  onChange={(e) => setManualToTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Auto-Calculated Duration Preview Badge */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Calculated Study Duration</span>
              <span className="text-lg font-bold font-mono text-teal-400">
                {formattedComputedDuration}
              </span>
            </div>

            {/* Subject Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Subject</label>
              <div className="grid grid-cols-3 gap-1.5">
                {availableSubjects.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setManualSub(sub)}
                    className={`py-1.5 text-xs rounded-xl font-medium border text-center ${
                      manualSub === sub
                        ? "bg-teal-500/20 border-teal-500 text-teal-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Task Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Task Type</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "questions", label: "Questions" },
                  { id: "theory", label: "Theory" },
                  { id: "revision", label: "Revision" },
                ].map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setManualTask(task.id as StudyTaskType)}
                    className={`py-1.5 text-xs rounded-xl font-medium border text-center ${
                      manualTask === task.id
                        ? "bg-teal-500/20 border-teal-500 text-teal-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    {task.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSaveManualEntry}
              disabled={saving}
              className="w-full py-3 bg-teal-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-teal-500/20 disabled:opacity-50"
            >
              {saving ? "Saving..." : `Save ${formattedComputedDuration}`}
            </button>
          </div>
        </div>
      )}

      {/* ─── USAGE ACCESS PERMISSION GUIDE MODAL ─── */}
      {showUsageSteps && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Enable App Blocker Access</h3>
            <p className="text-xs text-slate-400">
              Android requires Usage Access permission to detect and block non-allowed apps.
            </p>

            <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside bg-slate-950 p-3 rounded-xl border border-slate-800">
              <li>Tap <strong>Open Settings</strong> below.</li>
              <li>Find <strong>PrepWise</strong> in the list.</li>
              <li>Toggle <strong>Allow usage access</strong> to ON.</li>
              <li>Return to PrepWise.</li>
            </ol>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowUsageSteps(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    const w = window as any;
                    w.AppBridge?.postMessage(JSON.stringify({ action: "requestUsagePermission" }));
                  }
                  handleUsagePermissionGranted();
                }}
                className="flex-1 py-2.5 bg-teal-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-teal-500/20"
              >
                Open Settings
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
