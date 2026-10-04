// app/leaderboard/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/dashboard/AppHeader";
import BottomNav from "@/components/dashboard/BottomNav";

interface StudentRow {
  user_id: string;
  display_name: string;
  streak: number;
  weekly_hours: number;
  points: number;
}

interface GroupRow {
  group_id: string;
  group_name: string;
  member_count: number;
  avg_points: number;
  total_weekly_hours: number;
}

interface MembershipRow {
  group_id: string;
}

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

// Hard deadline: if supabase hasn't resolved in ms, throw
function deadline<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"students" | "groups">("students");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myGroupId, setMyGroupId] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id ?? null;
      setCurrentUserId(uid);

      // --- Students ---
      let studentRows: StudentRow[] = [];
      try {
        const studentRes = await deadline(
          supabase.rpc("get_leaderboard_students").then((r) => r),
          8000,
          "get_leaderboard_students"
        );
        if (studentRes.error) throw new Error(studentRes.error.message);
        studentRows = (studentRes.data ?? []) as StudentRow[];
      } catch (_) {
        // RPC failed/timed out — fallback: read users table directly
        const { data: fallback } = await supabase
          .from("users")
          .select("id, display_name, current_streak")
          .limit(50);
        studentRows = ((fallback ?? []) as { id: string; display_name: string; current_streak: number }[]).map(
          (u) => ({
            user_id: u.id,
            display_name: u.display_name ?? "Unknown",
            streak: u.current_streak ?? 0,
            weekly_hours: 0,
            points: (u.current_streak ?? 0) * 10,
          })
        );
      }
      setStudents(studentRows);

      // --- Groups ---
      let groupRows: GroupRow[] = [];
      try {
        const groupRes = await deadline(
          supabase.rpc("get_leaderboard_groups").then((r) => r),
          8000,
          "get_leaderboard_groups"
        );
        if (groupRes.error) throw new Error(groupRes.error.message);
        groupRows = (groupRes.data ?? []) as GroupRow[];
      } catch (_) {
        // RPC failed/timed out — fallback: read study_groups directly
        const { data: fallback } = await supabase
          .from("study_groups")
          .select("id, name")
          .limit(50);
        groupRows = ((fallback ?? []) as { id: string; name: string }[]).map((g) => ({
          group_id: g.id,
          group_name: g.name,
          member_count: 0,
          avg_points: 0,
          total_weekly_hours: 0,
        }));
      }
      setGroups(groupRows);

      // --- My group ---
      if (uid) {
        try {
          const memberRes = await deadline(
            supabase
              .from("group_members")
              .select("group_id")
              .eq("user_id", uid)
              .maybeSingle()
              .then((r) => r),
            5000,
            "group_members"
          );
          const membership = memberRes.data as MembershipRow | null;
          setMyGroupId(membership?.group_id ?? null);
        } catch (_) {
          // non-fatal
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [retryKey]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-paper pb-28">
      <AppHeader />

      <main className="max-w-md mx-auto px-5 pt-4 flex flex-col gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">🏆 Leaderboard</h1>
          <p className="text-[11px] text-slate mt-0.5">
            Points = streak days × 10 + this week&apos;s study hours × 5
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTab("students")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
              tab === "students"
                ? "bg-teal text-white border-teal shadow-xs"
                : "bg-white text-slate border-ink/10"
            }`}
          >
            👤 Students
          </button>
          <button
            onClick={() => setTab("groups")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
              tab === "groups"
                ? "bg-teal text-white border-teal shadow-xs"
                : "bg-white text-slate border-ink/10"
            }`}
          >
            👥 Groups
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-14 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-teal border-t-transparent animate-spin" />
            <p className="text-xs text-slate">Loading leaderboard…</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-xs font-bold text-red-600 mb-1">Failed to load</p>
            <p className="text-[10px] text-red-400">{error}</p>
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="mt-3 text-xs text-teal font-semibold underline"
            >
              Retry
            </button>
          </div>
        ) : tab === "students" ? (
          <div className="flex flex-col gap-2">
            {students.length === 0 && (
              <p className="text-center py-10 text-xs text-slate">No data yet.</p>
            )}
            {students.map((s, i) => {
              const isMe = s.user_id === currentUserId;
              return (
                <div
                  key={s.user_id}
                  className={`rounded-ticket border p-3.5 flex items-center gap-3 ${
                    isMe ? "border-teal bg-teal/5" : "border-ink/10 bg-white"
                  }`}
                >
                  <div className="w-8 text-center shrink-0">
                    {i < 3 ? (
                      <span className="text-lg">{RANK_MEDALS[i]}</span>
                    ) : (
                      <span className="text-xs font-bold text-slate">#{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-ink truncate">
                      {s.display_name}
                      {isMe && <span className="text-teal font-semibold"> (You)</span>}
                    </p>
                    <p className="text-[10px] text-slate mt-0.5">
                      🔥 {s.streak} day streak · {s.weekly_hours}h this week
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-ink">{s.points}</p>
                    <p className="text-[9px] text-slate">points</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {groups.length === 0 && (
              <p className="text-center py-10 text-xs text-slate">No groups yet.</p>
            )}
            {groups.map((g, i) => {
              const isMyGroup = g.group_id === myGroupId;
              return (
                <div
                  key={g.group_id}
                  className={`rounded-ticket border p-3.5 flex items-center gap-3 ${
                    isMyGroup ? "border-teal bg-teal/5" : "border-ink/10 bg-white"
                  }`}
                >
                  <div className="w-8 text-center shrink-0">
                    {i < 3 ? (
                      <span className="text-lg">{RANK_MEDALS[i]}</span>
                    ) : (
                      <span className="text-xs font-bold text-slate">#{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-ink truncate">
                      {g.group_name}
                      {isMyGroup && (
                        <span className="text-teal font-semibold"> (Your Group)</span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate mt-0.5">
                      {g.member_count} member{g.member_count === 1 ? "" : "s"} ·{" "}
                      {g.total_weekly_hours}h combined this week
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-ink">{g.avg_points}</p>
                    <p className="text-[9px] text-slate">avg points</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
