"use client";

import { useState } from "react";

type LogPoint = { log_date: string; study_time_minutes: number; target_minutes: number };

interface StudyTimeTrackerProps {
  studiedMinutes: number;
  targetMinutes: number;
  recentLogs?: LogPoint[]; // last ~30 days, most recent first — optional so this stays backward-compatible
}

type ViewMode = "today" | "week" | "month";

function formatHrs(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function StudyTimeTracker({
  studiedMinutes,
  targetMinutes,
  recentLogs = [],
}: StudyTimeTrackerProps) {
  const [view, setView] = useState<ViewMode>("today");

  const pct = Math.min(100, Math.round((studiedMinutes / targetMinutes) * 100));

  // recentLogs comes in most-recent-first; reverse for chronological display
  const chronological = [...recentLogs].reverse();
  const weekSlice = chronological.slice(-7);
  const monthSlice = chronological.slice(-30);

  const activeSlice = view === "week" ? weekSlice : view === "month" ? monthSlice : [];

  const totalMinutesInView = activeSlice.reduce((sum, l) => sum + l.study_time_minutes, 0);
  const avgMinutesInView = activeSlice.length ? Math.round(totalMinutesInView / activeSlice.length) : 0;
  const maxMinutesInView = Math.max(1, ...activeSlice.map((l) => l.study_time_minutes));

  return (
    <div className="mt-4 rounded-ticket border border-ink/10 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">Study time</p>
        <div className="flex gap-1 bg-ink/5 rounded-full p-0.5">
          {(["today", "week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                view === v ? "bg-white text-ink shadow-sm" : "text-slate"
              }`}
            >
              {v === "today" ? "Today" : v === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
      </div>

      {view === "today" && (
        <>
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-slate">Today's progress</p>
            <p className="text-xs text-slate">
              {formatHrs(studiedMinutes)} of {formatHrs(targetMinutes)} target
            </p>
          </div>

          <div className="mt-3 h-2.5 rounded-full bg-ink/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-teal transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="text-xs text-slate mt-2">
            {pct >= 100
              ? "Target hit — great work today."
              : `${formatHrs(targetMinutes - studiedMinutes)} more to hit today's target.`}
          </p>
        </>
      )}

      {(view === "week" || view === "month") && (
        <>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-xs text-slate">
              {view === "week" ? "Last 7 days" : "Last 30 days"}
            </p>
            <p className="text-xs text-slate">Avg {formatHrs(avgMinutesInView)}/day</p>
          </div>

          {activeSlice.length === 0 ? (
            <p className="text-xs text-slate/70 py-4 text-center">No study time logged yet.</p>
          ) : (
            <div className="flex items-end gap-1 h-24">
              {activeSlice.map((l) => {
                const barHeightPct = Math.max(4, Math.round((l.study_time_minutes / maxMinutesInView) * 100));
                const hitTarget = l.study_time_minutes >= l.target_minutes;
                return (
                  <div key={l.log_date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full h-24 flex items-end">
                      <div
                        className={`w-full rounded-t-sm transition-all ${
                          hitTarget ? "bg-teal" : "bg-marigold/70"
                        }`}
                        style={{ height: `${barHeightPct}%` }}
                        title={`${formatHrs(l.study_time_minutes)} on ${l.log_date}`}
                      />
                    </div>
                    {view === "week" && (
                      <p className="text-[9px] text-slate/60">
                        {new Date(l.log_date).toLocaleDateString("en-IN", { weekday: "narrow" })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
