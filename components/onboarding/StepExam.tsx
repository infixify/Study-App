"use client";

import { useState } from "react";
import { ClassLevel, TargetExam } from "@/lib/supabase";
import { BackButton } from "./StepClass";

interface StepExamProps {
  classLevel: ClassLevel | null;
  selectedExam: TargetExam | null;
  wantsBoards?: boolean;
  onContinue: (exam: TargetExam, wantsBoards: boolean) => void;
  onBack: () => void;
}

export function StepExam({
  classLevel,
  selectedExam,
  onContinue,
  onBack,
}: StepExamProps) {
  const [exam, setExam] = useState<TargetExam | null>(selectedExam);
  
  // Droppers don't have school/board exams; all others default to true (Boards/School prep is ON by default)
  const isDropper = classLevel === "Dropper";
  const includeSchool = !isDropper;

  return (
    <div>
      <BackButton onClick={onBack} />
      <h2 className="font-display text-2xl font-semibold mt-4">
        What are you targeting?
      </h2>
      <p className="text-slate text-sm mt-1 mb-6">
        We'll build your countdown, syllabus, and test tracker around your target.
      </p>

      {/* Target Exam Selection (JEE / NEET) */}
      <div className="flex flex-col gap-3">
        {(["JEE", "NEET"] as TargetExam[]).map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setExam(e)}
            className={`text-left rounded-ticket border p-4 transition-all ${
              exam === e
                ? "border-marigold bg-marigold/10 shadow-xs"
                : "border-ink/12 bg-white hover:border-ink/25"
            }`}
          >
            <div className="font-display text-lg font-semibold text-ink">{e}</div>
            <div className="text-xs text-slate mt-0.5">
              {e === "JEE" ? "JEE Mains + Advanced tracking" : "NEET-UG tracking"}
            </div>
          </button>
        ))}
      </div>

      {/* Continue Button */}
      <button
        disabled={!exam}
        onClick={() => exam && onContinue(exam, includeSchool)}
        className="w-full mt-8 bg-ink text-paper rounded-ticket py-3.5 font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-ink-100 transition-colors shadow-md"
      >
        Continue
      </button>
    </div>
  );
}

export default StepExam;
