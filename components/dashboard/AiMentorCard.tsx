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
      <div className="rounded-2xl p-3.5 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 border border-indigo-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-200/30 rounded-full blur-xl pointer-events-none" />

        {/* Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs shadow-xs font-bold">
              🧠
            </span>
            <div>
              <h2 className="text-xs font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                AI Academic Mentor
                <span className="text-[9.5px] font-black text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-md">
                  {targetExam} Diagnostic
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border ${
                isWarning
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              • {status}
            </span>
          </div>
        </div>

        {/* Compact Prediction & Insight */}
        <div className="bg-white/95 backdrop-blur-xs rounded-xl p-2.5 border border-indigo-100/80 mb-2.5 shadow-2xs">
          <div className="text-[11px] font-black text-indigo-950 mb-0.5">
            {prediction}
          </div>
          <p className="text-[10.5px] text-slate-600 line-clamp-2 leading-relaxed font-medium">
            {summary}
          </p>
        </div>

        {/* Dual Action Buttons (Renamed as requested) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] transition-all tracking-wide"
          >
            <span>📋</span> GET MENTORSHIP
          </button>

          <button
            type="button"
            onClick={onOpenDoubtSolver}
            className="py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-indigo-700 font-black text-[11px] border border-indigo-200 flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.98] transition-all tracking-wide"
          >
            <span className="text-teal-600">✨</span> Ask Doubt Solver
          </button>
        </div>
      </div>

      {/* Full Mentorship & Diagnostic Modal with Internal Refresh Button */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm shadow-xs font-bold">
                  🧠
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Personalized Academic Diagnostic</h3>
                  <p className="text-[10px] font-semibold text-slate-500">Director's Analysis for {targetExam}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-3.5 text-xs">
              {/* Status Box */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Academic Status</span>
                  <div className="font-black text-indigo-950 text-sm mt-0.5">{status}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Benchmark</span>
                  <div className="font-black text-indigo-700 text-xs mt-0.5">{prediction}</div>
                </div>
              </div>

              {/* Strengths & Red Flags */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
                  <div className="font-black text-emerald-900 text-[11px] mb-1.5 flex items-center gap-1">
                    <span>✓</span> Strengths
                  </div>
                  <ul className="space-y-1 text-[10.5px] text-emerald-950 font-medium">
                    {(report?.strengths || ["Consistent daily check-ins"]).map((s: string, i: number) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl">
                  <div className="font-black text-rose-900 text-[11px] mb-1.5 flex items-center gap-1">
                    <span>⚠️</span> Areas of Concern
                  </div>
                  <ul className="space-y-1 text-[10.5px] text-rose-950 font-medium">
                    {(report?.weaknesses || ["Increase question solving pace"]).map((w: string, i: number) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Academic Review Summary */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <h4 className="text-[11px] font-black text-slate-900 mb-1">Director's Performance Review</h4>
                <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                  {summary}
                </p>
              </div>

              {/* 7-Day Plan Blueprint */}
              <div>
                <h4 className="text-[11px] font-black text-slate-900 mb-2">7-Day Remedial Action Blueprint</h4>
                <div className="space-y-1.5">
                  {(report?.seven_day_plan || []).map((step: any, i: number) => (
                    <div key={i} className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-start gap-2 shadow-2xs">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-black text-[9.5px] flex-shrink-0">
                        {step.day}
                      </span>
                      <div className="flex-1">
                        <div className="font-bold text-slate-900 text-[11px]">{step.focus}</div>
                        <div className="text-slate-600 text-[10px] font-medium">{step.target}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PROMINENT REFRESH BUTTON INSIDE MODAL */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  <span className={loading ? "animate-spin" : ""}>🔄</span>
                  {loading ? "Analyzing Latest Progress…" : "UPDATE & REFRESH PROGRESS"}
                </button>
                <p className="text-[9.5px] text-center text-slate-500 mt-1">
                  Recalculates diagnosis with today's logged study hours, DPP questions & mock tests.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/70 flex justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all"
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
