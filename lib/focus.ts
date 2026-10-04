// lib/focus.ts
import { supabase } from "@/lib/supabase";

export const MIN_STREAK_SECONDS = 120; // 2 minutes (qualifying study time)

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastFocusDate: string | null;
  streakWasReset: boolean;
}

// 1. Exact Indian Standard Time (IST) YYYY-MM-DD (No UTC midnight bugs!)
export function getIstDateStr(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function getYesterdayIstDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getIstDateStr(d);
}

function daysBetween(a: string, b: string) {
  const d1 = new Date(a + "T00:00:00Z").getTime();
  const d2 = new Date(b + "T00:00:00Z").getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Calculates real streak directly from daily_logs (the true historical record)
 * This guarantees that even if native Kotlin, offline logs, or background timer ran,
 * streak is NEVER wrongly reset!
 */
export async function calculateActualStreakFromLogs(userId: string): Promise<number> {
  const today = getIstDateStr();
  const yesterday = getYesterdayIstDateStr();

  // Fetch recent qualifying daily study logs
  const { data: logs } = await supabase
    .from("daily_logs")
    .select("log_date, study_time_minutes")
    .eq("user_id", userId)
    .gt("study_time_minutes", 1) // At least 2 min study
    .order("log_date", { ascending: false })
    .limit(90);

  if (!logs || logs.length === 0) return 0;

  const studiedDates = new Set(logs.map((l) => l.log_date));

  // Determine starting point
  let checkDate = new Date();
  if (!studiedDates.has(today)) {
    // If not studied today yet, check if studied yesterday
    if (!studiedDates.has(yesterday)) {
      // Missed both today and yesterday -> streak broken
      return 0;
    }
    // Studied yesterday -> streak still alive starting from yesterday!
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let streak = 0;
  while (true) {
    const dateStr = getIstDateStr(checkDate);
    if (studiedDates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Call this when Dashboard or Focus loads.
 * Reconciles streak accurately using IST dates and daily_logs verification.
 */
export async function loadAndReconcileStreak(userId: string): Promise<StreakInfo> {
  const { data: user } = await supabase
    .from("users")
    .select("current_streak, longest_streak, last_focus_date")
    .eq("uid", userId)
    .maybeSingle();

  const prevLongest = user?.longest_streak ?? 0;
  const today = getIstDateStr();
  const yesterday = getYesterdayIstDateStr();

  // Calculate actual streak from ground truth
  const actualStreak = await calculateActualStreakFromLogs(userId);
  const newLongest = Math.max(prevLongest, actualStreak);

  const streakWasReset = (user?.current_streak ?? 0) > 0 && actualStreak === 0;

  // Update DB if there is any mismatch
  if (user?.current_streak !== actualStreak || user?.longest_streak !== newLongest) {
    await supabase
      .from("users")
      .update({
        current_streak: actualStreak,
        longest_streak: newLongest,
        last_focus_date: actualStreak > 0 ? (actualStreak > 0 && user?.last_focus_date === today ? today : yesterday) : user?.last_focus_date,
      })
      .eq("uid", userId);
  }

  return {
    currentStreak: actualStreak,
    longestStreak: newLongest,
    lastFocusDate: user?.last_focus_date ?? null,
    streakWasReset,
  };
}

/**
 * Call this when a session ends.
 */
export async function saveFocusSession(
  userId: string,
  startedAt: Date,
  endedAt: Date
): Promise<{ countedForStreak: boolean; newStreak: number; newLongest: number }> {
  const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
  const countsForStreak = durationSeconds >= MIN_STREAK_SECONDS;

  await supabase.from("focus_sessions").insert({
    user_id: userId,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    duration_seconds: durationSeconds,
    counts_for_streak: countsForStreak,
  });

  if (!countsForStreak) {
    return { countedForStreak: false, newStreak: -1, newLongest: -1 };
  }

  const today = getIstDateStr();
  const { data: user } = await supabase
    .from("users")
    .select("current_streak, longest_streak, last_focus_date")
    .eq("uid", userId)
    .maybeSingle();

  const prevStreak = user?.current_streak ?? 0;
  const prevLongest = user?.longest_streak ?? 0;
  const prevDate = user?.last_focus_date ?? null;

  let newStreak: number;
  if (prevDate === today) {
    // Already logged a qualifying session today in IST
    newStreak = Math.max(prevStreak, 1);
  } else if (prevDate && daysBetween(prevDate, today) === 1) {
    // Studied yesterday -> extend streak
    newStreak = prevStreak + 1;
  } else {
    // Check ground truth from daily_logs
    const verifiedStreak = await calculateActualStreakFromLogs(userId);
    newStreak = Math.max(verifiedStreak, 1);
  }

  const newLongest = Math.max(prevLongest, newStreak);

  await supabase
    .from("users")
    .update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_focus_date: today,
    })
    .eq("uid", userId);

  return { countedForStreak: true, newStreak, newLongest };
}
