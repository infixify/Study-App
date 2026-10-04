// app/leaderboard/page.tsx
"use client";

import { useEffect, useState } from "react";
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

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"students" | "groups">("students");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myGroupId, setMyGroupId] = useState<string | null>(null); // Leaderboard Fix 2

  // Leaderboard Fix 1: retryKey triggers re-fetch when Retry is clicked
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id ?? null;
        setCurrentUserId(uid);

        const [studentRes, groupRes] = await Promise.all([
          supabase.rpc("get_leaderboard_students"),
          supabase.rpc("get_leaderboard_groups"),
        ]);

        if (studentRes.error) throw new Error(studentRes.error.message);
        if (groupRes.error) throw new Error(groupRes.error.message);

        setStudents((studentRes.data as StudentRow[]) ?? []);
        setGroups((groupRes.data as GroupRow[]) ?? []);

        // Leaderboard Fix 2: Find which group current user belongs to
        if (uid) {
          try {
            const { data: membership } = await supabase
              .from("group_members")
              .select("group_id")
              .eq("user_id", uid)
              .maybeSingle();
            setMyGroupId(membership?.group_id ?? null);
          } catch (_) {}
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [retryKey]); // Leaderboard Fix 1: re-run on retry

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
          <p className="text-center py-10 text-xs text-slate">Loading…</p>
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
                      {isMyGroup && <span className="text-teal font-semibold"> (Your Group)</span>}
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
