// components/dashboard/AiMentorCard.tsx
"use client";

import React, { useState, useEffect } from "react";
import AiMentorChat from "./AiMentorChat";

interface AiMentorCardProps {
  userId: string;
  targetExam?: string;
  report: any;
  loading: boolean;
  onRefresh: () => void;
  onOpenAiTalk?: () => void;
  studentContext?: any;
}

const LAST_REFRESH_KEY = "pw_ai_mentor_last_refreshed";

export default function AiMentorCard({
  userId,
  targetExam = "Competitive Exam",
  report,
  loading,
  onRefresh,
  onOpenAiTalk,
}: AiMentorCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"daily" | "subjects" | "swot" | "rank">("daily");
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  // Load last refreshed timestamp from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${LAST_REFRESH_KEY}_${userId}`);
      if (stored) setLastRefreshed(stored);
    } catch (_) {}
  }, [userId]);

  // When a refresh completes (loading goes false and report exists), save timestamp
  const prevLoadingRef = React.useRef(loading);
  useEffect(() => {
    if (prevLoadingRef.current === true && loading === false && report) {
      const now = new Date().toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      setLastRefreshed(now);
      try {
        localStorage.setItem(`${LAST_REFRESH_KEY}_${userId}`, now);
      } catch (_) {}
    }
    prevLoadingRef.current = loading;
  }, [loading, report, userId]);

  const isNeet = targetExam.toUpperCase().includes("NEET");

  const status = report?.overall_status || "Consistent Momentum";
  const prediction = report?.score_prediction || `Projected: 98.4+ Percentile (${targetExam})`;
  const summary =
    report?.diagnostic_summary ||
    `Prioritize high-yield numerical practice over passive video watching. Aim for a 60% problem-solving ratio to secure a top rank in ${targetExam}.`;

  const subjectAnalysis = report?.subject_analysis || [
    {
      name: "Physics",
      status: "Problem Velocity Focus",
      health: 72,
      recommendation: `Solve at least 25 numericals today. Focus on formula vector forms and boundary conditions.`,
      priority: "high",
    },
    {
      name: "Chemistry",
      status: isNeet ? "NCERT Retention Focus" : "Reaction Mechanism Focus",
      health: 84,
      recommendation: isNeet
        ? "Line-by-line Inorganic NCERT active recall. Solve 30 statement-type practice questions."
        : "Organic reaction mechanism review + Physical chemistry numerical calculation shortcuts.",
      priority: "medium",
    },
    {
      name: isNeet ? "Biology" : "Mathematics",
      status: isNeet ? "Speed & Accuracy" : "Calculus & Algebra Velocity",
      health: isNeet ? 88 : 64,
      recommendation: isNeet
        ? "Target 90 questions under 45 minutes to build real examination pace."
        : "Solve 20 high-weightage DPP questions. Minimize multi-step negative marking traps.",
      priority: isNeet ? "medium" : "high",
    },
  ];

  const dailyTasks = report?.daily_tasks || null;

  const isWarning =
    status.toLowerCase().includes("attention") ||
    status.toLowerCase().includes("lag") ||
    status.toLowerCase().includes("backlog");

  return (
    <>
      {/* 1. DASHBOARD CARD */}
      <div className="rounded-2xl p-4 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0F172A] text-white shadow-lg border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-teal-500/10 rounded-full blur-xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center text-xs shadow-md font-bold">
              ⚡
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-black tracking-tight text-white uppercase">
                  Academic Strategy Engine
                </h2>
                <span className="text-[9px] font-black text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-700/60">
                  {targetExam}
                </span>
              </div>
              {/* Last Refreshed Timestamp */}
              <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                {lastRefreshed
                  ? `Last updated: ${lastRefreshed}`
                  : report
                  ? "Updated previously"
                  : "Not yet generated"}
              </div>
            </div>
          </div>

          <span
            className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border shadow-2xs ${
              isWarning
                ? "bg-rose-950/80 text-rose-300 border-rose-700/80"
                : "bg-emerald-950/80 text-emerald-300 border-emerald-700/80"
            }`}
          >
            ● {status}
          </span>
        </div>

        {/* Key Metrics Mini-Bar */}
        <div className="grid grid-cols-3 gap-1.5 my-2.5 relative z-10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center backdrop-blur-xs">
            <span className="text-[9px] font-bold text-slate-400 block uppercase">Pace Target</span>
            <span className="text-xs font-black text-amber-300">
              {report?.pace_target_qph ? `${report.pace_target_qph} Q/hr` : "20 Q/hr"}
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center backdrop-blur-xs">
            <span className="text-[9px] font-bold text-slate-400 block uppercase">Min. Practice</span>
            <span className="text-xs font-black text-emerald-400">
              {report?.practice_ratio_target ? `${report.practice_ratio_target}% Ratio` : "60% Ratio"}
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center backdrop-blur-xs">
            <span className="text-[9px] font-bold text-slate-400 block uppercase">Daily Goal</span>
            <span className="text-xs font-black text-indigo-300">3 Modular Tasks</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 relative z-10">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="py-4 px-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-black text-sm flex flex-col items-center justify-center gap-1 shadow-md active:scale-[0.98] transition-all tracking-wide"
          >
            <span className="text-lg">📋</span>
            <span>GET MENTORSHIP</span>
          </button>

          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="py-4 px-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-black text-sm flex flex-col items-center justify-center gap-1 shadow-md active:scale-[0.98] transition-all tracking-wide"
          >
            <span className="text-lg">💬</span>
            <span>CHAT</span>
          </button>
        </div>
      </div>

      {/* 2. FULL 5-TAB ACADEMIC AUDIT COCKPIT */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-[#0B132B] text-white">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm shadow-md font-bold">
                  ⚡
                </span>
                <div>
                  <h3 className="text-sm font-black tracking-tight text-white">
                    PrepWise Academic Strategy Audit
                  </h3>
                  <p className="text-[10px] text-slate-300 font-medium">
                    National Level Performance Engine • {targetExam}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 text-sm font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* 4 Segmented Slider Tabs */}
            <div className="flex p-1.5 bg-slate-100 border-b border-slate-200 text-[11px] font-black overflow-x-auto gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("daily")}
                className={`py-1.5 px-3 rounded-xl whitespace-nowrap transition-all flex items-center gap-1 ${
                  activeTab === "daily"
                    ? "bg-white text-indigo-950 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>🎯</span> Daily Tasks
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("subjects")}
                className={`py-1.5 px-3 rounded-xl whitespace-nowrap transition-all flex items-center gap-1 ${
                  activeTab === "subjects"
                    ? "bg-white text-indigo-950 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>📊</span> Subject Health
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("swot")}
                className={`py-1.5 px-3 rounded-xl whitespace-nowrap transition-all flex items-center gap-1 ${
                  activeTab === "swot"
                    ? "bg-white text-indigo-950 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>🔬</span> SWOT Audit
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("rank")}
                className={`py-1.5 px-3 rounded-xl whitespace-nowrap transition-all flex items-center gap-1 ${
                  activeTab === "rank"
                    ? "bg-white text-indigo-950 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>📈</span> Rank Forecast
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-3.5 text-xs flex-1">
              {/* TAB 1: DAILY TASKS */}
              {activeTab === "daily" && (
                <div className="space-y-3">
                  <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl">
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider block">
                      Daily Study Habits
                    </span>
                    <div className="font-black text-indigo-950 text-xs mt-0.5">
                      Apply these every day — personalized for your patterns
                    </div>
                  </div>

                  {!dailyTasks ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                      <p className="text-slate-500 text-[11px] font-semibold">
                        Click "Update & Refresh" below to generate your personalized daily habits
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {dailyTasks.map((t: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 shadow-2xs hover:border-indigo-300 transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{t.emoji}</span>
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 font-extrabold text-[10px] rounded-md">
                              {t.tag}
                            </span>
                          </div>
                          <div className="font-black text-slate-900 text-xs">{t.title}</div>
                          <div className="text-slate-700 text-[11px] font-medium leading-relaxed">
                            {t.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SUBJECT-WISE HEALTH */}
              {activeTab === "subjects" && (
                <div className="space-y-2.5">
                  {subjectAnalysis.map((sub: any, i: number) => {
                    const hasData = sub.health > 0;
                    return (
                      <div
                        key={i}
                        className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 text-xs">{sub.name}</span>
                            <span
                              className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${
                                !hasData
                                  ? "bg-slate-100 text-slate-500 border-slate-200"
                                  : sub.priority === "high"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}
                            >
                              {!hasData ? "No Data Yet" : sub.status}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-black ${hasData ? "text-indigo-700" : "text-slate-400"}`}>
                              {hasData ? `${sub.health}%` : "—"}
                            </span>
                            <span className="text-[9px] text-slate-400 block font-semibold">Mastery</span>
                          </div>
                        </div>

                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            style={{ width: hasData ? `${sub.health}%` : "0%" }}
                            className={`h-full transition-all ${
                              !hasData
                                ? "bg-slate-300"
                                : sub.health > 75
                                ? "bg-emerald-500"
                                : sub.health > 60
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                          />
                        </div>

                        <p className="text-[10.5px] text-slate-600 font-medium leading-relaxed">
                          {sub.recommendation}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 3: SWOT AUDIT */}
              {activeTab === "swot" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <div className="font-black text-emerald-950 text-xs mb-2 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                          ✓
                        </span>
                        Retained Strengths
                      </div>
                      <ul className="space-y-1.5 text-[11px] text-emerald-900 font-semibold">
                        {(report?.strengths || [
                          "Formula retention in key chapters",
                          "High consistency in daily check-ins",
                          "Positive accuracy in easy-medium questions",
                        ]).map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-600 font-bold">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl">
                      <div className="font-black text-rose-950 text-xs mb-2 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px]">
                          ⚠️
                        </span>
                        Fatal Mark Leaks
                      </div>
                      <ul className="space-y-1.5 text-[11px] text-rose-900 font-semibold">
                        {(report?.weaknesses || [
                          "Speed drop under exam pressure",
                          "Calculation errors in multi-step questions",
                          "Unattempted numerical value types",
                        ]).map((w: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-rose-600 font-bold">•</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                    <h4 className="text-xs font-black text-slate-900 mb-1 flex items-center gap-1.5">
                      <span>📝</span> Academic Strategist Summary
                    </h4>
                    <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                      {summary}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 4: RANK FORECAST */}
              {activeTab === "rank" && (
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl border border-indigo-900 shadow-md">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                      Simulated Trajectory
                    </span>
                    <div className="text-xl font-black text-amber-300 mt-1">
                      {prediction}
                    </div>
                    <p className="text-[10.5px] text-slate-300 mt-1 font-medium">
                      Calculated on continuous daily study pace, backlog clearing index, and mock test scores.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="text-xs font-black text-slate-900">Score Multiplier Roadmap</div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 py-1 border-b border-slate-200">
                      <span>Baseline Mock Score:</span>
                      <span className="font-black text-indigo-700">
                        {report?.rank_forecast?.baseline_mock_score || "No mock data yet"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 py-1 border-b border-slate-200">
                      <span>With {report?.practice_ratio_target || 60}% Practice Ratio:</span>
                      <span className="font-black text-emerald-700">
                        {report?.rank_forecast?.practice_boost || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 py-1">
                      <span>With Zero Backlogs:</span>
                      <span className="font-black text-amber-600">
                        {report?.rank_forecast?.backlog_potential || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* REFRESH BUTTON */}
              <div className="pt-2 space-y-1.5">
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 shadow-md"
                >
                  <span className={loading ? "animate-spin" : ""}>🔄</span>
                  {loading ? "Re-Analyzing Telemetry Data…" : "UPDATE & REFRESH ANALYSIS"}
                </button>
                <p className="text-[9.5px] text-center text-slate-400 font-medium">
                  ⚠️ Manual only — does not auto-refresh on page reload or login.
                  {lastRefreshed && (
                    <span className="block text-slate-400 mt-0.5">Last updated: {lastRefreshed}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all shadow-xs"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Mentor Chat Modal */}
      {chatOpen && (
        <AiMentorChat
          userId={userId}
          onClose={() => setChatOpen(false)}
          targetExam={targetExam}
          studentContext={studentContext}
        />
      )}
    </>
  );
}
