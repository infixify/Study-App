// components/dashboard/AiMentorCard.tsx
"use client";

import React, { useState } from "react";

interface AiMentorCardProps {
  userId: string;
  targetExam?: string;
  report: any;
  loading: boolean;
  onRefresh: () => void;
  onOpenDoubtSolver?: () => void;
}

export default function AiMentorCard({
  targetExam = "Competitive Exam",
  report,
  loading,
  onRefresh,
  onOpenDoubtSolver,
}: AiMentorCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"plan" | "diagnostics" | "simulation">("plan");

  const status = report?.overall_status || "Consistent Momentum";
  const prediction = report?.score_prediction || `Projected: 98.4+ Percentile (${targetExam})`;
  const summary =
    report?.diagnostic_summary ||
    "Maintain a rigid 1:1.5 Theory-to-Practice ratio. High retention guaranteed with 45+ daily questions.";

  const isWarning =
    status.toLowerCase().includes("attention") ||
    status.toLowerCase().includes("lag") ||
    status.toLowerCase().includes("backlog");

  return (
    <>
      {/* 1. JEETRACK STYLE COCKPIT CARD ON DASHBOARD */}
      <div className="rounded-2xl p-4 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0F172A] text-white shadow-lg border border-indigo-900/60 relative overflow-hidden">
        {/* Subtle Neon Radial Glow */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-teal-500/10 rounded-full blur-xl pointer-events-none" />

        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center text-xs shadow-md font-bold">
              ⚡
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-black tracking-tight text-white uppercase">
                  Director's AI Diagnostic
                </h2>
                <span className="text-[9px] font-black text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-700/60">
                  {targetExam}
                </span>
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

        {/* Key Metrics Mini-Bar (JEETrack Specialty) */}
        <div className="grid grid-cols-3 gap-1.5 my-2.5 relative z-10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center backdrop-blur-xs">
            <span className="text-[9px] font-bold text-slate-400 block uppercase">Pace Target</span>
            <span className="text-xs font-black text-amber-300">22 Q/hr</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center backdrop-blur-xs">
            <span className="text-[9px] font-bold text-slate-400 block uppercase">Min. Practice</span>
            <span className="text-xs font-black text-emerald-400">60% Ratio</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center backdrop-blur-xs">
            <span className="text-[9px] font-bold text-slate-400 block uppercase">Retention</span>
            <span className="text-xs font-black text-indigo-300">High Yield</span>
          </div>
        </div>

        {/* Prediction Summary Strip */}
        <div className="bg-black/30 backdrop-blur-md rounded-xl p-2.5 border border-white/10 mb-3 relative z-10">
          <div className="text-[11px] font-black text-amber-300 tracking-tight flex items-center gap-1.5">
            <span>🎯</span> {prediction}
          </div>
          <p className="text-[10px] text-slate-300 line-clamp-2 mt-0.5 leading-relaxed font-medium">
            {summary}
          </p>
        </div>

        {/* Dual Primary Action Buttons */}
        <div className="grid grid-cols-2 gap-2 relative z-10">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98] transition-all tracking-wide"
          >
            <span>📋</span> GET MENTORSHIP
          </button>

          <button
            type="button"
            onClick={onOpenDoubtSolver}
            className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black text-xs border border-white/20 flex items-center justify-center gap-1.5 backdrop-blur-md shadow-xs active:scale-[0.98] transition-all tracking-wide"
          >
            <span className="text-amber-400">✨</span> Ask Doubt Solver
          </button>
        </div>
      </div>

      {/* 2. JEETRACK SUITE 3-TAB DIRECTOR'S MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-[#0B132B] text-white">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm shadow-md font-bold">
                  ⚡
                </span>
                <div>
                  <h3 className="text-sm font-black tracking-tight text-white">
                    Kota Academic Audit Cockpit
                  </h3>
                  <p className="text-[10px] text-slate-300 font-medium">
                    Personalized Guidance Engine • {targetExam}
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

            {/* 3 Segmented Nav Tabs (JEETrack Standard) */}
            <div className="grid grid-cols-3 p-1.5 bg-slate-100 border-b border-slate-200 text-xs font-black">
              <button
                type="button"
                onClick={() => setActiveTab("plan")}
                className={`py-2 rounded-xl transition-all ${
                  activeTab === "plan"
                    ? "bg-white text-indigo-950 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🗺️ 7-Day Plan
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("diagnostics")}
                className={`py-2 rounded-xl transition-all ${
                  activeTab === "diagnostics"
                    ? "bg-white text-indigo-950 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🔬 Audit / SWOT
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("simulation")}
                className={`py-2 rounded-xl transition-all ${
                  activeTab === "simulation"
                    ? "bg-white text-indigo-950 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📈 Rank Forecast
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-3.5 text-xs flex-1">
              {/* TAB 1: 7-DAY PRECISION ROADMAP */}
              {activeTab === "plan" && (
                <div className="space-y-2">
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider">
                        Strategy Focus
                      </span>
                      <div className="font-black text-indigo-950 text-xs mt-0.5">
                        High-Yield Numerical Practice & Formula Drills
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(report?.seven_day_plan || [
                      { day: "Day 1", focus: "Mechanics & Calculus Drift", target: "45 DPP Qs + 1h Formula Revision" },
                      { day: "Day 2", focus: "Electrodynamics High Yields", target: "60 Numerical Practice + Error Log" },
                      { day: "Day 3", focus: "Physical Chemistry Numericals", target: "50 Standard Coaching Module Qs" },
                      { day: "Day 4", focus: "Full Length Mock & Speed Test", target: "3h Timed Test + Negative Marking Audit" },
                      { day: "Day 5", focus: "Weak Chapters Elimination", target: "Target backlog chapters identified in Radar" },
                      { day: "Day 6", focus: "Inorganic NCERT & Shortcuts", target: "Memory line-by-line active recall" },
                      { day: "Day 7", focus: "Weekly Review & Milestone Test", target: "Score Target: +15 Marks over previous" },
                    ]).map((step: any, i: number) => (
                      <div
                        key={i}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 shadow-2xs hover:border-indigo-300 transition-all"
                      >
                        <span className="px-2 py-1 rounded-lg bg-indigo-600 text-white font-black text-[10px] flex-shrink-0 shadow-xs">
                          {step.day}
                        </span>
                        <div className="flex-1">
                          <div className="font-black text-slate-900 text-xs">{step.focus}</div>
                          <div className="text-slate-600 text-[10.5px] font-semibold mt-0.5">
                            {step.target}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: DIAGNOSTICS & SWOT */}
              {activeTab === "diagnostics" && (
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
                          "Formula retention in Mechanics",
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
                      <span>📝</span> Comprehensive Kota Audit Summary
                    </h4>
                    <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                      {summary}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: SIMULATION & RANK BRACKET */}
              {activeTab === "simulation" && (
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl border border-indigo-900 shadow-md">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                      Simulated Trajectory
                    </span>
                    <div className="text-xl font-black text-amber-300 mt-1">
                      {prediction}
                    </div>
                    <p className="text-[10.5px] text-slate-300 mt-1">
                      Calculated on continuous daily study pace, backlog clearing index, and mock test scores.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="text-xs font-black text-slate-900">Score Multiplier Roadmap</div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 py-1 border-b border-slate-200">
                      <span>Baseline Mock Score:</span>
                      <span className="font-black text-indigo-700">140 - 170 / 300</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 py-1 border-b border-slate-200">
                      <span>With 60% Practice Ratio:</span>
                      <span className="font-black text-emerald-700">+35 Marks Potential</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 py-1">
                      <span>With Zero Backlogs:</span>
                      <span className="font-black text-amber-600">Top 1% Percentile Zone</span>
                    </div>
                  </div>
                </div>
              )}

              {/* PROMINENT REFRESH BUTTON (Inside Modal) */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 shadow-md"
                >
                  <span className={loading ? "animate-spin" : ""}>🔄</span>
                  {loading ? "Re-Analyzing Kota Telemetry…" : "UPDATE & REFRESH PROGRESS"}
                </button>
                <p className="text-[9.5px] text-center text-slate-500 mt-1 font-medium">
                  Triggers Gemini AI diagnostic with latest questions, hours & test scores.
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
    </>
  );
}
