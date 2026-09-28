"use client";

import { useState } from "react";
import { ClassLevel, TargetExam } from "@/lib/supabase";
import { BackButton } from "./StepClass";

interface StepExamProps {
  classLevel: ClassLevel | null;
  selectedExam: TargetExam | null;
  wantsBoards: boolean;
  onContinue: (exam: TargetExam, wantsBoards: boolean) => void;
  onBack: () => void;
}

export default function StepExam({
  classLevel,
  selectedExam,
  wantsBoards,
  onContinue,
  onBack,
}: StepExamProps) {
  const [exam, setExam] = useState<TargetExam | null>(selectedExam);
  
  // Droppers don't have school/board exams
  const isDropper = classLevel === "Dropper";

  // For 10, 11, 12, and 11_12, default to true unless explicitly false
  const [includeSchool, setIncludeSchool] = useState<boolean>(
    isDropper ? false : (wantsBoards ?? true)
  );

  // Dynamic naming based on student's class (including 11_12)
  const schoolExamTitle =
    classLevel === "11"
      ? "Class 11 School Exams"
      : classLevel === "12"
      ? "Class 12 Board Exams"
      : classLevel === "11_12"
      ? "School & Board Exams"
      : classLevel === "10"
      ? "Class 10 Board Exams"
      : "School / Board Exams";

  const schoolExamSubtitle =
    classLevel === "11"
      ? "Include CBSE/State annual exams and NCERT coverage alongside competitive prep"
      : classLevel === "11_12"
      ? "Include school annual exams, Board countdown & NCERT coverage alongside competitive prep"
      : "Track Board countdown, subjective practice & NCERT alongside competitive prep";

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

      {/* School / Board Exam Toggle (Hidden only for Droppers) */}
      {!isDropper && (
        <div className="mt-6 rounded-ticket border border-ink/10 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{schoolExamTitle}</p>
              <p className="text-xs text-slate mt-0.5 leading-relaxed">
                {schoolExamSubtitle}
              </p>
            </div>
            
            {/* Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={includeSchool}
              onClick={() => setIncludeSchool((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                includeSchool ? "bg-teal" : "bg-ink/20"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  includeSchool ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Continue Button */}
      <button
        disabled={!exam}
        onClick={() => exam && onContinue(exam, isDropper ? false : includeSchool)}
        className="w-full mt-8 bg-ink text-paper rounded-ticket py-3.5 font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-ink-100 transition-colors shadow-md"
      >
        Continue
      </button>
    </div>
  );
}
