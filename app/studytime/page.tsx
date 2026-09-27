"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/dashboard/BottomNav";

interface LogRow {
  log_date: string;
  study_time_minutes: number;
  target_minutes: number;
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function StudyTimePage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("daily_logs")
        .select("log_date, study_time_minutes, target_minutes")
        .eq("user_id", user.id)
        .gte("log_date", daysAgoISO(29))
        .order("log_date", { ascending: false });

      setLogs((data as LogRow[] | null) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-ink/60 text-sm">Loading…</p>
      </div>
    );
  }

  const totalMinutes = logs.reduce((sum, l) => sum + l.study_time_minutes, 0);
  const avgMinutes = logs.length ? Math.round(totalMinutes / logs.length) : 0;
  const daysHitTarget = logs.filter((l) => l.study_time_minutes >= l.target_minutes).length;

  return (
    <div className="min-h-screen bg-paper pb-28">
      <div className="max-w-md mx-auto px-5 pt-8">
        <h1 className="font-display text-2xl font-semibold mb-4">Study Time</h1>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="rounded-ticket border border-ink/10 bg-white p-3 text-center">
            <p className="text-lg font-semibold text-ink">{Math.round(totalMinutes / 60)}h</p>
            <p className="text-[10px] text-slate mt-0.5">Last 30 days</p>
          </div>
          <div className="rounded-ticket border border-ink/10 bg-white p-3 text-center">
            <p className="text-lg font-semibold text-ink">{avgMinutes}m</p>
            <p className="text-[10px] text-slate mt-0.5">Daily average</p>
          </div>
          <div className="rounded-ticket border border-ink/10 bg-white p-3 text-center">
            <p className="text-lg font-semibold text-teal">{daysHitTarget}</p>
            <p className="text-[10px] text-slate mt-0.5">Target hit days</p>
          </div>
        </div>

        <p className="text-sm font-medium mb-2">Daily log</p>
        <div className="flex flex-col gap-2">
          {logs.length === 0 && (
            <p className="text-sm text-slate">No study time logged yet.</p>
          )}
          {logs.map((l) => {
            const pct = l.target_minutes > 0 ? Math.min(100, Math.round((l.study_time_minutes / l.target_minutes) * 100)) : 0;
            return (
              <div key={l.log_date} className="rounded-ticket border border-ink/10 bg-white p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-ink">
                    {new Date(l.log_date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                  <p className="text-xs text-slate">
                    {l.study_time_minutes}m / {l.target_minutes}m
                  </p>
                </div>
                <div className="w-full h-1.5 bg-ink/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${pct >= 100 ? "bg-teal" : "bg-marigold"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <BottomNav />
    </div>
  );
                }
