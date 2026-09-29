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

  const status = report?.overall_status || "On Track";
  const prediction = report?.score_prediction || `Targeting ${targetExam}: Aim for Top Percentile`;
  const summary =
    report?.diagnostic_summary ||
    "Maintain a rigid 1:1.5 Theory-to-Practice ratio to guarantee high retention on exam day.";

  const isWarning =
    status.toLowerCase().includes("attention") ||
    status.toLowerCase().includes("lag") ||
    status.toLowerCase().includes("backlog");

  return (
    <>
      {/* Sleek Compact Card */}
      <div className="rounded-2xl p-3.5 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 border border-indigo-100/80 shadow-xs relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-200/30 rounded-full blur-xl pointer-events-none" />

        {/* Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs shadow-xs">
              🧠
            </span>
            <div>
              <h2 className="text-xs font-black tracking-tight text-ink flex items-center gap-1.5">
                AI Academic Mentor
                <span className="text-[9.5px] font-bold text-indigo-600 bg-indigo-100/70 px-1.5 py-0.5 rounded-md">
                  {targetExam} Diagnostic
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border ${
                isWarning
                  ? "bg-rose-50 text-rose-600 border-rose-200"
                  : "bg-emerald-50 text-emerald-600 border-emerald-200"
              }`}
            >
              • {status}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="w-5 h-5 rounded-md text-slate hover:text-ink hover:bg-black/5 flex items-center justify-center transition-all disabled:opacity-40"
              title="Recalculate Academic Report"
            >
              <span className={`text-[11px] ${loading ? "animate-spin" : ""}`}>🔄</span>
            </button>
          </div>
        </div>

        {/* Compact Prediction & Insight */}
        <div className="bg-white/90 backdrop-blur-xs rounded-xl p-2 border border-indigo-100/60 mb-2.5">
          <div className="text-[10.5px] font-black text-indigo-950 mb-0.5">
            {prediction}
          </div>
          <p className="text-[10.5px] text-slate line-clamp-2 leading-relaxed">
            {summary}
          </p>
        </div>

        {/* Dual Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.98] transition-all"
          >
            <span>📋</span> View 7-Day Plan
          </button>

          <button
            type="button"
            onClick={onOpenDoubtSolver}
            className="py-1.5 px-3 rounded-xl bg-white hover:bg-paper text-indigo-700 font-black text-[11px] border border-indigo-200/90 flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.98] transition-all"
          >
            <span className="text-teal">✨</span> Ask Doubt Solver
          </button>
        </div>
      </div>

      {/* Full 7-Day Diagnostic Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl border border-ink/10 overflow-hidden">
            <div className="p-4 border-b border-ink/8 flex items-center justify-between bg-paper/60">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm shadow-xs">
                  🧠
                </span>
                <div>
                  <h3 className="text-sm font-black text-ink">Personalized Academic Diagnostic</h3>
                  <p className="text-[10px] text-slate">Tailored for {targetExam}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate hover:bg-ink/10 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3.5 text-xs">
              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate uppercase tracking-wider">Status</span>
                  <div className="font-black text-indigo-950 text-sm">{status}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate uppercase tracking-wider">Benchmark</span>
                  <div className="font-bold text-indigo-700 text-xs">{prediction}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                  <div className="font-black text-emerald-800 text-[11px] mb-1.5 flex items-center gap-1">
                    <span>✓</span> Strengths
                  </div>
                  <ul className="space-y-1 text-[10.5px] text-emerald-950">
                    {(report?.strengths || ["Consistent daily check-ins"]).map((s: string, i: number) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-2xl">
                  <div className="font-black text-rose-800 text-[11px] mb-1.5 flex items-center gap-1">
                    <span>⚠️</span> Focus Areas
                  </div>
                  <ul className="space-y-1 text-[10.5px] text-rose-950">
                    {(report?.weaknesses || ["Increase question solving pace"]).map((w: string, i: number) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-3.5 bg-paper/60 border border-ink/8 rounded-2xl">
                <h4 className="text-[11px] font-black text-ink mb-1">Academic Analysis</h4>
                <p className="text-[11px] text-slate leading-relaxed whitespace-pre-wrap">{summary}</p>
              </div>

              <div>
                <h4 className="text-[11px] font-black text-ink mb-2">7-Day Action Blueprint</h4>
                <div className="space-y-1.5">
                  {(report?.seven_day_plan || []).map((step: any, i: number) => (
                    <div key={i} className="p-2.5 bg-white border border-ink/8 rounded-xl flex items-start gap-2 shadow-2xs">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-black text-[9.5px] flex-shrink-0">
                        {step.day}
                      </span>
                      <div className="flex-1">
                        <div className="font-bold text-ink text-[11px]">{step.focus}</div>
                        <div className="text-slate text-[10px]">{step.target}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-ink/8 bg-paper/40 flex justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-ink text-paper rounded-xl font-bold text-xs"
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
