"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/dashboard/BottomNav";

type TaskPriority = "high" | "medium" | "low";
type TaskStatus = "pending" | "completed";

interface Task {
  id: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const PRIORITY_BADGES: Record<TaskPriority, { label: string; style: string; dot: string }> = {
  high: { label: "High", style: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  medium: { label: "Medium", style: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  low: { label: "Low", style: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
};

export default function TodoPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [showCompleted, setShowCompleted] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newDueDate, setNewDueDate] = useState(todayISO());
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
      .from("tasks")
      .select("id, title, priority, status, due_date")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true });

    setTasks((data as Task[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    setError(null);
    if (!newTitle.trim()) {
      setError("Please write what you need to do.");
      return;
    }

    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("tasks").insert({
      user_id: user.id,
      title: newTitle.trim(),
      priority: newPriority,
      due_date: newDueDate,
      status: "pending",
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setNewTitle("");
      setNewPriority("medium");
      setNewDueDate(todayISO());
      await load();
    }
    setSaving(false);
  }

  async function toggleStatus(task: Task) {
    const nextStatus: TaskStatus = task.status === "completed" ? "pending" : "completed";

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );

    await supabase
      .from("tasks")
      .update({
        status: nextStatus,
        completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
  }

  async function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  }

  // Priority sort order: High (0) -> Medium (1) -> Low (2)
  const priorityWeights: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

  const filtered = tasks
    .filter((t) => {
      if (!showCompleted && t.status === "completed") return false;
      if (priorityFilter === "all") return true;
      return (t.priority ?? "medium") === priorityFilter;
    })
    .sort((a, b) => {
      const pA = priorityWeights[a.priority ?? "medium"];
      const pB = priorityWeights[b.priority ?? "medium"];
      return pA - pB;
    });

  const overdue = filtered.filter(
    (t) => t.status === "pending" && t.due_date < todayISO()
  );
  const today = filtered.filter((t) => t.due_date === todayISO());
  const upcoming = filtered.filter(
    (t) => t.due_date > todayISO() || (t.status === "completed" && t.due_date !== todayISO())
  );

  function TaskRow({ task }: { task: Task }) {
    const p = PRIORITY_BADGES[task.priority ?? "medium"];
    return (
      <div className="bg-white rounded-ticket border border-ink/10 px-4 py-3 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => toggleStatus(task)}
            className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
              task.status === "completed" ? "bg-teal border-teal" : "border-ink/25 hover:border-teal"
            }`}
          >
            {task.status === "completed" && (
              <span className="text-paper text-[10px] font-bold">✓</span>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-medium truncate ${
                task.status === "completed" ? "line-through text-ink/40" : "text-ink"
              }`}
            >
              {task.title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${p.style}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                {p.label}
              </span>
              <span className="text-[11px] text-slate">
                {new Date(task.due_date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => handleDelete(task.id)}
          className="shrink-0 text-xs text-rose-500 hover:text-rose-700 px-2 py-1 rounded"
        >
          ✕
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-ink/60 text-sm">Loading your tasks…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-28">
      <div className="max-w-md mx-auto px-5 pt-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-2xl font-bold text-ink">Daily Tasks</h1>
          <span className="text-xs text-slate font-medium">Prioritized To-Do</span>
        </div>

        {/* Add Task Box */}
        <div className="rounded-ticket border border-ink/10 bg-white p-4 mb-5 shadow-xs">
          <input
            type="text"
            placeholder="e.g. Solve 30 Qs in Optics, Revise Chemical Bonding"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full rounded-xl border border-ink/15 p-3 text-sm mb-2.5 focus:outline-none focus:border-teal"
          />
          <div className="grid grid-cols-2 gap-2 mb-3">
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
              className="rounded-xl border border-ink/15 p-2.5 text-xs font-semibold bg-white"
            >
              <option value="high">🔴 High Priority</option>
              <option value="medium">🟡 Medium Priority</option>
              <option value="low">🟢 Low Priority</option>
            </select>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="rounded-xl border border-ink/15 p-2.5 text-xs font-medium bg-white"
            />
          </div>
          {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}
          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full bg-ink text-paper rounded-xl py-2.5 text-xs font-bold shadow-md hover:bg-ink/90 disabled:opacity-40 transition-all"
          >
            {saving ? "Adding…" : "+ Add Task"}
          </button>
        </div>

        {/* Priority Filter Pills */}
        <div className="flex gap-1.5 mb-3">
          {(["all", "high", "medium", "low"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`flex-1 text-xs rounded-full py-1.5 font-bold border capitalize transition-all ${
                priorityFilter === p
                  ? "bg-teal text-white border-teal shadow-xs"
                  : "bg-white border-ink/10 text-slate hover:bg-ink/5"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-slate mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded border-ink/20 text-teal focus:ring-teal"
          />
          Show completed tasks
        </label>

        {/* Overdue Section */}
        {overdue.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold text-rose-600 mb-2">⚠️ Overdue</p>
            <div className="flex flex-col gap-2">
              {overdue.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          </div>
        )}

        {/* Today Section */}
        <div className="mb-5">
          <p className="text-xs font-bold text-ink mb-2">Today's Focus</p>
          {today.length === 0 ? (
            <div className="p-4 bg-white rounded-2xl border border-ink/5 text-center text-xs text-slate">
              No tasks due today. Add one above!
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {today.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Section */}
        {upcoming.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate mb-2">Upcoming</p>
            <div className="flex flex-col gap-2">
              {upcoming.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
        }
