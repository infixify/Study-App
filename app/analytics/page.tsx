// app/analytics/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/dashboard/AppHeader";
import BottomNav from "@/components/dashboard/BottomNav";

interface DailyLogItem {
  log_date: string;
  study_time_minutes: number;
  theory_minutes?: number;
  practice_minutes?: number;
  revision_minutes?: number;
  verified_minutes?: number;
}

interface FocusSessionItem {
  id: string;
  subject: string;
  duration_seconds: number;
  started_at: string;
}

const SUBJECT_COLORS: Record<string, { bar: string; hex: string; text: string; bg: string }> = {
  physics: { bar: "bg-blue-500", hex: "#3b82f6", text: "text-blue-700", bg: "bg-blue-50" },
  chemistry: { bar: "bg-emerald-500", hex: "#10b981", text: "text-emerald-700", bg: "bg-emerald-50" },
  mathematics: { bar: "bg-purple-500", hex: "#a855f7", text: "text-purple-700", bg: "bg-purple-50" },
  maths: { bar: "bg-purple-500", hex: "#a855f7", text: "text-purple-700", bg: "bg-purple-50" },
  biology: { bar: "bg-teal-500", hex: "#14b8a6", text: "text-teal-700", bg: "bg-teal-50" },
  english: { bar: "bg-orange-500", hex: "#f97316", text: "text-orange-700", bg: "bg-orange-50" },
  sst: { bar: "bg-rose-500", hex: "#f43f5e", text: "text-rose-700", bg: "bg-rose-50" },
};

const FALLBACK_PALETTE = [
  { bar: "bg-sky-500", hex: "#0ea5e9", text: "text-sky-700", bg: "bg-sky-50" },
  { bar: "bg-amber-500", hex: "#f59e0b", text: "text-amber-700", bg: "bg-amber-50" },
  { bar: "bg-indigo-500", hex: "#6366f1", text: "text-indigo-700", bg: "bg-indigo-50" },
  { bar: "bg-teal-600", hex: "#0d9488", text: "text-teal-800", bg: "bg-teal-50" },
];

