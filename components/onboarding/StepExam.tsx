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
  const [boards, setBoards] = useState(wantsBoards);

  // Boards checkbox is only relevant for class 10 / 12
  const showBoardsCheckbox = classLevel === "10" || classLevel === "12";

  return (
    <div>
      <BackButton onClick={onBack} />
      <h2 className="font-display text-2xl font-semibold mt-4">
        What are you targeting?
      </h2>
      <p className="text-slate text-sm mt-1 mb-8">
        We'll build your countdown and mock test library around this.
      </p>

      <div className="flex flex-col gap-3">
        {(["JEE", "NEET"] as TargetExam[]).map((e) => (
          <button
            key={e}
            onClick={() => setExam(e)}
            className={`text-left rounded-ticket border p-4 transition-colors ${
              exam === e
                ? "border-marigold bg-marigold/10"
                : "border-ink/12 bg-white hover:border-ink/25"
            }`}
          >
            <div className="font-display text-lg font-semibold">{e}</div>
            <div className="text-xs text-slate mt-0.5">
              {e === "JEE" ? "Mains + Advanced tracking" : "NEET-UG tracking"}
            </div>
          </button>
        ))}

        {showBoardsCheckbox && (
          <label className="flex items-center gap-3 rounded-ticket border border-ink/12 bg-white p-4 mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={boards}
              onChange={(e) => setBoards(e.target.checked)}
              className="w-4 h-4 accent-marigold"
            />
            <div>
              <div className="font-medium text-sm">Also track Boards</div>
              <div className="text-xs text-slate">
                Adds a Boards countdown and syllabus alongside {exam ?? "your entrance exam"}
              </div>
            </div>
          </label>
        )}
      </div>

      <button
        disabled={!exam}
        onClick={() => exam && onContinue(exam, boards)}
        className="w-full mt-8 bg-ink text-paper rounded-ticket py-3.5 font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-ink-100 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}
