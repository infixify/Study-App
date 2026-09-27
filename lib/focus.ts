import { supabase } from "@/lib/supabase";

export const MIN_STREAK_SECONDS = 120; // 2 minutes

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastFocusDate: string | null;
  streakWasReset: boolean; // true if a missed day was detected on this load
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function daysBetween(a: string, b: string) {
  const d1 = new Date(a + "T00:00:00Z").getTime();
  const d2 = new Date(b + "T00:00:00Z").getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

// Call this once when the Focus page loads. Detects a missed day and
// resets the streak in the DB if needed, returning whether that happened
// so the UI can show the reset modal.
export async function loadAndReconcileStreak(userId: string): Promise<StreakInfo> {
  const { data: user } = await supabase
    .from("users")
    .select("current_streak, longest_streak, last_focus_date")
    .eq("uid", userId)
    .maybeSingle();

  const currentStreak = user?.current_streak ?? 0;
  const longestStreak = user?.longest_streak ?? 0;
  const lastFocusDate = user?.last_focus_date ?? null;

  if (!lastFocusDate || currentStreak === 0) {
    return { currentStreak, longestStreak, lastFocusDate, streakWasReset: false };
  }

  const gap = daysBetween(lastFocusDate, todayStr());

  // gap 0 = studied today already, gap 1 = studied yesterday (streak alive).
  // gap >= 2 = missed at least one full day — streak breaks.
  if (gap >= 2) {
    await supabase
      .from("users")
      .update({ current_streak: 0 })
      .eq("uid", userId);

    return {
      currentStreak: 0,
      longestStreak,
      lastFocusDate,
      streakWasReset: true,
    };
  }

  return { currentStreak, longestStreak, lastFocusDate, streakWasReset: false };
}

// Call this when a session ends. Saves the session and, if it's long
// enough, updates the streak.
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

  const { data: user } = await supabase
    .from("users")
    .select("current_streak, longest_streak, last_focus_date")
    .eq("uid", userId)
    .maybeSingle();

  const prevStreak = user?.current_streak ?? 0;
  const prevLongest = user?.longest_streak ?? 0;
  const prevDate = user?.last_focus_date ?? null;
  const today = todayStr();

  let newStreak: number;
  if (prevDate === today) {
    // Already logged a qualifying session today — streak doesn't change.
    newStreak = prevStreak;
  } else if (prevDate && daysBetween(prevDate, today) === 1) {
    // Studied yesterday — extend the streak.
    newStreak = prevStreak + 1;
  } else {
    // First session ever, or a gap — streak starts fresh at 1.
    newStreak = 1;
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
