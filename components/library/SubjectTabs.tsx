"use client";

interface Subject {
  id: string;
  name: string;
}

interface SubjectTabsProps {
  subjects: Subject[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function SubjectTabs({ subjects, activeId, onChange }: SubjectTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 no-scrollbar">
      {subjects.map((s) => {
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={`shrink-0 px-4 py-2 rounded-ticket text-sm font-medium transition-colors ${
              active ? "bg-ink text-paper" : "bg-ink/5 text-slate"
            }`}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}
