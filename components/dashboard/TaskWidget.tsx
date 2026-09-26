"use client";

import { useState } from "react";

interface Task {
  id: string;
  title: string;
  type: "todo" | "backlog";
  done: boolean;
}

interface TaskWidgetProps {
  tasks: Task[];
}

export default function TaskWidget({ tasks: initialTasks }: TaskWidgetProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [tab, setTab] = useState<"todo" | "backlog">("todo");

  function toggle(id: string) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  const filtered = tasks.filter((t) => t.type === tab);
  const backlogCount = tasks.filter((t) => t.type === "backlog" && !t.done).length;

  return (
    <div className="mt-4 rounded-ticket border border-ink/10 bg-white p-5">
      <div className="flex gap-4 border-b border-ink/8">
        <button
          onClick={() => setTab("todo")}
          className={`pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "todo" ? "border-marigold text-ink" : "border-transparent text-slate"
          }`}
        >
          Today
        </button>
        <button
          onClick={() => setTab("backlog")}
          className={`pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            tab === "backlog" ? "border-coral text-ink" : "border-transparent text-slate"
          }`}
        >
          Backlog
          {backlogCount > 0 && (
            <span className="text-[10px] bg-coral/15 text-coral rounded-full px-1.5 py-0.5 font-semibold">
              {backlogCount}
            </span>
          )}
        </button>
      </div>

      <ul className="mt-3 flex flex-col gap-2.5">
        {filtered.length === 0 && (
          <li className="text-sm text-slate py-4 text-center">
            Nothing here — you're caught up.
          </li>
        )}
        {filtered.map((task) => (
          <li key={task.id} className="flex items-start gap-3">
            <button
              onClick={() => toggle(task.id)}
              aria-label={task.done ? "Mark incomplete" : "Mark complete"}
              className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                task.done ? "bg-teal border-teal" : "border-ink/20"
              }`}
            />
            <span
              className={`text-sm leading-snug ${
                task.done ? "line-through text-slate" : "text-ink"
              }`}
            >
              {task.title}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
