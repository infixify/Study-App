"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/dashboard/BottomNav";

type Scope = "chapter" | "subject" | "full_syllabus";

interface ScheduleRow {
  id: string;
  title: string;
  scope: Scope;
  scheduled_date: string;
  is_done: boolean;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function SchedulePage() {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<Scope>("chapter");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("test_schedule")
      .select("id, title, scope, scheduled_date, is_done")
      .eq("user_id", user.id)
      .order("scheduled_date", { ascending: true });

    setRows((data as ScheduleRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    setError(null);
    if (!title.trim()) return setError("Give it a title.");
    setSaving(true);

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("test_schedule").insert({
      user_id: user.id,
      title: title.trim(),
      scope,
      scheduled_date: date,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setTitle("");
      setDate(todayISO());
      await load();
    }
    setSaving(false);
  }

  async function toggleDone(row: ScheduleRow) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_done: !r.is_done } : r)));
    await supabase.from("test_schedule").update({ is_done: !row.is_done }).eq("id", row.id);
  }

  async function handleDelete(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("test_schedule").delete().eq("id", id);
  }

  const today = todayISO();
  const overdue = rows.filter((r) => !r.is_done && r.scheduled_date < today);
  const upcoming = rows.filter((r) => !r.is_done && r.scheduled_date >= today);
  const done = rows.filter((r) => r.is_done);

  function Row({ r }: { r: ScheduleRow }) {
    return (
      <div className="bg-white rounded-ticket border border-ink/10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => toggleDone(r)}
          className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            r.is_done ? "bg-teal border-teal" : "border-ink/25"
          }`}
        >
          {r.is_done && <span className="text-paper text-[10px]">✓</span>}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${r.is_done ? "line-through text-ink/40" : "text-ink"}`}>
            {r.title}
          </p>
          <p className="text-[11px] text-slate mt-0.5">
            {r.scope === "chapter" ? "Chapter test" : r.scope === "subject" ? "Subject test" : "Full syllabus"} ·{" "}
            {new Date(r.scheduled_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </p>
        </div>
        <button onClick={() => handleDelete(r.id)} className="shrink-0 text-[11px] text-coral">
          Remove
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-ink/60 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-28">
      <div className="max-w-md mx-auto px-5 pt-8">
        <h1 className="font-display text-2xl font-semibold mb-4">Schedule</h1>

        <div className="rounded-ticket border border-ink/10 bg-white p-4 mb-6">
          <input
            type="text"
            placeholder="e.g. Rotational Motion mock test"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-2"
          />
          <div className="grid grid-cols-2 gap-2 mb-3">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              className="rounded-lg border border-ink/15 p-2.5 text-sm"
            >
              <option value="chapter">Chapter</option>
              <option value="subject">Subject</option>
              <option value="full_syllabus">Full syllabus</option>
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-ink/15 p-2.5 text-sm"
            />
          </div>
          {error && <p className="text-xs text-coral mb-2">{error}</p>}
          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full bg-ink text-paper rounded-ticket py-2.5 text-sm font-medium disabled:opacity-40"
          >
            {saving ? "Saving…" : "Schedule test"}
          </button>
        </div>

        {overdue.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-coral mb-2">Overdue</p>
            <div className="flex flex-col gap-2">{overdue.map((r) => <Row key={r.id} r={r} />)}</div>
          </div>
        )}
        <div className="mb-5">
          <p className="text-xs font-semibold text-ink/60 mb-2">Upcoming</p>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate">Nothing scheduled yet.</p>
          ) : (
            <div className="flex flex-col gap-2">{upcoming.map((r) => <Row key={r.id} r={r} />)}</div>
          )}
        </div>
        {done.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink/60 mb-2">Done</p>
            <div className="flex flex-col gap-2">{done.map((r) => <Row key={r.id} r={r} />)}</div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
    }
