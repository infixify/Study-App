"use client";

import { supabase } from "@/lib/supabase";

type ProgressStatus = "not_started" | "in_progress" | "done";

interface Chapter {
  id: string;
  title: string;
  isToughTopic: boolean;
  classTag?: string;
  inCompetitiveSyllabus?: boolean;
  jeeScope?: "common" | "advanced_only";
  neetScope?: "common" | "neet_only";
  progressStatus?: ProgressStatus; // defaults to "not_started" if absent
}

interface ChapterListProps {
  subjectId: string;
  chapters: Chapter[];
  targetExam?: string | null;
  onProgressChange?: (chapterId: string, status: ProgressStatus) => void;
}

const STATUS_LABELS: Record<ProgressStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_STYLES: Record<ProgressStatus, string> = {
  not_started: "bg-ink/5 text-slate border-ink/10",
  in_progress: "bg-marigold/10 text-marigold border-marigold/30",
  done: "bg-teal/10 text-teal border-teal/30",
};

export default function ChapterList({ chapters, targetExam, onProgressChange }: ChapterListProps) {
  async function updateStatus(chapterId: string, status: ProgressStatus) {
    // Optimistic UI update happens via parent state (onProgressChange);
    // this just persists it.
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    await supabase.from("chapter_progress").upsert(
      {
        user_id: user.id,
        chapter_id: chapterId,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,chapter_id" }
    );

    onProgressChange?.(chapterId, status);
  }

  return (
    <div className="flex flex-col gap-3 mt-4">
      {chapters.map((ch) => {
        const showOffSyllabusBadge =
          ch.classTag !== "Dropper" &&
          targetExam !== "Boards" &&
          ch.inCompetitiveSyllabus === false;

        const showAdvancedOnlyBadge =
          targetExam === "JEE" && ch.jeeScope === "advanced_only";

        const showNeetOnlyBadge =
          targetExam === "NEET" && ch.neetScope === "neet_only";

        const status = ch.progressStatus ?? "not_started";

        return (
          <div
            key={ch.id}
            className="bg-white rounded-ticket border border-ink/10 px-4 py-3 flex flex-col gap-2"
          >
            <div className="flex items-start gap-2">
              {ch.classTag && (
                <span className="shrink-0 mt-0.5 text-[10px] font-semibold text-ink/60 bg-ink/5 px-2 py-1 rounded-full">
                  {ch.classTag === "Dropper" ? "Dropper" : `Class ${ch.classTag}`}
                </span>
              )}
              <span className="text-sm font-medium text-ink">{ch.title}</span>
            </div>

            {(showOffSyllabusBadge || showAdvancedOnlyBadge || showNeetOnlyBadge || ch.isToughTopic) && (
              <div className="flex flex-wrap items-center gap-2">
                {showOffSyllabusBadge && (
                  <span className="text-[10px] font-semibold text-ink/50 bg-ink/5 px-2 py-1 rounded-full whitespace-nowrap">
                    Not in {targetExam}
                  </span>
                )}
                {showAdvancedOnlyBadge && (
                  <span className="text-[10px] font-semibold text-marigold bg-marigold/10 px-2 py-1 rounded-full whitespace-nowrap">
                    Advanced only
                  </span>
                )}
                {showNeetOnlyBadge && (
                  <span className="text-[10px] font-semibold text-marigold bg-marigold/10 px-2 py-1 rounded-full whitespace-nowrap">
                    NEET only
                  </span>
                )}
                {ch.isToughTopic && (
                  <span className="text-[10px] font-semibold text-coral bg-coral/10 px-2 py-1 rounded-full">
                    Tough topic
                  </span>
                )}
              </div>
            )}

            {/* Progress status selector */}
            <div className="flex gap-1.5 mt-1">
              {(["not_started", "in_progress", "done"] as ProgressStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(ch.id, s)}
                  className={`flex-1 text-[11px] font-medium py-1.5 rounded-full border transition-colors ${
                    status === s ? STATUS_STYLES[s] : "border-ink/10 text-ink/40 bg-white"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {chapters.length === 0 && (
        <p className="text-sm text-slate text-center py-8">No chapters yet.</p>
      )}
    </div>
  );
}
