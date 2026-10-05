// app/tests/analysis/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/dashboard/AppHeader";
import BottomNav from "@/components/dashboard/BottomNav";

type Scope = "chapter" | "subject" | "full_syllabus";

interface TestLog {
  id: string;
  scope: Scope;
  test_name: string;
  total_questions: number;
  correct_count: number;
  wrong_count: number;
  unattempted_count: number;
  marks_scored: number | null;
  max_marks: number | null;
  physics_marks?: number | null;
  chemistry_marks?: number | null;
  maths_marks?: number | null;
  accuracy: number | null;
  test_date: string;
  subject_id: string | null;
  chapter_id: string | null;
}

const SCOPE_COLORS: Record<Scope, { bg: string; text: string; badge: string }> = {
  full_syllabus: { bg: "bg-indigo-50", text: "text-indigo-700", badge: "bg-indigo-500" },
  subject: { bg: "bg-amber-50", text: "text-amber-700", badge: "bg-amber-500" },
  chapter: { bg: "bg-teal-50", text: "text-teal-700", badge: "bg-teal-500" },
};

export default function TestAnalysisPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [targetExam, setTargetExam] = useState<string>("JEE");
  const [filterScope, setFilterScope] = useState<"all" | Scope>("all");
  const [rangeMode, setRangeMode] = useState<"all" | "30d" | "90d">("all");

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const uid = session.user.id;

      const [{ data: profile }, { data: testLogs }] = await Promise.all([
        supabase
          .from("users")
          .select("target_exam")
          .eq("uid", uid)
          .maybeSingle(),
        supabase
          .from("tests")
          .select(
            "id, scope, test_name, total_questions, correct_count, wrong_count, unattempted_count, marks_scored, max_marks, physics_marks, chemistry_marks, maths_marks, accuracy, test_date, subject_id, chapter_id"
          )
          .eq("user_id", uid)
          .order("test_date", { ascending: true }),
      ]);

      if (profile?.target_exam) setTargetExam(profile.target_exam);
      if (testLogs) setLogs(testLogs as TestLog[]);
      setLoading(false);
    }

    load();
  }, [router]);

  // Filter logs by scope and date range
  const filteredLogs = useMemo(() => {
    let data = [...logs];

    if (filterScope !== "all") {
      data = data.filter((l) => l.scope === filterScope);
    }

    if (rangeMode !== "all") {
      const days = rangeMode === "30d" ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split("T")[0];
      data = data.filter((l) => l.test_date >= cutoffStr);
    }

    return data;
  }, [logs, filterScope, rangeMode]);

  // Sorted chronologically for chart
  const chronoLogs = useMemo(() => [...filteredLogs].sort((a, b) => a.test_date.localeCompare(b.test_date)), [filteredLogs]);

  // --- Aggregates ---
  const totalTests = filteredLogs.length;
  const avgScore = useMemo(() => {
    const scored = filteredLogs.filter((l) => l.marks_scored !== null);
    if (!scored.length) return 0;
    return Math.round(scored.reduce((acc, l) => acc + (l.marks_scored || 0), 0) / scored.length);
  }, [filteredLogs]);

  const avgAccuracy = useMemo(() => {
    const withAcc = filteredLogs.filter((l) => l.accuracy !== null);
    if (!withAcc.length) return 0;
    return Math.round(withAcc.reduce((acc, l) => acc + (l.accuracy || 0), 0) / withAcc.length);
  }, [filteredLogs]);

  const bestScore = useMemo(() => {
    const scored = filteredLogs.filter((l) => l.marks_scored !== null);
    if (!scored.length) return null;
    return scored.reduce((best, l) => (l.marks_scored! > best.marks_scored! ? l : best));
  }, [filteredLogs]);

  const trend = useMemo(() => {
    const scored = chronoLogs.filter((l) => l.marks_scored !== null);
    if (scored.length < 2) return null;
    const first = scored.slice(0, Math.ceil(scored.length / 2));
    const last = scored.slice(Math.floor(scored.length / 2));
    const firstAvg = first.reduce((a, l) => a + (l.marks_scored || 0), 0) / first.length;
    const lastAvg = last.reduce((a, l) => a + (l.marks_scored || 0), 0) / last.length;
    return { direction: lastAvg >= firstAvg ? "up" : "down", delta: Math.round(Math.abs(lastAvg - firstAvg)) };
  }, [chronoLogs]);

  // Subject marks totals (only full_syllabus tests with P/C/M breakdown)
  const subjectBreakdown = useMemo(() => {
    const full = filteredLogs.filter(
      (l) => l.scope === "full_syllabus" && (l.physics_marks !== null || l.chemistry_marks !== null || l.maths_marks !== null)
    );
    if (!full.length) return null;
    const phys = full.filter((l) => l.physics_marks !== null);
    const chem = full.filter((l) => l.chemistry_marks !== null);
    const math = full.filter((l) => l.maths_marks !== null);
    return {
      physics: phys.length ? Math.round(phys.reduce((a, l) => a + (l.physics_marks || 0), 0) / phys.length) : null,
      chemistry: chem.length ? Math.round(chem.reduce((a, l) => a + (l.chemistry_marks || 0), 0) / chem.length) : null,
      maths: math.length ? Math.round(math.reduce((a, l) => a + (l.maths_marks || 0), 0) / math.length) : null,
      count: full.length,
    };
  }, [filteredLogs]);

  // Score progression chart data — max out scale at maxMarks, clamp by highest score seen
  const chartMax = useMemo(() => {
    const allMax = chronoLogs.filter((l) => l.max_marks).map((l) => l.max_marks!);
    return allMax.length ? allMax[0] : 300;
  }, [chronoLogs]);

  const scoredLogs = useMemo(
    () => chronoLogs.filter((l) => l.marks_scored !== null),
    [chronoLogs]
  );

  const accuracyLogs = useMemo(
    () => chronoLogs.filter((l) => l.accuracy !== null),
    [chronoLogs]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-600 flex items-center justify-center text-xl font-bold animate-pulse mb-3">
          📊
        </div>
        <p className="text-xs font-bold text-slate-600">Crunching your test data…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-28 text-[#0F172A] font-sans antialiased">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">

        {/* ── PAGE HEADER ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span>📊</span> Test Analysis
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {targetExam} · Score trends & performance insights
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/tests")}
            className="text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl transition-all"
          >
            ← Mock Tests
          </button>
        </div>

        {/* ── FILTERS ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Scope filter */}
          <div className="flex p-0.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black shadow-2xs">
            {(["all", "full_syllabus", "subject", "chapter"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterScope(s)}
                className={`px-2.5 py-1 rounded-lg transition-all capitalize ${
                  filterScope === s
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {s === "full_syllabus" ? "Full" : s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex p-0.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black shadow-2xs ml-auto">
            {(["all", "90d", "30d"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRangeMode(r)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  rangeMode === r
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {r === "all" ? "All time" : r}
              </button>
            ))}
          </div>
        </div>

        {/* ── EMPTY STATE ── */}
        {totalTests === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 flex flex-col items-center text-center shadow-xs">
            <span className="text-4xl mb-3">📝</span>
            <h3 className="text-sm font-black text-slate-900 mb-1">No tests logged yet</h3>
            <p className="text-xs text-slate-500 mb-4">
              Log your first mock test score to see your analysis here.
            </p>
            <button
              type="button"
              onClick={() => router.push("/tests")}
              className="px-4 py-2 bg-teal-600 text-white text-xs font-black rounded-xl hover:bg-teal-700 transition-all"
            >
              Log a Test Score →
            </button>
          </div>
        )}

        {totalTests > 0 && (
          <>
            {/* ── 1. KPI SUMMARY CARDS ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tests Logged</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">{totalTests}</p>
                {trend && (
                  <p className={`text-[10px] font-bold mt-1 ${trend.direction === "up" ? "text-emerald-600" : "text-rose-500"}`}>
                    {trend.direction === "up" ? "↑" : "↓"} {trend.delta} pts trend
                  </p>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Avg Score</p>
                <p className="text-2xl font-black text-teal-600 mt-0.5">{avgScore}</p>
                <p className="text-[10px] font-semibold text-slate-400 mt-1">/ {chartMax}</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Avg Accuracy</p>
                <p className="text-2xl font-black text-emerald-600 mt-0.5">{avgAccuracy}%</p>
                <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div
                    style={{ width: `${avgAccuracy}%` }}
                    className="h-full bg-emerald-500 rounded-full transition-all"
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Best Score</p>
                {bestScore ? (
                  <>
                    <p className="text-2xl font-black text-indigo-600 mt-0.5">{bestScore.marks_scored}</p>
                    <p className="text-[10px] font-semibold text-slate-400 truncate mt-0.5">{bestScore.test_name}</p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-slate-400 mt-1">—</p>
                )}
              </div>
            </div>

            {/* ── 2. SCORE PROGRESSION CHART ── */}
            {scoredLogs.length > 0 && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <span>📈</span> Score Progression
                  </h3>
                  <p className="text-[10px] font-semibold text-slate-500">
                    Marks scored per test, chronologically
                  </p>
                </div>

                {/* SVG Line Chart */}
                <div className="relative w-full h-40 overflow-hidden">
                  {(() => {
                    const W = 320;
                    const H = 140;
                    const PAD = { l: 28, r: 10, t: 10, b: 20 };
                    const innerW = W - PAD.l - PAD.r;
                    const innerH = H - PAD.t - PAD.b;
                    const maxScore = Math.max(chartMax, ...scoredLogs.map((l) => l.marks_scored!));
                    const n = scoredLogs.length;

                    const px = (i: number) => PAD.l + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
                    const py = (v: number) => PAD.t + innerH - (v / maxScore) * innerH;

                    const points = scoredLogs.map((l, i) => ({ x: px(i), y: py(l.marks_scored!), l }));

                    // Polyline path
                    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
                    // Fill area
                    const areaPath =
                      linePath +
                      ` L${points[points.length - 1].x.toFixed(1)},${(PAD.t + innerH).toFixed(1)} L${points[0].x.toFixed(1)},${(PAD.t + innerH).toFixed(1)} Z`;

                    // Y-axis ticks
                    const yTicks = [0, Math.round(maxScore * 0.5), maxScore];

                    return (
                      <svg
                        viewBox={`0 0 ${W} ${H}`}
                        className="w-full h-full"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
                          </linearGradient>
                        </defs>

                        {/* Y grid lines */}
                        {yTicks.map((v) => (
                          <g key={v}>
                            <line
                              x1={PAD.l} y1={py(v)} x2={W - PAD.r} y2={py(v)}
                              stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="3,3"
                            />
                            <text x={PAD.l - 4} y={py(v) + 3.5} fontSize="7" fill="#94a3b8" textAnchor="end">{v}</text>
                          </g>
                        ))}

                        {/* Area fill */}
                        <path d={areaPath} fill="url(#scoreGrad)" />

                        {/* Line */}
                        <path d={linePath} fill="none" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Dots */}
                        {points.map((p, i) => (
                          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#0d9488" stroke="white" strokeWidth="1" />
                        ))}

                        {/* Latest score label */}
                        {points.length > 0 && (
                          <text
                            x={points[points.length - 1].x}
                            y={points[points.length - 1].y - 6}
                            fontSize="7.5"
                            fontWeight="bold"
                            fill="#0d9488"
                            textAnchor="middle"
                          >
                            {scoredLogs[scoredLogs.length - 1].marks_scored}
                          </text>
                        )}
                      </svg>
                    );
                  })()}
                </div>

                {/* X labels (first and last) */}
                {scoredLogs.length >= 2 && (
                  <div className="flex justify-between text-[9px] font-semibold text-slate-400 -mt-1 px-1">
                    <span>
                      {new Date(scoredLogs[0].test_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                    <span>
                      {new Date(scoredLogs[scoredLogs.length - 1].test_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── 3. ACCURACY TREND CHART ── */}
            {accuracyLogs.length > 1 && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <span>🎯</span> Accuracy Trend
                  </h3>
                  <p className="text-[10px] font-semibold text-slate-500">
                    % correct out of attempted questions
                  </p>
                </div>

                <div className="relative w-full h-32 overflow-hidden">
                  {(() => {
                    const W = 320;
                    const H = 110;
                    const PAD = { l: 28, r: 10, t: 8, b: 18 };
                    const innerW = W - PAD.l - PAD.r;
                    const innerH = H - PAD.t - PAD.b;
                    const n = accuracyLogs.length;

                    const px = (i: number) => PAD.l + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
                    const py = (v: number) => PAD.t + innerH - (v / 100) * innerH;

                    const points = accuracyLogs.map((l, i) => ({ x: px(i), y: py(l.accuracy!), v: l.accuracy! }));
                    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
                    const areaPath =
                      linePath +
                      ` L${points[points.length - 1].x.toFixed(1)},${(PAD.t + innerH).toFixed(1)} L${points[0].x.toFixed(1)},${(PAD.t + innerH).toFixed(1)} Z`;

                    const yTicks = [0, 50, 100];

                    return (
                      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                          </linearGradient>
                        </defs>

                        {yTicks.map((v) => (
                          <g key={v}>
                            <line x1={PAD.l} y1={py(v)} x2={W - PAD.r} y2={py(v)} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="3,3" />
                            <text x={PAD.l - 4} y={py(v) + 3.5} fontSize="7" fill="#94a3b8" textAnchor="end">{v}%</text>
                          </g>
                        ))}

                        <path d={areaPath} fill="url(#accGrad)" />
                        <path d={linePath} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

                        {points.map((p, i) => (
                          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#10b981" stroke="white" strokeWidth="1" />
                        ))}

                        {points.length > 0 && (
                          <text
                            x={points[points.length - 1].x}
                            y={points[points.length - 1].y - 6}
                            fontSize="7.5"
                            fontWeight="bold"
                            fill="#10b981"
                            textAnchor="middle"
                          >
                            {accuracyLogs[accuracyLogs.length - 1].accuracy}%
                          </text>
                        )}
                      </svg>
                    );
                  })()}
                </div>

                <div className="flex justify-between text-[9px] font-semibold text-slate-400 -mt-1 px-1">
                  <span>{new Date(accuracyLogs[0].test_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  <span>{new Date(accuracyLogs[accuracyLogs.length - 1].test_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </div>
              </div>
            )}

            {/* ── 4. SUBJECT-WISE MARKS BREAKDOWN (JEE PCM) ── */}
            {subjectBreakdown && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <span>📚</span> Subject-Wise Avg Marks
                  </h3>
                  <p className="text-[10px] font-semibold text-slate-500">
                    From {subjectBreakdown.count} full-syllabus test{subjectBreakdown.count !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    { label: "Physics", val: subjectBreakdown.physics, max: 100, color: "bg-blue-500", text: "text-blue-700" },
                    { label: "Chemistry", val: subjectBreakdown.chemistry, max: 100, color: "bg-emerald-500", text: "text-emerald-700" },
                    { label: targetExam === "NEET" ? "Biology" : "Maths", val: subjectBreakdown.maths, max: 100, color: "bg-purple-500", text: "text-purple-700" },
                  ].map(({ label, val, max, color, text }) => {
                    if (val === null) return null;
                    const pct = Math.min(100, Math.round((val / max) * 100));
                    return (
                      <div key={label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800">{label}</span>
                          <span className={text}>{val} / {max}</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.max(pct, 2)}%` }}
                            className={`h-full rounded-full transition-all ${color}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 5. ATTEMPT QUALITY: CORRECT VS WRONG VS SKIPPED ── */}
            {filteredLogs.some((l) => l.total_questions > 0) && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <span>✏️</span> Attempt Quality
                  </h3>
                  <p className="text-[10px] font-semibold text-slate-500">Cumulative across {totalTests} test{totalTests !== 1 ? "s" : ""}</p>
                </div>

                {(() => {
                  const totalCorrect = filteredLogs.reduce((a, l) => a + (l.correct_count || 0), 0);
                  const totalWrong = filteredLogs.reduce((a, l) => a + (l.wrong_count || 0), 0);
                  const totalSkip = filteredLogs.reduce((a, l) => a + (l.unattempted_count || 0), 0);
                  const totalQ = totalCorrect + totalWrong + totalSkip;

                  if (!totalQ) return <p className="text-xs text-slate-400">No question data available.</p>;

                  const bars = [
                    { label: "Correct", val: totalCorrect, pct: Math.round((totalCorrect / totalQ) * 100), color: "bg-emerald-500", text: "text-emerald-700" },
                    { label: "Wrong", val: totalWrong, pct: Math.round((totalWrong / totalQ) * 100), color: "bg-rose-500", text: "text-rose-700" },
                    { label: "Skipped", val: totalSkip, pct: Math.round((totalSkip / totalQ) * 100), color: "bg-slate-300", text: "text-slate-600" },
                  ];

                  return (
                    <div className="space-y-2.5">
                      <div className="w-full h-5 rounded-full overflow-hidden flex">
                        {bars.map((b) => (
                          <div
                            key={b.label}
                            style={{ width: `${b.pct}%` }}
                            className={`h-full ${b.color} transition-all`}
                          />
                        ))}
                      </div>

                      <div className="grid grid-cols-3 text-center gap-2">
                        {bars.map((b) => (
                          <div key={b.label} className="bg-slate-50 border border-slate-100 rounded-xl p-2">
                            <p className="text-[10px] font-bold text-slate-500">{b.label}</p>
                            <p className={`text-base font-black ${b.text}`}>{b.val}</p>
                            <p className="text-[10px] font-semibold text-slate-400">{b.pct}%</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── 6. RECENT TEST CARDS ── */}
            <div className="space-y-2">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider px-0.5">
                All Logged Tests ({totalTests})
              </h3>

              {[...filteredLogs]
                .sort((a, b) => b.test_date.localeCompare(a.test_date))
                .map((log) => {
                  const sc = SCOPE_COLORS[log.scope] ?? SCOPE_COLORS.full_syllabus;
                  const maxM = log.max_marks ?? 300;
                  const scorePct = log.marks_scored !== null ? Math.round((log.marks_scored / maxM) * 100) : null;

                  return (
                    <div
                      key={log.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                            {log.scope.replace(/_/g, " ")}
                          </span>
                          <h4 className="text-xs font-black text-slate-900 mt-1 truncate">
                            {log.test_name}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            {new Date(log.test_date).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          {log.marks_scored !== null ? (
                            <>
                              <span className="text-lg font-black text-teal-600">{log.marks_scored}</span>
                              <span className="text-[10px] font-bold text-slate-400">/{maxM}</span>
                              {scorePct !== null && (
                                <p className="text-[10px] font-bold text-slate-500">{scorePct}%</p>
                              )}
                            </>
                          ) : (
                            <span className="text-sm font-bold text-slate-300">—</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-100 text-[10px] font-semibold text-slate-500">
                        <span className="text-emerald-600 font-bold">✓ {log.correct_count}</span>
                        <span className="text-rose-500 font-bold">✗ {log.wrong_count}</span>
                        <span>— {log.unattempted_count}</span>
                        {log.accuracy !== null && (
                          <span className="ml-auto font-bold text-slate-700">
                            {log.accuracy}% acc
                          </span>
                        )}
                      </div>

                      {/* Subject marks mini-row */}
                      {(log.physics_marks !== null || log.chemistry_marks !== null || log.maths_marks !== null) && (
                        <div className="flex items-center gap-2 mt-1.5 text-[9.5px] font-bold">
                          {log.physics_marks !== null && (
                            <span className="text-blue-600">P: {log.physics_marks}</span>
                          )}
                          {log.chemistry_marks !== null && (
                            <span className="text-emerald-600">C: {log.chemistry_marks}</span>
                          )}
                          {log.maths_marks !== null && (
                            <span className="text-purple-600">{targetExam === "NEET" ? "B" : "M"}: {log.maths_marks}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
