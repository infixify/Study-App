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

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

async function getUidSafe(): Promise<string | null> {
  try {
    const result = await Promise.race<string | null>([
      supabase.auth.getSession().then((r) => r.data?.session?.user?.id ?? null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    return result;
  } catch {
    return null;
  }
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
      const weekStart = getWeekStart();

      const { data: usersData, error: usersErr } = await supabase
        .from("users")
        .select("uid, name, current_streak")
        .limit(50);
      if (usersErr) throw new Error(usersErr.message);

      const { data: logsData } = await supabase
        .from("daily_logs")
        .select("user_id, study_time_minutes")
        .gte("log_date", weekStart);

      const logsByUser: Record<string, number> = {};
      for (const row of (logsData ?? []) as { user_id: string; study_time_minutes: number }[]) {
        logsByUser[row.user_id] = (logsByUser[row.user_id] ?? 0) + (row.study_time_minutes ?? 0);
      }

      const studentRows: StudentRow[] = ((usersData ?? []) as { uid: string; name: string; current_streak: number }[])
        .map((u) => {
          const weeklyMins = logsByUser[u.uid] ?? 0;
          const weeklyHours = Math.round((weeklyMins / 60) * 10) / 10;
          const streak = u.current_streak ?? 0;
          return {
            user_id: u.uid,
            display_name: u.name ?? "Unknown",
            streak,
            weekly_hours: weeklyHours,
            points: streak * 10 + Math.floor(weeklyHours) * 5,
          };
        })
        .sort((a, b) => b.points - a.points);
      setStudents(studentRows);

      const { data: groupsData, error: groupsErr } = await supabase
        .from("study_groups")
        .select("id, name")
        .limit(50);
      if (groupsErr) throw new Error(groupsErr.message);

      const { data: membersData } = await supabase
        .from("group_members")
        .select("group_id, user_id");

      const membersByGroup: Record<string, string[]> = {};
      for (const m of (membersData ?? []) as { group_id: string; user_id: string }[]) {
        if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
        membersByGroup[m.group_id].push(m.user_id);
      }

      const userPointsMap: Record<string, number> = {};
      for (const s of studentRows) userPointsMap[s.user_id] = s.points;

      const groupRows: GroupRow[] = ((groupsData ?? []) as { id: string; name: string }[])
        .map((g) => {
          const members = membersByGroup[g.id] ?? [];
          const totalMins = members.reduce((sum, uid2) => sum + (logsByUser[uid2] ?? 0), 0);
          const totalHours = Math.round((totalMins / 60) * 10) / 10;
          const avgPts = members.length > 0
            ? Math.round(members.reduce((sum, uid2) => sum + (userPointsMap[uid2] ?? 0), 0) / members.length)
            : 0;
          return {
            group_id: g.id,
            group_name: g.name,
            member_count: members.length,
            avg_points: avgPts,
            total_weekly_hours: totalHours,
          };
        })
        .sort((a, b) => b.avg_points - a.avg_points);
      setGroups(groupRows);

      // Auth: 2s timeout, silently skip if hanging
      const uid = await getUidSafe();
      setCurrentUserId(uid);
      if (uid) {
        const mine = (membersData ?? []) as { group_id: string; user_id: string }[];
        setMyGroupId(mine.find((m) => m.user_id === uid)?.group_id ?? null);
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
              tab === "students" ? "bg-teal text-white border-teal shadow-xs" : "bg-white text-slate border-ink/10"
            }`}
          >
            👤 Students
          </button>
          <button
            onClick={() => setTab("groups")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
              tab === "groups" ? "bg-teal text-white border-teal shadow-xs" : "bg-white text-slate border-ink/10"
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
            <button onClick={() => setRetryKey((k) => k + 1)} className="mt-3 text-xs text-teal font-semibold underline">
              Retry
            </button>
          </div>
        ) : tab === "students" ? (
          <div className="flex flex-col gap-2">
            {students.length === 0 && <p className="text-center py-10 text-xs text-slate">No data yet.</p>}
            {students.map((s, i) => {
              const isMe = s.user_id === currentUserId;
              return (
                <div key={s.user_id} className={`rounded-ticket border p-3.5 flex items-center gap-3 ${isMe ? "border-teal bg-teal/5" : "border-ink/10 bg-white"}`}>
                  <div className="w-8 text-center shrink-0">
                    {i < 3 ? <span className="text-lg">{RANK_MEDALS[i]}</span> : <span className="text-xs font-bold text-slate">#{i + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-ink truncate">
                      {s.display_name}
                      {isMe && <span className="text-teal font-semibold"> (You)</span>}
                    </p>
                    <p className="text-[10px] text-slate mt-0.5">🔥 {s.streak} day streak · {s.weekly_hours}h this week</p>
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
            {groups.length === 0 && <p className="text-center py-10 text-xs text-slate">No groups yet.</p>}
            {groups.map((g, i) => {
              const isMyGroup = g.group_id === myGroupId;
              return (
                <div key={g.group_id} className={`rounded-ticket border p-3.5 flex items-center gap-3 ${isMyGroup ? "border-teal bg-teal/5" : "border-ink/10 bg-white"}`}>
                  <div className="w-8 text-center shrink-0">
                    {i < 3 ? <span className="text-lg">{RANK_MEDALS[i]}</span> : <span className="text-xs font-bold text-slate">#{i + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-ink truncate">
                      {g.group_name}
                      {isMyGroup && <span className="text-teal font-semibold"> (Your Group)</span>}
                    </p>
                    <p className="text-[10px] text-slate mt-0.5">
                      {g.member_count} member{g.member_count === 1 ? "" : "s"} · {g.total_weekly_hours}h combined this week
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
