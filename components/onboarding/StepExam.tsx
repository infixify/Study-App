"use client";

import { ClassLevel, TargetExam } from "@/lib/supabase";
import { BackButton } from "./StepClass";

interface StepExamProps {
  classLevel: ClassLevel | null;
  selectedExam: TargetExam | null;
  wantsBoards: boolean;
  onSelectExam: (exam: TargetExam, includeSchool: boolean) => void;
  onBack: () => void;
}

const EXAM_OPTIONS: { value: TargetExam; label: string; desc: string; icon: string; badge?: string }[] = [
  { value: "JEE", label: "JEE Main & Adv", desc: "PCM • Engineering focus", icon: "⚡" },
  { value: "NEET", label: "NEET UG", desc: "PCB • Medical focus", icon: "🩺" },
  { value: "Both", label: "JEE + NEET Both", desc: "PCMB • All-rounder track", icon: "🎯", badge: "PCMB" },
  { value: "School", label: "School / Boards Only", desc: "Board exams & foundations", icon: "📚" },
];

export function StepExam({
  classLevel,
  selectedExam,
  onSelectExam,
  onBack,
}: StepExamProps) {
  const isDropper = classLevel === "Dropper";

  const handleExamSelect = (examValue: TargetExam) => {
    // Dropper students don't need school/boards; for all other classes, boards are ON by default
    const includeSchool = !isDropper;
    onSelectExam(examValue, includeSchool);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <div>
          <h2 className="text-xl font-bold text-white">Target Exam</h2>
          <p className="text-xs text-white/50">Pick your main competitive goal</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {EXAM_OPTIONS.map((exam) => {
          const isSelected = selectedExam === exam.value;
          return (
            <button
              key={exam.value}
              onClick={() => handleExamSelect(exam.value)}
              className={`w-full p-4 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between group ${
                isSelected
                  ? "bg-violet-500/15 border-violet-500/50 shadow-lg shadow-violet-500/10"
                  : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <span className="text-2xl group-hover:scale-110 transition-transform">{exam.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{exam.label}</span>
                    {exam.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        {exam.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/50 mt-0.5">{exam.desc}</p>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                  isSelected ? "border-violet-400 bg-violet-500" : "border-white/20 group-hover:border-white/40"
                }`}
              >
                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Info note showing boards prep is included */}
      {!isDropper && (
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
          <p className="text-xs text-white/40">
            ✨ Board & School exam preparation is included automatically
          </p>
        </div>
      )}
    </div>
  );
}