export default function AnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<DailyLogItem[]>([]);
  const [sessions, setSessions] = useState<FocusSessionItem[]>([]);

  // 1. Subject-wise Widget State (Weekly / Monthly / Custom)
  const [subjectRangeMode, setSubjectRangeMode] = useState<"weekly" | "monthly" | "custom">("weekly");
  const [subjectCustomStart, setSubjectCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split("T")[0];
  });
  const [subjectCustomEnd, setSubjectCustomEnd] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [selectedSubjectDay, setSelectedSubjectDay] = useState<any | null>(null);

  // 2. Study Split (Activity) State
  const [rangeMode, setRangeMode] = useState<"weekly" | "monthly" | "custom">("weekly");
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split("T")[0];
  });
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [selectedDay, setSelectedDay] = useState<any | null>(null);

  useEffect(() => {
    async function loadAnalytics() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }
      const uid = session.user.id;

      const [{ data: pastLogs }, { data: sessionRows }] = await Promise.all([
        supabase
          .from("daily_logs")
          .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes, verified_minutes, log_date")
          .eq("user_id", uid)
          .order("log_date", { ascending: false })
          .limit(84),
        supabase
          .from("focus_sessions")
          .select("id, subject, duration_seconds, started_at")
          .eq("user_id", uid)
          .order("started_at", { ascending: false })
          .limit(300),
      ]);

      if (pastLogs) setLogs(pastLogs);
      if (sessionRows) setSessions(sessionRows as any);
      setLoading(false);
    }

    loadAnalytics();
  }, [router]);

  // ==========================================
  // 1. SUBJECT-WISE SPLIT BARS CALCULATION
  // ==========================================
  const subjectChartData = useMemo(() => {
    const today = new Date();
    let numDays = 7;
    let startDate = new Date();

    if (subjectRangeMode === "weekly") {
      numDays = 7;
      startDate.setDate(today.getDate() - 6);
    } else if (subjectRangeMode === "monthly") {
      numDays = 30;
      startDate.setDate(today.getDate() - 29);
    } else {
      const s = new Date(subjectCustomStart);
      const e = new Date(subjectCustomEnd);
      const diff = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      numDays = Math.min(diff, 60);
      startDate = s;
    }

    // Group clean sessions by date and subject (Ignoring 'General')
    const daySubjectMap = new Map<string, Record<string, number>>();

    sessions.forEach((s) => {
      if (!s.started_at) return;
      const rawSub = (s.subject || "").trim();
      if (!rawSub || rawSub.toLowerCase() === "general") return;

      const norm = rawSub.toLowerCase();
      const subName = norm.includes("math")
        ? "Mathematics"
        : norm.includes("physic")
        ? "Physics"
        : norm.includes("chem")
        ? "Chemistry"
        : norm.includes("bio")
        ? "Biology"
        : rawSub.charAt(0).toUpperCase() + rawSub.slice(1);

      const dKey = new Date(s.started_at).toISOString().split("T")[0];
      if (!daySubjectMap.has(dKey)) {
        daySubjectMap.set(dKey, {});
      }
      const map = daySubjectMap.get(dKey)!;
      map[subName] = (map[subName] || 0) + (s.duration_seconds || 0);
    });

    const result = [];
    for (let i = 0; i < numDays; i++) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + i);
      const dateKey = current.toISOString().split("T")[0];
      const subMap = daySubjectMap.get(dateKey) || {};

      let dayTotalSecs = 0;
      Object.values(subMap).forEach((secs) => {
        dayTotalSecs += secs;
      });
      const dayTotalHours = dayTotalSecs / 3600;
      const dayTotalMins = Math.round(dayTotalSecs / 60);

      result.push({
        dateKey,
        label: current.toLocaleDateString("en-IN", {
          day: "numeric",
          month: numDays > 14 ? "numeric" : "short",
          weekday: numDays <= 7 ? "narrow" : undefined,
        }),
        fullDate: current.toLocaleDateString("en-IN", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        totalMins: dayTotalMins,
        totalHours: dayTotalHours,
        subjects: subMap,
      });
    }
    return result;
  }, [sessions, subjectRangeMode, subjectCustomStart, subjectCustomEnd]);

  const subjectTotalMins = subjectChartData.reduce((acc, d) => acc + d.totalMins, 0);
  const subjectAvgMins = subjectChartData.length > 0 ? subjectTotalMins / subjectChartData.length : 0;
  const subjectMaxHours = Math.max(4, ...subjectChartData.map((d) => d.totalHours));
  const activeSubjectDetail = selectedSubjectDay || subjectChartData[subjectChartData.length - 1];

  // Overall totals per subject in selected range
  const overallSubjectTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    let allSecs = 0;
    subjectChartData.forEach((d) => {
      Object.entries(d.subjects).forEach(([sub, secs]) => {
        totals[sub] = (totals[sub] || 0) + (secs as number);
        allSecs += secs as number;
      });
    });

    const list = Object.entries(totals).map(([subject, secs], idx) => {
      const norm = subject.toLowerCase();
      const colorConf = SUBJECT_COLORS[norm] || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
      const hours = secs / 3600;
      const pct = allSecs > 0 ? Math.round((secs / allSecs) * 100) : 0;
      return { subject, hours, pct, colorConf };
    });

    list.sort((a, b) => b.hours - a.hours);
    return { list, totalHours: allSecs / 3600 };
  }, [subjectChartData]);

  // ==========================================
  // 2. ACTIVITY SPLIT (THEORY/PRACTICE/REV)
  // ==========================================
  const chartData = useMemo(() => {
    const today = new Date();
    let numDays = 7;
    let startDate = new Date();

    if (rangeMode === "weekly") {
      numDays = 7;
      startDate.setDate(today.getDate() - 6);
    } else if (rangeMode === "monthly") {
      numDays = 30;
      startDate.setDate(today.getDate() - 29);
    } else {
      const s = new Date(customStart);
      const e = new Date(customEnd);
      const diff = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      numDays = Math.min(diff, 60);
      startDate = s;
    }

    const logMap = new Map<string, DailyLogItem>();
    logs.forEach((l) => logMap.set(l.log_date, l));

    const result = [];
    for (let i = 0; i < numDays; i++) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + i);
      const dateKey = current.toISOString().split("T")[0];
      const found = logMap.get(dateKey);

      const totalMins = found?.study_time_minutes || 0;
      const theory = found?.theory_minutes || 0;
      const practice = found?.practice_minutes || 0;
      const revision = found?.revision_minutes || 0;

      result.push({
        dateKey,
        label: current.toLocaleDateString("en-IN", {
          day: "numeric",
          month: numDays > 14 ? "numeric" : "short",
          weekday: numDays <= 7 ? "narrow" : undefined,
        }),
        fullDate: current.toLocaleDateString("en-IN", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        totalMins,
        totalHours: totalMins / 60,
        theoryHours: theory / 60,
        practiceHours: practice / 60,
        revisionHours: revision / 60,
      });
    }
    return result;
  }, [logs, rangeMode, customStart, customEnd]);

  const totalMinsInRange = chartData.reduce((acc, d) => acc + d.totalMins, 0);
  const avgMinsInRange = chartData.length > 0 ? totalMinsInRange / chartData.length : 0;
  const maxHours = Math.max(8, ...chartData.map((d) => d.totalHours));
  const activeDetail = selectedDay || chartData[chartData.length - 1];

  // 12-Week Consistency matrix
  const heatGrid = useMemo(() => {
    const grid = new Array(84).fill(0);
    logs.forEach((l) => {
      const d = new Date(l.log_date);
      const daysAgo = Math.floor((new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo >= 0 && daysAgo < 84) {
        const hrs = (l.study_time_minutes || 0) / 60;
        let level = 0;
        if (hrs >= 6) level = 4;
        else if (hrs >= 4) level = 3;
        else if (hrs >= 2) level = 2;
        else if (hrs > 0) level = 1;
        grid[83 - daysAgo] = level;
      }
    });
    return grid;
  }, [logs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center p-6 text-slate-800">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-600 flex items-center justify-center text-xl font-bold animate-pulse mb-3">
          📊
        </div>
        <p className="text-xs font-bold text-slate-600">Loading deep analytics…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-28 text-[#0F172A] font-sans antialiased">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span>📈</span> Study Analytics
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Deep telemetry & consistency breakdown</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl transition-all"
          >
            ← Cockpit
          </button>
        </div>

        {/* 1. SUBJECT-WISE STUDY SPLIT BARS (NEW DESIGN MATCHING STUDY SPLIT) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <span>📚</span> Subject-Wise Study Distribution
              </h3>
              <p className="text-[10px] font-semibold text-slate-500">
                Daily duration & subject activity breakdown
              </p>
            </div>

            <div className="flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-[10px] font-black self-start sm:self-auto">
              {(["weekly", "monthly", "custom"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSubjectRangeMode(m)}
                  className={`px-2.5 py-1 rounded-lg transition-all capitalize ${
                    subjectRangeMode === m
                      ? "bg-white text-slate-900 shadow-2xs font-black"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {subjectRangeMode === "custom" && (
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-bold">
              <div className="flex-1">
                <span className="text-slate-500 block mb-0.5">From</span>
                <input
                  type="date"
                  value={subjectCustomStart}
                  onChange={(e) => setSubjectCustomStart(e.target.value)}
                  className="w-full bg-white p-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800"
                />
              </div>
              <div className="flex-1">
                <span className="text-slate-500 block mb-0.5">To</span>
                <input
                  type="date"
                  value={subjectCustomEnd}
                  onChange={(e) => setSubjectCustomEnd(e.target.value)}
                  className="w-full bg-white p-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800"
                />
              </div>
            </div>
          )}

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Focused</span>
              <span className="text-sm font-black text-slate-900">
                {(subjectTotalMins / 60).toFixed(1)}h
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Daily Average</span>
              <span className="text-sm font-black text-teal-700">
                {(subjectAvgMins / 60).toFixed(1)}h / day
              </span>
            </div>
          </div>

          {/* Subject Vertical Stacked Bars */}
          <div className="pt-2">
            <div className="h-36 flex items-end gap-1.5 sm:gap-2 px-1 border-b border-slate-200 pb-1.5 overflow-x-auto no-scrollbar">
              {subjectChartData.map((d, idx) => {
                const isSelected = activeSubjectDetail?.dateKey === d.dateKey;
                const totalPct = Math.min(100, Math.round((d.totalHours / subjectMaxHours) * 100));

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedSubjectDay(d)}
                    className="flex-1 min-w-[20px] max-w-[48px] h-full flex flex-col justify-end items-center cursor-pointer group transition-all"
                  >
                    {d.totalMins > 0 ? (
                      <div
                        style={{ height: `${Math.max(totalPct, 8)}%` }}
                        className={`w-full rounded-t-md overflow-hidden flex flex-col-reverse shadow-xs transition-transform ${
                          isSelected ? "ring-2 ring-slate-900 scale-105" : "hover:opacity-90"
                        }`}
                      >
                        {Object.entries(d.subjects).map(([sub, secs]) => {
                          const frac = d.totalHours > 0 ? (secs as number) / 3600 / d.totalHours : 0;
                          const norm = sub.toLowerCase();
                          const color = SUBJECT_COLORS[norm]?.bar || "bg-teal-500";
                          return (
                            <div
                              key={sub}
                              style={{ height: `${Math.round(frac * 100)}%` }}
                              className={`w-full ${color}`}
                              title={`${sub}: ${((secs as number) / 3600).toFixed(1)}h`}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mb-1" />
                    )}

                    <span
                      className={`text-[9px] mt-1 font-bold truncate ${
                        isSelected ? "text-slate-900 font-black" : "text-slate-400"
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Selected Day Subject Details */}
          {activeSubjectDetail && (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block">
                  {activeSubjectDetail.fullDate}
                </span>
                <span className="text-sm font-black text-slate-900">
                  {activeSubjectDetail.totalHours.toFixed(1)}h Total
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                {Object.keys(activeSubjectDetail.subjects).length === 0 ? (
                  <span className="text-slate-400">No session on this day</span>
                ) : (
                  Object.entries(activeSubjectDetail.subjects).map(([sub, secs]) => {
                    const norm = sub.toLowerCase();
                    const color = SUBJECT_COLORS[norm] || FALLBACK_PALETTE[0];
                    return (
                      <span key={sub} className={`flex items-center gap-1 ${color.text}`}>
                        <span className={`w-2 h-2 rounded-full ${color.bar}`} />
                        {((secs as number) / 3600).toFixed(1)}h {sub}
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Subject Color Legend */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 text-[10px] font-bold text-slate-500 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Physics
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Chemistry
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" /> Mathematics
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-500" /> Biology
            </span>
          </div>

          {/* Compact Overall Percentage Breakdown */}
          {overallSubjectTotals.list.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              {overallSubjectTotals.list.map((item) => (
                <div key={item.subject} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-900">{item.subject}</span>
                    <span className="text-slate-600">
                      {item.hours.toFixed(1)}h{" "}
                      <span className="text-[10px] text-slate-400 font-semibold">({item.pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.max(item.pct, 3)}%` }}
                      className={`h-full rounded-full transition-all ${item.colorConf.bar}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. STUDY SPLIT TIMELINE (THEORY / PRACTICE / REVISION) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <span>📊</span> Study Split History
              </h3>
              <p className="text-[10px] font-semibold text-slate-500">
                Daily duration & subject activity breakdown
              </p>
            </div>

            <div className="flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-[10px] font-black self-start sm:self-auto">
              {(["weekly", "monthly", "custom"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRangeMode(m)}
                  className={`px-2.5 py-1 rounded-lg transition-all capitalize ${
                    rangeMode === m
                      ? "bg-white text-slate-900 shadow-2xs font-black"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {rangeMode === "custom" && (
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-bold">
              <div className="flex-1">
                <span className="text-slate-500 block mb-0.5">From</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full bg-white p-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800"
                />
              </div>
              <div className="flex-1">
                <span className="text-slate-500 block mb-0.5">To</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full bg-white p-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Focused</span>
              <span className="text-sm font-black text-slate-900">
                {(totalMinsInRange / 60).toFixed(1)}h
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Daily Average</span>
              <span className="text-sm font-black text-teal-700">
                {(avgMinsInRange / 60).toFixed(1)}h / day
              </span>
            </div>
          </div>

          <div className="pt-2">
            <div className="h-36 flex items-end gap-1.5 sm:gap-2 px-1 border-b border-slate-200 pb-1.5 overflow-x-auto no-scrollbar">
              {chartData.map((d, idx) => {
                const isSelected = activeDetail?.dateKey === d.dateKey;
                const totalPct = Math.min(100, Math.round((d.totalHours / maxHours) * 100));

                const totalHoursClean = d.totalHours > 0 ? d.totalHours : 1;
                const theoryFrac = d.theoryHours / totalHoursClean;
                const practiceFrac = d.practiceHours / totalHoursClean;
                const revisionFrac = d.revisionHours / totalHoursClean;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDay(d)}
                    className="flex-1 min-w-[20px] max-w-[48px] h-full flex flex-col justify-end items-center cursor-pointer group transition-all"
                  >
                    {d.totalMins > 0 ? (
                      <div
                        style={{ height: `${Math.max(totalPct, 8)}%` }}
                        className={`w-full rounded-t-md overflow-hidden flex flex-col-reverse shadow-xs transition-transform ${
                          isSelected ? "ring-2 ring-slate-900 scale-105" : "hover:opacity-90"
                        }`}
                      >
                        <div
                          style={{ height: `${Math.round(theoryFrac * 100)}%` }}
                          className="w-full bg-amber-500"
                          title={`Theory: ${d.theoryHours.toFixed(1)}h`}
                        />
                        <div
                          style={{ height: `${Math.round(practiceFrac * 100)}%` }}
                          className="w-full bg-teal-600"
                          title={`Practice: ${d.practiceHours.toFixed(1)}h`}
                        />
                        <div
                          style={{ height: `${Math.round(revisionFrac * 100)}%` }}
                          className="w-full bg-indigo-600"
                          title={`Revision: ${d.revisionHours.toFixed(1)}h`}
                        />
                      </div>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mb-1" />
                    )}

                    <span
                      className={`text-[9px] mt-1 font-bold truncate ${
                        isSelected ? "text-slate-900 font-black" : "text-slate-400"
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {activeDetail && (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block">{activeDetail.fullDate}</span>
                <span className="text-sm font-black text-slate-900">
                  {activeDetail.totalHours.toFixed(1)}h Total
                </span>
              </div>

              <div className="flex items-center gap-2.5 text-[10px] font-bold">
                <span className="flex items-center gap-1 text-amber-800">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {activeDetail.theoryHours.toFixed(1)}h Theory
                </span>
                <span className="flex items-center gap-1 text-teal-800">
                  <span className="w-2 h-2 rounded-full bg-teal-600" />
                  {activeDetail.practiceHours.toFixed(1)}h Practice
                </span>
                <span className="flex items-center gap-1 text-indigo-800">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  {activeDetail.revisionHours.toFixed(1)}h Rev
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-slate-500 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Theory
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-600" /> Practice
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600" /> Revision
            </span>
          </div>
        </div>

        {/* 3. 12-WEEK CONSISTENCY MATRIX */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-xs font-black mb-3">
            <span className="text-slate-900 font-bold flex items-center gap-1.5">
              <span>🟩</span> 12-Week Consistency Matrix
            </span>
            <span className="text-[10px] font-semibold text-slate-500">84 Days History</span>
          </div>

          <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(12, 1fr)" }}>
            {Array.from({ length: 12 }).map((_, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const cellIdx = weekIdx * 7 + dayIdx;
                  const level = heatGrid[cellIdx] ?? 0;
                  const colors = [
                    "bg-slate-100",
                    "bg-teal-200",
                    "bg-teal-400",
                    "bg-teal-600",
                    "bg-teal-800",
                  ];
                  return (
                    <div
                      key={dayIdx}
                      className={`w-full aspect-square rounded-[2px] ${colors[level]}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 mt-2.5 justify-end">
            <span className="text-[10px] font-semibold text-slate-400">Less</span>
            {["bg-slate-100", "bg-teal-200", "bg-teal-400", "bg-teal-600", "bg-teal-800"].map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span className="text-[10px] font-semibold text-slate-400">More</span>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
