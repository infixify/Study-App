"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/dashboard/BottomNav";

type TaskType = "todo" | "backlog";
type TaskStatus = "pending" | "completed";

interface Task {
  id: string;
  title: string;
  task_type: TaskType;
  status: TaskStatus;
  due_date: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TodoPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | TaskType>("all");
  const [showCompleted, setShowCompleted] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<TaskType>("todo");
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
      .select("id, title, task_type, status, due_date")
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
      setError("Give the task a title.");
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
      task_type: newType,
      due_date: newDueDate,
      status: "pending",
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setNewTitle("");
      setNewType("todo");
      setNewDueDate(todayISO());
      await load();
    }
    setSaving(false);
  }

  async function toggleStatus(task: Task) {
    const nextStatus: TaskStatus = task.status === "completed" ? "pending" : "completed";

    // Optimistic update
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

  async function moveToBacklog(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, task_type: "backlog" } : t))
    );
    await supabase.from("tasks").update({ task_type: "backlog" }).eq("id", id);
  }

  const filtered = tasks.filter((t) => {
    if (!showCompleted && t.status === "completed") return false;
    if (filter === "all") return true;
    return t.task_type === filter;
  });

  const overdue = filtered.filter(
    (t) => t.status === "pending" && t.due_date < todayISO()
  );
  const today = filtered.filter((t) => t.due_date === todayISO());
  const upcoming = filtered.filter(
    (t) => t.due_date > todayISO() || (t.status === "completed" && t.due_date !== todayISO())
  );

  function TaskRow({ task }: { task: Task }) {
    return (
      <div className="bg-white rounded-ticket border border-ink/10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => toggleStatus(task)}
          className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            task.status === "completed" ? "bg-teal border-teal" : "border-ink/25"
          }`}
        >
          {task.status === "completed" && (
            <span className="text-paper text-[10px]">✓</span>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium truncate ${
              task.status === "completed" ? "line-through text-ink/40" : "text-ink"
            }`}
          >
            {task.title}
          </p>
          <p className="text-[11px] text-slate mt-0.5">
            {task.task_type === "backlog" ? "Backlog" : "To-do"} ·{" "}
            {new Date(task.due_date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>

        {task.task_type === "todo" && task.status === "pending" && (
          <button
            onClick={() => moveToBacklog(task.id)}
            className="shrink-0 text-[11px] text-slate underline"
          >
            To backlog
          </button>
        )}

        <button
          onClick={() => handleDelete(task.id)}
          className="shrink-0 text-[11px] text-coral"
        >
          Remove
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
        <h1 className="font-display text-2xl font-semibold mb-4">To-do</h1>

        {/* Add task */}
        <div className="rounded-ticket border border-ink/10 bg-white p-4 mb-6">
          <input
            type="text"
            placeholder="What do you need to do?"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-2"
          />
          <div className="grid grid-cols-2 gap-2 mb-3">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as TaskType)}
              className="rounded-lg border border-ink/15 p-2.5 text-sm"
            >
              <option value="todo">To-do</option>
              <option value="backlog">Backlog</option>
            </select>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="rounded-lg border border-ink/15 p-2.5 text-sm"
            />
          </div>
          {error && <p className="text-xs text-coral mb-2">{error}</p>}
          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full bg-ink text-paper rounded-ticket py-2.5 text-sm font-medium disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add task"}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-2">
          {(["all", "todo", "backlog"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 text-xs rounded-full py-2 font-medium border ${
                filter === f ? "bg-marigold/15 border-marigold text-ink" : "border-ink/12 text-slate"
              }`}
            >
              {f === "all" ? "All" : f === "todo" ? "To-do" : "Backlog"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate mb-5">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Show completed
        </label>

        {/* Sections */}
        {overdue.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-coral mb-2">Overdue</p>
            <div className="flex flex-col gap-2">
              {overdue.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          </div>
        )}

        <div className="mb-5">
          <p className="text-xs font-semibold text-ink/60 mb-2">Today</p>
          {today.length === 0 ? (
            <p className="text-sm text-slate">Nothing due today.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {today.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-ink/60 mb-2">Upcoming</p>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate">Nothing else scheduled.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
