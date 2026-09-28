"use client";

import { createElement as e, useCallback, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";

const BUCKET = "resources";
const MAX_BYTES = 50 * 1024 * 1024;

const CATEGORIES: { key: string; label: string }[] = [
  { key: "full_notes", label: "Notes" },
  { key: "short_notes", label: "Short Notes" },
  { key: "formula_sheet", label: "Formula Sheet" },
  { key: "pyq", label: "PYQ" },
  { key: "mock_test", label: "Mock Test" },
];

interface SubjectRow {
  id: string;
  name: string;
  class_level: string;
  target_exam: string;
}

interface ChapterRow {
  id: string;
  title: string;
}

interface RecentRow {
  id: string;
  title: string;
  url: string;
  category: string;
  resource_type: string;
  placeLabel: string;
}

const FIELD = "w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-2";

export default function ResourceUploader() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);

  const [scope, setScope] = useState<"chapter" | "subject">("chapter");
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const [resType, setResType] = useState<"pdf" | "micro_video">("pdf");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [allExams, setAllExams] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRecent = useCallback(async (subjectList: SubjectRow[]) => {
    const { data } = await supabase
      .from("resources")
      .select("id, title, url, category, resource_type, subject_id, chapters(title, subject_id)")
      .neq("category", "ncert")
      .order("created_at", { ascending: false })
      .limit(20);

    const byId = new Map<string, SubjectRow>();
    subjectList.forEach((s) => byId.set(s.id, s));

    const rows: RecentRow[] = ((data ?? []) as any[]).map((r) => {
      const subjId: string | null = r.chapters?.subject_id ?? r.subject_id ?? null;
      const subj = subjId ? byId.get(subjId) : undefined;
      const place =
        (r.chapters?.title ?? "Whole subject") +
        (subj ? " · " + subj.name + " · Class " + subj.class_level + " · " + subj.target_exam : "");
      return {
        id: r.id,
        title: r.title,
        url: r.url,
        category: r.category,
        resource_type: r.resource_type,
        placeLabel: place,
      };
    });
    setRecent(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { data } = await supabase
        .from("subjects")
        .select("id, name, class_level, target_exam")
        .order("class_level", { ascending: true })
        .order("name", { ascending: true });
      const list = (data ?? []) as SubjectRow[];
      if (!cancelled) {
        setSubjects(list);
        await loadRecent(list);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [loadRecent]);

  useEffect(() => {
    async function loadChapters() {
      if (!subjectId) {
        setChapters([]);
        return;
      }
      const { data } = await supabase
        .from("chapters")
        .select("id, title")
        .eq("subject_id", subjectId)
        .order("display_order", { ascending: true });
      setChapters((data ?? []) as ChapterRow[]);
    }
    loadChapters();
  }, [subjectId]);

  async function handleSave() {
    setError(null);
    setNotice(null);

    const selected = subjects.find((s) => s.id === subjectId);
    if (!selected) return setError("Pick a subject.");
    if (scope === "chapter" && !chapterId) return setError("Pick a chapter.");
    if (!title.trim()) return setError("Give the resource a title.");
    if (!file) return setError("Choose a file to upload.");
    if (file.size > MAX_BYTES) return setError("File is over 50 MB. Compress it or split it.");

    setSaving(true);

    const siblings = allExams
      ? subjects.filter((s) => s.name === selected.name && s.class_level === selected.class_level)
      : [selected];
    const siblingIds = siblings.map((s) => s.id);

    let targetChapterIds: string[] = [];
    if (scope === "chapter") {
      const chosen = chapters.find((c) => c.id === chapterId);
      targetChapterIds = [chapterId];
      if (allExams && chosen) {
        const { data: sib } = await supabase
          .from("chapters")
          .select("id")
          .in("subject_id", siblingIds)
          .eq("title", chosen.title);
        const found = ((sib ?? []) as { id: string }[]).map((c) => c.id);
        if (found.length > 0) targetChapterIds = found;
      }
    }

    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const path = category + "/" + Date.now() + "/" + safeName;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });

    if (uploadError) {
      setError("Upload failed: " + uploadError.message);
      setSaving(false);
      return;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    const rows =
      scope === "chapter"
        ? targetChapterIds.map((id) => ({
            chapter_id: id,
            subject_id: null,
            category: category,
            resource_type: resType,
            title: title.trim(),
            url: publicUrl,
          }))
        : siblingIds.map((id) => ({
            chapter_id: null,
            subject_id: id,
            category: category,
            resource_type: resType,
            title: title.trim(),
            url: publicUrl,
          }));

    const { error: insertError } = await supabase.from("resources").insert(rows);

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([path]);
      setError(insertError.message);
    } else {
      setNotice("Uploaded. Added for " + rows.length + " exam variant(s).");
      setTitle("");
      setFile(null);
      setFileKey((k) => k + 1);
      await loadRecent(subjects);
    }
    setSaving(false);
  }

  async function handleDelete(r: RecentRow) {
    await supabase.from("resources").delete().eq("id", r.id);

    const { count } = await supabase
      .from("resources")
      .select("id", { count: "exact", head: true })
      .eq("url", r.url);

    if (count === 0) {
      const marker = "/storage/v1/object/public/" + BUCKET + "/";
      const idx = r.url.indexOf(marker);
      if (idx !== -1) {
        const path = decodeURIComponent(r.url.slice(idx + marker.length));
        await supabase.storage.from(BUCKET).remove([path]);
      }
    }
    await loadRecent(subjects);
  }

  function scopeButton(value: "chapter" | "subject", label: string) {
    return e(
      "button",
      {
        key: value,
        onClick: () => {
          setScope(value);
          setChapterId("");
        },
        className:
          "flex-1 text-xs rounded-full py-2 font-medium border " +
          (scope === value ? "bg-marigold/15 border-marigold text-ink" : "border-ink/12 text-slate"),
      },
      label
    );
  }

  const form = e(
    "div",
    { className: "rounded-ticket border border-ink/10 bg-white p-4 mb-4" },
    e(
      "div",
      { className: "flex gap-2 mb-3" },
      scopeButton("chapter", "This chapter"),
      scopeButton("subject", "Whole subject (combined bundle)")
    ),
    e(
      "div",
      { className: "grid grid-cols-2 gap-2 mb-2" },
      e(
        "select",
        {
          value: category,
          onChange: (ev: ChangeEvent<HTMLSelectElement>) => setCategory(ev.target.value),
          className: "rounded-lg border border-ink/15 p-2.5 text-sm",
        },
        CATEGORIES.map((c) => e("option", { key: c.key, value: c.key }, c.label))
      ),
      e(
        "select",
        {
          value: resType,
          onChange: (ev: ChangeEvent<HTMLSelectElement>) =>
            setResType(ev.target.value as "pdf" | "micro_video"),
          className: "rounded-lg border border-ink/15 p-2.5 text-sm",
        },
        e("option", { value: "pdf" }, "PDF"),
        e("option", { value: "micro_video" }, "Video")
      )
    ),
    e(
      "select",
      {
        value: subjectId,
        onChange: (ev: ChangeEvent<HTMLSelectElement>) => {
          setSubjectId(ev.target.value);
          setChapterId("");
        },
        className: FIELD,
      },
      e("option", { value: "" }, "Select subject…"),
      subjects.map((s) =>
        e(
          "option",
          { key: s.id, value: s.id },
          s.name + " — Class " + s.class_level + " (" + s.target_exam + ")"
        )
      )
    ),
    scope === "chapter" && subjectId
      ? e(
          "select",
          {
            value: chapterId,
            onChange: (ev: ChangeEvent<HTMLSelectElement>) => setChapterId(ev.target.value),
            className: FIELD,
          },
          e("option", { value: "" }, "Select chapter…"),
          chapters.map((c) => e("option", { key: c.id, value: c.id }, c.title))
        )
      : null,
    e("input", {
      type: "text",
      placeholder: "Resource title (e.g. Kinematics Notes)",
      value: title,
      onChange: (ev: ChangeEvent<HTMLInputElement>) => setTitle(ev.target.value),
      className: FIELD,
    }),
    e("input", {
      key: fileKey,
      type: "file",
      accept: resType === "pdf" ? "application/pdf" : "video/*",
      onChange: (ev: ChangeEvent<HTMLInputElement>) => setFile(ev.target.files?.[0] ?? null),
      className: "w-full text-sm mb-3",
    }),
    e(
      "label",
      { className: "flex items-center gap-2 text-xs text-slate mb-3" },
      e("input", {
        type: "checkbox",
        checked: allExams,
        onChange: (ev: ChangeEvent<HTMLInputElement>) => setAllExams(ev.target.checked),
        className: "accent-marigold",
      }),
      "Also add for this subject in other exams (JEE / NEET / Boards)"
    ),
    error ? e("p", { className: "text-xs text-coral mb-2" }, error) : null,
    notice ? e("p", { className: "text-xs text-teal mb-2" }, notice) : null,
    e(
      "button",
      {
        onClick: handleSave,
        disabled: saving,
        className: "w-full bg-ink text-paper rounded-ticket py-3 text-sm font-medium disabled:opacity-40",
      },
      saving ? "Uploading…" : "Upload"
    )
  );

  return e(
    "div",
    null,
    form,
    e("p", { className: "text-sm font-medium mb-2" }, "Recently added"),
    recent.length === 0 ? e("p", { className: "text-sm text-slate" }, "Nothing uploaded yet.") : null,
    e(
      "div",
      { className: "flex flex-col gap-2" },
      recent.map((r) =>
        e(
          "div",
          {
            key: r.id,
            className:
              "rounded-ticket border border-ink/10 bg-white p-3 flex items-center justify-between gap-3",
          },
          e(
            "div",
            { className: "min-w-0" },
            e("p", { className: "text-sm font-medium truncate" }, r.title),
            e("p", { className: "text-xs text-slate mt-0.5" }, r.placeLabel + " · " + r.category)
          ),
          e(
            "div",
            { className: "flex items-center gap-3 shrink-0" },
            e(
              "a",
              {
                href: r.url,
                target: "_blank",
                rel: "noopener noreferrer",
                className: "text-xs text-teal",
              },
              "Open"
            ),
            e("button", { onClick: () => handleDelete(r), className: "text-xs text-coral" }, "Remove")
          )
        )
      )
    )
  );
        }
