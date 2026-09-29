// components/library/ChapterList.tsx
"use client";

import { useState } from "react";

interface Chapter {
  id: string;
  chapter_name: string;
  subject: string;
  class_level: string;
}

interface ChapterListProps {
  chapters: Chapter[];
  onSelectChapter?: (chapter: Chapter) => void;
  selectedChapterId?: string;
}

export default function ChapterList({
  chapters,
  onSelectChapter,
  selectedChapterId,
}: ChapterListProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredChapters = chapters.filter((c) =>
    c.chapter_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          placeholder="Search chapter..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
        />
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {filteredChapters.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No chapters found
          </div>
        ) : (
          filteredChapters.map((ch) => {
            const isSelected = selectedChapterId === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => onSelectChapter?.(ch)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                  isSelected
                    ? "bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm"
                    : "bg-white border-slate-200/90 text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Class {ch.class_level} • {ch.subject}
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">
                    {ch.chapter_name}
                  </div>
                </div>

                <div className="text-slate-400 text-xs font-bold">
                  {isSelected ? "●" : "→"}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
