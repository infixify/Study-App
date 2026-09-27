"use client";

interface Chapter {
  id: string;
  title: string;
  isToughTopic: boolean;
  classTag?: string; // "10" | "11" | "12" | "Dropper" — optional so single-class views still work
  inCompetitiveSyllabus?: boolean; // undefined-safe so non-Library callers still work
  jeeScope?: "common" | "advanced_only"; // only meaningful when targetExam === "JEE"
}

interface ChapterListProps {
  subjectId: string;
  chapters: Chapter[];
  targetExam?: string | null;
}

// Keyed off subjectId at the call site (see app/library/page.tsx) so this
// component remounts on subject change instead of re-rendering with stale
// data — this is the fix for the "tab switches but content doesn't" bug.
export default function ChapterList({ chapters, targetExam }: ChapterListProps) {
  return (
    <div className="flex flex-col gap-3 mt-4">
      {chapters.map((ch) => {
        // Droppers only ever study JEE/NEET content — a "not in competitive
        // syllabus" badge is meaningless to them, so never show it.
        const showOffSyllabusBadge =
          ch.classTag !== "Dropper" &&
          targetExam !== "Boards" &&
          ch.inCompetitiveSyllabus === false;

        const showAdvancedOnlyBadge =
          targetExam === "JEE" && ch.jeeScope === "advanced_only";

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
            {(showOffSyllabusBadge || showAdvancedOnlyBadge || ch.isToughTopic) && (
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
                {ch.isToughTopic && (
                  <span className="text-[10px] font-semibold text-coral bg-coral/10 px-2 py-1 rounded-full">
                    Tough topic
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
      {chapters.length === 0 && (
        <p className="text-sm text-slate text-center py-8">No chapters yet.</p>
      )}
    </div>
  );
}
