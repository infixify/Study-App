"use client";

import { createElement as e, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────
interface SubjectRow { id: string; name: string; class_level: string; target_exam: string; }
interface ChapterRow { id: string; title: string; subject_id: string; }
interface ResourceRow {
  id: string;
  title: string;
  url: string;
  category: string;
  chapter_id: string | null;
  subject_id: string | null;
}

const CATEGORIES = [
  { key: "formula_sheet", label: "Formula Sheet", icon: "🧮" },
  { key: "short_notes",   label: "Short Notes",   icon: "📄" },
  { key: "full_notes",    label: "Full Notes",     icon: "📝" },
  { key: "ncert",         label: "NCERT",          icon: "📘" },
  { key: "pyq",           label: "PYQ",            icon: "🗂️" },
  { key: "mock_test",     label: "Mock Test",      icon: "🎯" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Converts a GitHub /public relative path or full URL → final URL used in DB.
// Rule: if it starts with "/" treat as Cloudflare Pages relative path (free CDN).
//       if it starts with "http" store as-is.
function resolveUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.startsWith("/") || t.startsWith("http")) return t;
  // bare filename → assume /resources/ folder
  return "/resources/" + t;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ResourceUploader() {
  // Data
  const [subjects, setSubjects]   = useState<SubjectRow[]>([]);
  const [chapters, setChapters]   = useState<ChapterRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [loading, setLoading]     = useState(true);

  // Form state
  const [subjectId,  setSubjectId]  = useState("");
  const [chapterId,  setChapterId]  = useState("__subject__"); // "__subject__" = subject-level
  const [category,   setCategory]   = useState("formula_sheet");
  const [title,      setTitle]      = useState("");
  const [path,       setPath]       = useState("");
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Filter state for existing resources list
  const [filterSubject,  setFilterSubject]  = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [deleting,       setDeleting]       = useState<string | null>(null);

  // ── Load all data once ────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: subs } = await supabase
        .from("subjects")
        .select("id, name, class_level, target_exam")
        .order("display_order", { ascending: true });

      const subList: SubjectRow[] = subs ?? [];
      setSubjects(subList);

      if (subList.length > 0) {
        const subIds = subList.map((s) => s.id);
        const { data: chs } = await supabase
          .from("chapters")
          .select("id, title, subject_id")
          .in("subject_id", subIds)
          .order("display_order", { ascending: true });
        setChapters(chs ?? []);
      }

      const { data: res } = await supabase
        .from("resources")
        .select("id, title, url, category, chapter_id, subject_id")
        .order("created_at", { ascending: false });
      setResources(res ?? []);

      setLoading(false);
    }
    load();
  }, []);

  // ── Derived lists ─────────────────────────────────────────────────────────
  const chaptersForSubject = chapters.filter((c) => c.subject_id === subjectId);

  // ── Compute auto-title when subject/chapter/category change ───────────────
  useEffect(() => {
    if (!subjectId) return;
    const sub = subjects.find((s) => s.id === subjectId);
    const ch  = chapters.find((c) => c.id === chapterId);
    const cat = CATEGORIES.find((c) => c.key === category);
    if (!sub || !cat) return;
    const base = ch ? ch.title : sub.name;
    setTitle(`${base} — ${sub.target_exam} ${cat.label}`);
  }, [subjectId, chapterId, category, subjects, chapters]);

  // ── Save resource ─────────────────────────────────────────────────────────
  async function handleSave() {
    if (!subjectId || !path.trim() || !title.trim()) {
      setMsg({ type: "err", text: "Subject, path and title are required." });
      return;
    }
    setSaving(true);
    setMsg(null);

    const url = resolveUrl(path);
    const isSubjectLevel = chapterId === "__subject__";

    const payload = {
      title:        title.trim(),
      url,
      category,
      subject_id:   subjectId,
      chapter_id:   isSubjectLevel ? null : chapterId,
      display_order: 0,
      resource_type: "pdf",
    };

    const { data, error } = await supabase
      .from("resources")
      .insert(payload)
      .select()
      .single();

    if (error) {
      setMsg({ type: "err", text: error.message });
    } else {
      setMsg({ type: "ok", text: `✅ Saved: ${title.trim()}` });
      setResources((prev) => [data as ResourceRow, ...prev]);
      setPath("");
    }
    setSaving(false);
  }

  // ── Delete resource ───────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setDeleting(id);
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (!error) setResources((prev) => prev.filter((r) => r.id !== id));
    setDeleting(null);
  }

  // ── Filtered resources list ───────────────────────────────────────────────
  const subjectIdsByName = subjects
    .filter((s) => (filterSubject ? s.name === filterSubject : true))
    .map((s) => s.id);

  const filteredResources = resources.filter((r) => {
    const subMatch = filterSubject
      ? (r.subject_id && subjectIdsByName.includes(r.subject_id)) ||
        (r.chapter_id && chapters.find((c) => c.id === r.chapter_id && subjectIdsByName.includes(c.subject_id)))
      : true;
    const catMatch = filterCategory ? r.category === filterCategory : true;
    return subMatch && catMatch;
  });

  // ── Unique subject names for filter dropdown ──────────────────────────────
  const uniqueSubjectNames = [...new Set(subjects.map((s) => s.name))];

  if (loading) {
    return e("p", { className: "text-sm text-slate py-8 text-center" }, "Loading…");
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return e(
    "div",
    { className: "flex flex-col gap-6" },

    // ── ADD RESOURCE FORM ────────────────────────────────────────────────────
    e(
      "div",
      { className: "bg-white rounded-2xl border border-ink/10 p-4 flex flex-col gap-4" },
      e("h3", { className: "font-bold text-ink text-sm" }, "➕ Add Resource (GitHub Path)"),

      // Subject selector
      e(
        "div",
        null,
        e("label", { className: "text-[10px] font-bold text-slate block mb-1" }, "Subject"),
        e(
          "select",
          {
            value: subjectId,
            onChange: (ev: any) => { setSubjectId(ev.target.value); setChapterId("__subject__"); },
            className: "w-full text-sm border border-ink/15 rounded-xl px-3 py-2.5 bg-paper text-ink",
          },
          e("option", { value: "" }, "— Select subject —"),
          [...new Set(subjects.map((s) => s.name))].map((name) =>
            e("option", { key: name, value: subjects.find((s) => s.name === name)!.id }, name)
          )
        )
      ),

      // Chapter selector (optional — skip for subject-level resources)
      subjectId
        ? e(
            "div",
            null,
            e("label", { className: "text-[10px] font-bold text-slate block mb-1" }, "Chapter (optional — skip for full subject)"),
            e(
              "select",
              {
                value: chapterId,
                onChange: (ev: any) => setChapterId(ev.target.value),
                className: "w-full text-sm border border-ink/15 rounded-xl px-3 py-2.5 bg-paper text-ink",
              },
              e("option", { value: "__subject__" }, "📚 Full subject (no chapter)"),
              chaptersForSubject.map((c) =>
                e("option", { key: c.id, value: c.id }, c.title)
              )
            )
          )
        : null,

      // Category
      e(
        "div",
        null,
        e("label", { className: "text-[10px] font-bold text-slate block mb-1" }, "Type"),
        e(
          "div",
          { className: "grid grid-cols-3 gap-1.5" },
          CATEGORIES.map((cat) =>
            e(
              "button",
              {
                key: cat.key,
                type: "button",
                onClick: () => setCategory(cat.key),
                className: `text-xs py-2 rounded-xl border font-semibold transition-all ${
                  category === cat.key
                    ? "bg-teal text-white border-teal"
                    : "bg-white text-slate border-ink/15"
                }`,
              },
              cat.icon + " " + cat.label
            )
          )
        )
      ),

      // GitHub path input
      e(
        "div",
        null,
        e("label", { className: "text-[10px] font-bold text-slate block mb-1" }, "GitHub Path (from /public/)"),
        e("input", {
          type: "text",
          value: path,
          onChange: (ev: any) => setPath(ev.target.value),
          placeholder: "/Qformulas/physics-motion.pdf",
          className: "w-full text-sm border border-ink/15 rounded-xl px-3 py-2.5 bg-paper text-ink font-mono",
        }),
        e(
          "p",
          { className: "text-[10px] text-slate mt-1" },
          "Put file in your GitHub repo under /public/ → path yahan daalo. e.g. /Qformulas/physics-motion.pdf"
        )
      ),

      // Title (auto-filled, editable)
      e(
        "div",
        null,
        e("label", { className: "text-[10px] font-bold text-slate block mb-1" }, "Title (auto-filled, edit if needed)"),
        e("input", {
          type: "text",
          value: title,
          onChange: (ev: any) => setTitle(ev.target.value),
          placeholder: "Motion in a Straight Line — JEE Formula Sheet",
          className: "w-full text-sm border border-ink/15 rounded-xl px-3 py-2.5 bg-paper text-ink",
        })
      ),

      // Save button
      e(
        "button",
        {
          type: "button",
          disabled: saving || !subjectId || !path.trim(),
          onClick: handleSave,
          className:
            "w-full py-3 rounded-xl bg-teal text-white font-bold text-sm disabled:opacity-50 transition-all",
        },
        saving ? "Saving…" : "💾 Save Resource"
      ),

      // Feedback
      msg
        ? e(
            "p",
            {
              className: `text-xs px-3 py-2 rounded-lg ${
                msg.type === "ok"
                  ? "bg-teal/10 text-teal border border-teal/20"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`,
            },
            msg.text
          )
        : null
    ),

    // ── EXISTING RESOURCES LIST ──────────────────────────────────────────────
    e(
      "div",
      { className: "bg-white rounded-2xl border border-ink/10 p-4 flex flex-col gap-3" },
      e("h3", { className: "font-bold text-ink text-sm" }, `📋 Existing Resources (${resources.length})`),

      // Filters
      e(
        "div",
        { className: "flex gap-2" },
        e(
          "select",
          {
            value: filterSubject,
            onChange: (ev: any) => setFilterSubject(ev.target.value),
            className: "flex-1 text-xs border border-ink/15 rounded-xl px-2 py-2 bg-paper text-ink",
          },
          e("option", { value: "" }, "All subjects"),
          uniqueSubjectNames.map((name) =>
            e("option", { key: name, value: name }, name)
          )
        ),
        e(
          "select",
          {
            value: filterCategory,
            onChange: (ev: any) => setFilterCategory(ev.target.value),
            className: "flex-1 text-xs border border-ink/15 rounded-xl px-2 py-2 bg-paper text-ink",
          },
          e("option", { value: "" }, "All types"),
          CATEGORIES.map((c) => e("option", { key: c.key, value: c.key }, c.icon + " " + c.label))
        )
      ),

      // List
      filteredResources.length === 0
        ? e("p", { className: "text-xs text-slate text-center py-4" }, "No resources found.")
        : e(
            "div",
            { className: "flex flex-col gap-2 max-h-96 overflow-y-auto" },
            filteredResources.map((r) => {
              const cat = CATEGORIES.find((c) => c.key === r.category);
              const ch  = chapters.find((c) => c.id === r.chapter_id);
              const sub = subjects.find((s) => s.id === r.subject_id);
              return e(
                "div",
                {
                  key: r.id,
                  className: "flex items-start gap-2 bg-paper rounded-xl border border-ink/5 p-3",
                },
                // Info
                e(
                  "div",
                  { className: "flex-1 min-w-0" },
                  e(
                    "div",
                    { className: "flex items-center gap-1.5 flex-wrap mb-0.5" },
                    e(
                      "span",
                      { className: "text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal/10 text-teal" },
                      cat?.icon + " " + (cat?.label ?? r.category)
                    ),
                    sub
                      ? e(
                          "span",
                          { className: "text-[10px] text-slate" },
                          sub.name + (ch ? " › " + ch.title : "")
                        )
                      : null
                  ),
                  e("p", { className: "text-xs font-medium text-ink truncate" }, r.title),
                  e(
                    "p",
                    { className: "text-[10px] text-slate font-mono mt-0.5 truncate" },
                    r.url
                  )
                ),
                // Delete
                e(
                  "button",
                  {
                    type: "button",
                    disabled: deleting === r.id,
                    onClick: () => handleDelete(r.id),
                    className:
                      "shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-400 border border-red-100 text-xs hover:bg-red-100 disabled:opacity-40 transition-all",
                  },
                  deleting === r.id ? "…" : "✕"
                )
              );
            })
          )
    )
  );
}
