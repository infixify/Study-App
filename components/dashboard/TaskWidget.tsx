"use client";

import { useState } from "react";
import Link from "next/link";

interface Task {
  id: string;
  title: string;
  priority?: "high" | "medium" | "low";
  done: boolean;
}

interface TaskWidgetProps {
  tasks: Task[];
}

export default function TaskWidget({ tasks: initialTasks }: TaskWidgetProps) {
  const [tasks, setTasks] = useState(initialTasks);

  function toggle(id: string) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  const priorityDot: Record<string, string> = {
    high: "bg-rose-500",
    medium: "bg-amber-500",
    low: "bg-blue-500",
  };

  return (
    <div className="rounded-ticket border border-ink/10 bg-white p-4">
      <ul className="flex flex-col gap-2">
        {tasks.length === 0 && (
          <li className="text-xs text-slate py-4 text-center">
            No pending tasks. You are all caught up!
          </li>
        )}
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center justify-between gap-3 p-1.5 rounded-lg hover:bg-ink/5 transition-all">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <button
                onClick={() => toggle(task.id)}
                aria-label={task.done ? "Mark incomplete" : "Mark complete"}
                className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                  task.done ? "bg-teal border-teal" : "border-ink/20"
                }`}
              />
              <span
                className={`text-xs truncate ${
                  task.done ? "line-through text-slate" : "text-ink font-medium"
                }`}
              >
                {task.title}
              </span>
            </div>
            {task.priority && (
              <span
                title={`${task.priority} priority`}
                className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[task.priority] || "bg-amber-500"}`}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
