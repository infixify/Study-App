// app/resources/page.tsx
"use client";

import { createElement as e, useEffect, useState } from "react";
import { supabase, classLevelsForContent } from "@/lib/supabase";
import SubjectTabs from "@/components/library/SubjectTabs";
import BottomNav from "@/components/dashboard/BottomNav";
import ResourceChapterList, { RESOURCE_TYPES } from "@/components/resources/ResourceChapterList";
import type { ChapterItem, Resource } from "@/components/resources/ResourceChapterList";

interface SubjectItem {
  id: string;
  name: string;
  subjectRowIds: string[];
  chapters: ChapterItem[];
}

export default function ResourcesPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("users")
        .select("class_level")
        .eq("uid", user.id)
        .maybeSingle();

      const classLevels = classLevelsForContent(profile?.class_level);

      const [resResult, subjectsResult, chaptersResult] = await Promise.all([
        supabase.from("resources").select("*"),
        supabase.from("subjects").select("id, name, display_order").order("display_order"),
        supabase
          .from("chapters")
          .select("id, subject_id, title, class_level, display_order")
          .in("class_level", classLevels)
          .order("display_order"),
      ]);

      if (cancelled) return;

      const resList: Resource[] = (resResult.data ?? []).map((r: any) => ({
        id: r.id,
        chapter_id: r.chapter_id,
        category: r.category,
        title: r.title,
        drive_link: r.drive_link,
        file_size_mb: r.file_size_mb,
        is_free: r.is_free,
      }));
      setResources(resList);

      const rawSubs = subjectsResult.data ?? [];
      const rawChaps = chaptersResult.data ?? [];

      const byName: Record<string, { name: string; rowIds: string[]; chaps: any[] }> = {};
      for (const s of rawSubs) {
        if (!byName[s.name]) {
          byName[s.name] = { name: s.name, rowIds: [], chaps: [] };
        }
        byName[s.name].rowIds.push(s.id);
      }
      for (const c of rawChaps) {
        for (const grp of Object.values(byName)) {
          if (grp.rowIds.includes(c.subject_id)) {
            grp.chaps.push({ id: c.id, title: c.title, display_order: c.display_order });
          }
        }
      }

      const merged: SubjectItem[] = Object.entries(byName).map(([name, grp]) => ({
        id: grp.rowIds[0] || name,
        name,
        subjectRowIds: grp.rowIds,
        chapters: grp.chaps.sort((a, b) => a.display_order - b.display_order),
      }));

      setSubjects(merged);
      if (merged.length > 0 && !activeSubjectId) {
        setActiveSubjectId(merged[0].id);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activeSubjectId]);

  const activeTypeDef = RESOURCE_TYPES.find((t) => t.key === activeType);
  const activeSubject =
    subjects.find((s) => s.id === activeSubjectId) || subjects[0] || null;

  function openType(typeKey: string) {
    setActiveType(typeKey);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090E17] text-slate-900 dark:text-slate-100 pb-28 px-5 pt-7">
      <div className="max-w-md mx-auto">
        {!activeType ? (
          <div>
            <h1 className="font-display text-2xl font-black mb-1 tracking-tight text-slate-900 dark:text-white">
              Resource Vault
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">
              Curated study materials, formula books & high-yield notes.
            </p>

            {loading ? (
              <div className="py-12 text-center text-xs font-semibold text-slate-400 animate-pulse">
                Loading resources…
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {RESOURCE_TYPES.map((t) => {
                  const has = resources.some((r) => r.category === t.key);
                  return (
                    <button
                      key={t.key}
                      type="button"
                      disabled={!has}
                      onClick={() => openType(t.key)}
                      className={`relative rounded-2xl p-4 flex flex-col items-center justify-between text-center transition-all duration-200 border ${
                        has
                          ? "bg-white dark:bg-[#121A29] border-slate-200 dark:border-white/10 shadow-sm hover:border-teal hover:shadow-teal/10 hover:scale-[1.02] cursor-pointer"
                          : "bg-slate-100/70 dark:bg-white/5 border-slate-200/50 dark:border-white/5 opacity-70 cursor-not-allowed"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-2.5 transition-transform ${
                          has
                            ? "bg-teal/10 dark:bg-teal/20 text-teal shadow-xs"
                            : "bg-slate-200/70 dark:bg-white/10"
                        }`}
                      >
                        {t.icon}
                      </div>

                      <div>
                        <span
                          className={`text-xs font-bold block leading-tight ${
                            has
                              ? "text-slate-900 dark:text-white"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {t.label}
                        </span>

                        {has ? (
                          <span className="inline-block mt-1 text-[9.5px] font-bold text-teal dark:text-[#2DD4BF]">
                            Available ↗
                          </span>
                        ) : (
                          <span className="inline-block mt-1 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                            Coming soon
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            <button
              onClick={() => setActiveType(null)}
              className="inline-flex items-center gap-1 text-xs font-bold text-teal dark:text-[#2DD4BF] hover:underline mb-4"
            >
              ← Back to All Resources
            </button>
            <h1 className="font-display text-2xl font-black mb-4 text-slate-900 dark:text-white">
              {activeTypeDef?.label}
            </h1>

            {activeSubject && (
              <SubjectTabs
                subjects={subjects}
                activeId={activeSubject.id}
                onChange={setActiveSubjectId}
              />
            )}

            {activeSubject && (
              <div className="mt-4">
                <ResourceChapterList
                  category={activeType}
                  chapters={activeSubject.chapters}
                  resources={resources.filter((r) => r.category === activeType)}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
