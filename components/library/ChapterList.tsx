"use client";

interface Chapter {
  id: string;
  title: string;
  isToughTopic: boolean;
}

interface ChapterListProps {
  subjectId: string;
  chapters: Chapter[];
}

// Keyed off subjectId at the call site (see app/library/page.tsx) so this
// component remounts on subject change instead of re-rendering with stale
// data — this is the fix for the "tab switches but content doesn't" bug.
export default function ChapterList({ chapters }: ChapterListProps) {
  return (
    <div className="flex flex-col gap-3 mt-4">
      {chapters.map((ch) => (
        <div
          key={ch.id}
          className="bg-white rounded-ticket border border-ink/10 px-4 py-3 flex items-center justify-between"
        >
          <span className="text-sm font-medium text-ink">{ch.title}</span>
          {ch.isToughTopic && (
            <span className="text-[10px] font-semibold text-coral bg-coral/10 px-2 py-1 rounded-full">
              Tough topic
            </span>
          )}
        </div>
      ))}
      {chapters.length === 0 && (
        <p className="text-sm text-slate text-center py-8">No chapters yet.</p>
      )}
    </div>
  );
}
