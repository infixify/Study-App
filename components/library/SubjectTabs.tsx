// components/library/SubjectTabs.tsx
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
    <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar">
      {subjects.map((s) => {
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
              active
                ? "bg-teal text-white shadow-teal/20 scale-[1.02]"
                : "bg-white dark:bg-[#121A29] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:text-teal dark:hover:text-white"
            }`}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}
