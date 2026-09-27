// app/admin/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type ExamScheduleRow = {
  id: string;
  exam_key: string;
  label: string;
  target_exam: string;
  year: number;
  exam_date: string;
  is_confirmed: boolean;
  notes: string | null;
};

type ExamShiftRow = {
  id: string;
  exam_schedule_id: string;
  shift_date: string;
  shift_time: string;
  display_order: number;
};

type Stats = {
  totalUsers: number;
  jeeUsers: number;
  neetUsers: number;
  boardsOnly: number;
};

type SubjectRow = { id: string; name: string; class_level: string; target_exam: string };
type ChapterRow = { id: string; title: string; subject_id: string };

type ResourceRow = {
  id: string;
  title: string;
  url: string;
  category: string;
  resource_type: string;
  chapter_title: string;
};

const RESOURCE_CATEGORIES = [
  { key: "full_notes", label: "Notes" },
  { key: "short_notes", label: "Short Notes" },
  { key: "formula_sheet", label: "Formula Sheet" },
  { key: "pyq", label: "PYQ" },
  { key: "mock_test", label: "Mock Test" },
];

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- auth form state ---
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // --- admin data state ---
  const [stats, setStats] = useState<Stats | null>(null);
  const [schedule, setSchedule] = useState<ExamScheduleRow[]>([]);
  const [editedDates, setEditedDates] = useState<Record<string, { exam_date: string; is_confirmed: boolean }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const [shifts, setShifts] = useState<ExamShiftRow[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [newShiftDate, setNewShiftDate] = useState("");
  const [newShiftTime, setNewShiftTime] = useState("");
  const [addingShift, setAddingShift] = useState(false);

  // --- resources upload state ---
  const [allSubjects, setAllSubjects] = useState<SubjectRow[]>([]);
  const [resChapters, setResChapters] = useState<ChapterRow[]>([]);
  const [resCategory, setResCategory] = useState(RESOURCE_CATEGORIES[0].key);
  const [resSubjectId, setResSubjectId] = useState("");
  const [resChapterId, setResChapterId] = useState("");
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [resType, setResType] = useState<"pdf" | "micro_video">("pdf");
  const [resSaving, setResSaving] = useState(false);
  const [resError, setResError] = useState<string | null>(null);
  const [recentResources, setRecentResources] = useState<ResourceRow[]>([]);

  const checkAccess = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        setSession(false);
        setIsAdmin(false);
        setChecking(false);
        return;
      }
      setSession(true);

      const { data: adminCheck, error: rpcError } = await supabase.rpc("is_admin");
      if (rpcError) {
        setAuthError("Admin check failed: " + rpcError.message);
      } else if (adminCheck) {
        setIsAdmin(true);
        await loadAdminData();
        await loadResourceContext();
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Could not verify admin access.");
    }
    setChecking(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAuthSubmit() {
    setAuthError(null);
    setAuthNotice(null);
    setAuthBusy(true);

    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setAuthError(error.message);
        } else {
          setAuthNotice(
            "Registered. If email confirmation is on for this project, check your inbox and confirm before logging in — otherwise you're already signed in."
          );
          await checkAccess();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setAuthError(error.message);
        } else {
          await checkAccess();
        }
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }

    setAuthBusy(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(false);
    setIsAdmin(false);
  }

  const loadAdminData = useCallback(async () => {
    const [{ count: totalUsers }, { count: jeeUsers }, { count: neetUsers }, { count: boardsOnly }] =
      await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }),
        supabase.from("users").select("*", { count: "exact", head: true }).eq("target_exam", "JEE"),
        supabase.from("users").select("*", { count: "exact", head: true }).eq("target_exam", "NEET"),
        supabase.from("users").select("*", { count: "exact", head: true }).eq("target_exam", "Boards"),
      ]);

    setStats({
      totalUsers: totalUsers ?? 0,
      jeeUsers: jeeUsers ?? 0,
      neetUsers: neetUsers ?? 0,
      boardsOnly: boardsOnly ?? 0,
    });

    const { data: scheduleRows } = await supabase
      .from("exam_schedule")
      .select("id, exam_key, label, target_exam, year, exam_date, is_confirmed, notes")
      .order("year", { ascending: true })
      .order("display_order", { ascending: true });

    const rows = (scheduleRows as ExamScheduleRow[] | null) ?? [];
    setSchedule(rows);

    const initialEdits: Record<string, { exam_date: string; is_confirmed: boolean }> = {};
    rows.forEach((r) => {
      initialEdits[r.id] = { exam_date: r.exam_date, is_confirmed: r.is_confirmed };
    });
    setEditedDates(initialEdits);

    setSelectedScheduleId((prev) => prev || (rows[0]?.id ?? ""));
  }, []);

  const loadShifts = useCallback(async (scheduleId: string) => {
    if (!scheduleId) {
      setShifts([]);
      return;
    }
    const { data } = await supabase
      .from("exam_shifts")
      .select("id, exam_schedule_id, shift_date, shift_time, display_order")
      .eq("exam_schedule_id", scheduleId)
      .order("display_order", { ascending: true });
    setShifts((data as ExamShiftRow[] | null) ?? []);
  }, []);

  useEffect(() => {
    if (selectedScheduleId) loadShifts(selectedScheduleId);
  }, [selectedScheduleId, loadShifts]);

  async function saveScheduleRow(row: ExamScheduleRow) {
    const edit = editedDates[row.id];
    if (!edit) return;
    setSavingId(row.id);
    await supabase
      .from("exam_schedule")
      .update({ exam_date: edit.exam_date, is_confirmed: edit.is_confirmed })
      .eq("id", row.id);
    await loadAdminData();
    setSavingId(null);
  }

  async function addShift() {
    if (!selectedScheduleId || !newShiftDate || !newShiftTime) return;
    setAddingShift(true);
    await supabase.from("exam_shifts").insert({
      exam_schedule_id: selectedScheduleId,
      shift_date: newShiftDate,
      shift_time: newShiftTime,
      display_order: shifts.length + 1,
    });
    setNewShiftDate("");
    setNewShiftTime("");
    await loadShifts(selectedScheduleId);
    setAddingShift(false);
  }

  async function deleteShift(id: string) {
    await supabase.from("exam_shifts").delete().eq("id", id);
    await loadShifts(selectedScheduleId);
  }

  // ---------------- Resources upload logic ----------------

  const loadResourceContext = useCallback(async () => {
    const { data: subjectRows } = await supabase
      .from("subjects")
      .select("id, name, class_level, target_exam")
      .order("class_level", { ascending: true })
      .order("name", { ascending: true });

    setAllSubjects((subjectRows as SubjectRow[] | null) ?? []);
    await loadRecentResources();
  }, []);

  async function loadRecentResources() {
    const { data } = await supabase
      .from("resources")
      .select("id, title, url, category, resource_type, chapter_id, chapters(title)")
      .neq("category", "ncert")
      .order("created_at", { ascending: false })
      .limit(20);

    const mapped: ResourceRow[] = (data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      category: r.category,
      resource_type: r.resource_type,
      chapter_title: r.chapters?.title ?? "—",
    }));
    setRecentResources(mapped);
  }

  useEffect(() => {
    async function loadResChapters() {
      if (!resSubjectId) {
        setResChapters([]);
        return;
      }
      const { data } = await supabase
        .from("chapters")
        .select("id, title, subject_id")
        .eq("subject_id", resSubjectId)
        .order("display_order", { ascending: true });
      setResChapters((data as ChapterRow[] | null) ?? []);
    }
    loadResChapters();
  }, [resSubjectId]);

  async function handleResourceSave() {
    setResError(null);

    if (!resSubjectId) return setResError("Pick a subject.");
    if (!resChapterId) return setResError("Pick a chapter.");
    if (!resTitle.trim()) return setResError("Give the resource a title.");
    if (!resUrl.trim()) return setResError("Paste the resource URL.");

    setResSaving(true);
    const { error: insertError } = await supabase.from("resources").insert({
      chapter_id: resChapterId,
      category: resCategory,
      resource_type: resType,
      title: resTitle.trim(),
      url: resUrl.trim(),
    });

    if (insertError) {
      setResError(insertError.message);
    } else {
      setResTitle("");
      setResUrl("");
      await loadRecentResources();
    }
    setResSaving(false);
  }

  async function deleteResource(id: string) {
    await supabase.from("resources").delete().eq("id", id);
    await loadRecentResources();
  }

  // ---------------- Render states ----------------

  if (checking) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-ink/60 text-sm">Checking access…</p>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-semibold mb-1">Admin Panel</h1>
          <p className="text-slate text-sm mb-6">
            {session && !isAdmin
              ? "You're signed in, but this account isn't the admin account."
              : mode === "register"
              ? "Create the admin login (first time only)."
              : "Sign in to continue."}
          </p>

          {session && !isAdmin && (
            <button
              onClick={handleSignOut}
              className="w-full mb-4 border border-ink/15 rounded-ticket py-3 text-sm font-medium"
            >
              Sign out this account
            </button>
          )}

          {(!session || (session && !isAdmin)) && (
            <div className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-ticket border border-ink/15 bg-white p-3 text-sm"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-ticket border border-ink/15 bg-white p-3 text-sm"
              />

              {authError && <p className="text-xs text-coral">{authError}</p>}
              {authNotice && <p className="text-xs text-teal">{authNotice}</p>}

              <button
                onClick={handleAuthSubmit}
                disabled={authBusy || !email || !password}
                className="bg-ink text-paper rounded-ticket py-3 text-sm font-medium disabled:opacity-30"
              >
                {authBusy ? "Please wait…" : mode === "register" ? "Register" : "Log in"}
              </button>

              <button
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setAuthError(null);
                  setAuthNotice(null);
                }}
                className="text-xs text-slate"
              >
                {mode === "login"
                  ? "First time here? Register instead"
                  : "Already registered? Log in instead"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-16">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display text-2xl font-semibold">Admin Panel</h1>
          <button onClick={handleSignOut} className="text-xs text-slate">
            Sign out
          </button>
        </div>
        <p className="text-slate text-sm mb-6">Exam dates, shifts, resources, and basic user stats.</p>

        {stats && (
          <div className="grid grid-cols-2 gap-3 mb-8">
            <StatCard label="Total users" value={stats.totalUsers} />
            <StatCard label="JEE aspirants" value={stats.jeeUsers} />
            <StatCard label="NEET aspirants" value={stats.neetUsers} />
            <StatCard label="Boards only" value={stats.boardsOnly} />
          </div>
        )}

        <section className="mb-8">
          <h2 className="font-display text-lg font-semibold mb-3">Exam Schedule</h2>
          <div className="flex flex-col gap-3">
            {schedule.map((row) => {
              const edit = editedDates[row.id] ?? { exam_date: row.exam_date, is_confirmed: row.is_confirmed };
              const dirty =
                edit.exam_date !== row.exam_date || edit.is_confirmed !== row.is_confirmed;
              return (
                <div key={row.id} className="rounded-ticket border border-ink/10 bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">
                      {row.label} <span className="text-slate text-xs">({row.year})</span>
                    </p>
                    <span className="text-xs text-slate">{row.exam_key}</span>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <input
                      type="date"
                      value={edit.exam_date}
                      onChange={(e) =>
                        setEditedDates((prev) => ({
                          ...prev,
                          [row.id]: { ...edit, exam_date: e.target.value },
                        }))
                      }
                      className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
                    />

                    <label className="flex items-center gap-1.5 text-xs text-slate">
                      <input
                        type="checkbox"
                        checked={edit.is_confirmed}
                        onChange={(e) =>
                          setEditedDates((prev) => ({
                            ...prev,
                            [row.id]: { ...edit, is_confirmed: e.target.checked },
                          }))
                        }
                        className="accent-marigold"
                      />
                      Officially confirmed
                    </label>

                    <button
                      onClick={() => saveScheduleRow(row)}
                      disabled={!dirty || savingId === row.id}
                      className="ml-auto bg-ink text-paper rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-30"
                    >
                      {savingId === row.id ? "Saving…" : "Save"}
                    </button>
                  </div>

                  {row.notes && <p className="text-xs text-slate mt-2">{row.notes}</p>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-lg font-semibold mb-3">Exam Shifts</h2>
          <p className="text-xs text-slate mb-3">
            Add specific dates/shifts once NTA releases them — this is what turns on the shift
            picker for students on the dashboard.
          </p>

          <select
            value={selectedScheduleId}
            onChange={(e) => setSelectedScheduleId(e.target.value)}
            className="w-full rounded-ticket border border-ink/15 bg-white p-3 text-sm mb-3"
          >
            {schedule.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label} ({row.year})
              </option>
            ))}
          </select>

          <div className="rounded-ticket border border-ink/10 bg-white p-4">
            <div className="flex flex-col gap-2 mb-4">
              {shifts.length === 0 && (
                <p className="text-xs text-slate">No shifts added yet for this session.</p>
              )}
              {shifts.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span>
                    {new Date(s.shift_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    — {s.shift_time}
                  </span>
                  <button onClick={() => deleteShift(s.id)} className="text-xs text-coral">
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-ink/8">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newShiftDate}
                  onChange={(e) => setNewShiftDate(e.target.value)}
                  className="flex-1 rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  placeholder="e.g. Morning (9 AM–12 PM)"
                  value={newShiftTime}
                  onChange={(e) => setNewShiftTime(e.target.value)}
                  className="flex-[2] rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
                />
              </div>
              <button
                onClick={addShift}
                disabled={!newShiftDate || !newShiftTime || addingShift}
                className="bg-marigold text-ink rounded-full py-2 text-sm font-medium disabled:opacity-30"
              >
                {addingShift ? "Adding…" : "Add shift"}
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold mb-3">Resources</h2>
          <p className="text-xs text-slate mb-3">
            Upload Notes, Short Notes, Formula Sheets, PYQs, and Mock Tests here (NCERT links are
            already seeded and don't need this — this is only for the 5 other categories).
          </p>

          <div className="rounded-ticket border border-ink/10 bg-white p-4 mb-4">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                value={resCategory}
                onChange={(e) => setResCategory(e.target.value)}
                className="rounded-lg border border-ink/15 p-2.5 text-sm"
              >
                {RESOURCE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>

              <select
                value={resType}
                onChange={(e) => setResType(e.target.value as "pdf" | "micro_video")}
                className="rounded-lg border border-ink/15 p-2.5 text-sm"
              >
                <option value="pdf">PDF</option>
                <option value="micro_video">Micro video</option>
              </select>
            </div>

            <select
              value={resSubjectId}
              onChange={(e) => {
                setResSubjectId(e.target.value);
                setResChapterId("");
              }}
              className="w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-2"
            >
              <option value="">Select subject…</option>
              {allSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — Class {s.class_level} ({s.target_exam})
                </option>
              ))}
            </select>

            {resSubjectId && (
              <select
                value={resChapterId}
                onChange={(e) => setResChapterId(e.target.value)}
                className="w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-2"
              >
                <option value="">Select chapter…</option>
                {resChapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}

            <input
              type="text"
              placeholder="Resource title (e.g. Allen Kinematics Notes)"
              value={resTitle}
              onChange={(e) => setResTitle(e.target.value)}
              className="w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-2"
            />

            <input
              type="text"
              placeholder="URL (Google Drive link, etc.)"
              value={resUrl}
              onChange={(e) => setResUrl(e.target.value)}
              className="w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-3"
            />

            {resError && <p className="text-xs text-coral mb-2">{resError}</p>}

            <button
              onClick={handleResourceSave}
              disabled={resSaving}
              className="w-full bg-ink text-paper rounded-ticket py-3 text-sm font-medium disabled:opacity-40"
            >
              {resSaving ? "Saving…" : "Add resource"}
            </button>
          </div>

          <p className="text-sm font-medium mb-2">Recently added</p>
          {recentResources.length === 0 && (
            <p className="text-sm text-slate">Nothing uploaded yet.</p>
          )}
          <div className="flex flex-col gap-2">
            {recentResources.map((r) => (
              <div
                key={r.id}
                className="rounded-ticket border border-ink/10 bg-white p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-slate mt-0.5">
                    {r.chapter_title} · {r.category} · {r.resource_type}
                  </p>
                </div>
                <button onClick={() => deleteResource(r.id)} className="text-xs text-coral">
                  Remove
                  </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-ticket border border-ink/10 bg-white p-4">
      <p className="font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-slate mt-0.5">{label}</p>
    </div>
  );
}
