"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ChapterBacklogItem {
  id: string;
  title: string;
  subjectName: string;
  type: "chapter";
}

interface CustomBacklogItem {
  id: string;
  title: string;
  subjectName: string;
  priority: "high" | "medium" | "low";
  type: "custom";
}

type CombinedBacklog = ChapterBacklogItem | CustomBacklogItem;

export function BacklogRadar({ userId }: { userId: string }) {
  const [backlogs, setBacklogs] = useState<CombinedBacklog[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Adding Custom Backlog
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("high");
  const [saving, setSaving] = useState(false);

  const fetchBacklogs = async () => {
    if (!userId) return;
    try {
      // 1. Fetch chapter backlogs from syllabus
      const { data: chapterData } = await supabase
        .from("chapter_progress")
        .select("chapter_id, chapters(title, subjects(name))")
        .eq("user_id", userId)
        .eq("is_backlog", true);

      const chapterBacklogs: ChapterBacklogItem[] = (chapterData ?? [])
        .filter((d: any) => d.chapters)
        .map((d: any) => ({
          id: d.chapter_id,
          title: d.chapters.title,
          subjectName: d.chapters.subjects?.name || "General",
          type: "chapter",
        }));

      // 2. Fetch custom manual backlogs from tasks table
      const { data: customData } = await supabase
        .from("tasks")
        .select("id, title, priority, status")
        .eq("user_id", userId)
        .eq("task_type", "backlog")
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      const customBacklogs: CustomBacklogItem[] = (customData ?? []).map((t: any) => ({
        id: t.id,
        title: t.title,
        subjectName: "Task",
        priority: (t.priority as "high" | "medium" | "low") || "high",
        type: "custom",
      }));

      // Combine both
      setBacklogs([...customBacklogs, ...chapterBacklogs]);
    } catch (e) {
      console.error("Backlog load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBacklogs();
  }, [userId]);

  // Mark custom backlog as completed
  const handleCompleteCustom = async (taskId: string) => {
    // Optimistic UI update
    setBacklogs((prev) => prev.filter((b) => b.id !== taskId));
    await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
  };

  // Add new custom backlog
  const handleAddBacklog = async () => {
    if (!title.trim() || !userId) return;
    setSaving(true);

    try {
      const formattedTitle = `[${subject}] ${title.trim()}`;
      await supabase.from("tasks").insert({
        user_id: userId,
        title: formattedTitle,
        task_type: "backlog",
        priority: priority,
        status: "pending",
        due_date: new Date().toISOString().slice(0, 10),
      });

      setTitle("");
      setShowAddModal(false);
      await fetchBacklogs();
    } catch (err) {
      console.error("Add backlog error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full p-4 bg-white border border-ink/10 rounded-2xl animate-pulse text-xs text-slate">
        Loading backlogs…
      </div>
    );
  }

  return (
    <div className="w-full p-5 bg-white border border-rose-200/80 rounded-2xl shadow-xs flex flex-col gap-3.5">
      {/* Header with Title + "+ Add Backlog" Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {backlogs.length > 0 ? (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
          ) : (
            <span className="text-emerald-600 font-bold text-sm">✓</span>
          )}
          <h3 className="text-sm font-bold text-ink">Backlog Tracker</h3>
          {backlogs.length > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
              {backlogs.length} pending
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Clear
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 active:scale-95 transition-all"
        >
          <span>+</span>
          <span>Add Backlog</span>
        </button>
      </div>

      {/* Backlogs List */}
      {backlogs.length === 0 ? (
        <div className="p-3 bg-emerald-50/60 border border-emerald-200/70 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm">
              ✓
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">Zero Pending Backlogs!</p>
              <p className="text-[10px] text-emerald-700">You are fully on track with lectures and DPPs.</p>
            </div>
          </div>
          <a href="/library" className="text-[10px] font-bold text-emerald-700 hover:underline">
            Syllabus →
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {backlogs.slice(0, 4).map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-paper/60 border border-ink/8 hover:border-ink/20 transition-all"
            >
              <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                {b.type === "custom" ? (
                  <button
                    type="button"
                    onClick={() => handleCompleteCustom(b.id)}
                    title="Mark Done"
                    className="w-5 h-5 rounded-md border border-ink/20 hover:border-teal hover:bg-teal/10 flex items-center justify-center text-transparent hover:text-teal text-xs transition-all flex-shrink-0"
                  >
                    ✓
                  </button>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                )}

                <span className="text-xs font-semibold text-ink truncate">{b.title}</span>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {b.type === "chapter" ? (
                  <a
                    href="/library"
                    className="text-[10px] font-bold text-teal bg-teal/10 px-2 py-0.5 rounded-full hover:bg-teal/20"
                  >
                    Syllabus
                  </a>
                ) : (
                  <span
                    className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                      b.priority === "high"
                        ? "bg-rose-100 text-rose-700"
                        : b.priority === "medium"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {b.priority}
                  </span>
                )}
              </div>
            </div>
          ))}

          {backlogs.length > 4 && (
            <p className="text-[11px] text-slate text-center pt-1 font-medium">
              +{backlogs.length - 4} more backlogs pending
            </p>
          )}
        </div>
      )}

      {/* 🚀 ADD BACKLOG MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-3.5 border border-ink/10">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <div>
                <h4 className="text-base font-black text-ink">Add Custom Backlog</h4>
                <p className="text-[11px] text-slate">Missed lectures, pending DPPs or modules</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate hover:bg-ink/5"
              >
                ✕
              </button>
            </div>

            {/* Backlog Title Input */}
            <div>
              <label className="text-[11px] font-bold text-ink block mb-1">Backlog Details</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Rotational Motion DPP 3 & 4"
                className="w-full text-xs font-semibold p-2.5 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
                autoFocus
              />
            </div>

            {/* Subject Selector */}
            <div>
              <label className="text-[11px] font-bold text-ink block mb-1">Subject</label>
              <div className="grid grid-cols-2 gap-1.5">
                {["Physics", "Chemistry", "Mathematics", "Biology"].map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubject(sub)}
                    className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition-all ${
                      subject === sub
                        ? "border-teal bg-teal/10 text-teal"
                        : "border-ink/12 text-ink hover:border-ink/20"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Selector */}
            <div>
              <label className="text-[11px] font-bold text-ink block mb-1">Priority</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "high", label: "🔴 High" },
                  { id: "medium", label: "🟡 Medium" },
                  { id: "low", label: "🟢 Low" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPriority(item.id as "high" | "medium" | "low")}
                    className={`py-1.5 px-1 rounded-xl border text-[11px] font-bold transition-all ${
                      priority === item.id
                        ? "border-rose-500 bg-rose-50 text-rose-700"
                        : "border-ink/12 text-ink"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={saving || !title.trim()}
              onClick={handleAddBacklog}
              className="w-full py-3 rounded-xl bg-ink text-paper font-bold text-xs shadow-md hover:bg-ink-100 disabled:opacity-40 transition-all mt-1"
            >
              {saving ? "Saving…" : "✓ Save Backlog"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
                    }
