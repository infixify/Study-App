"use client";

import { useState } from "react";

const ITEMS = [
  { key: "home", label: "Home", icon: "⌂" },
  { key: "library", label: "Library", icon: "▤" },
  { key: "tests", label: "Tests", icon: "◎" },
  { key: "focus", label: "Focus", icon: "◷" },
  { key: "profile", label: "Profile", icon: "◍" },
];

export default function BottomNav() {
  const [active, setActive] = useState("home");

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-ink/10 z-20">
      <div className="max-w-md mx-auto flex justify-between px-2">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => setActive(item.key)}
            className="flex-1 flex flex-col items-center gap-1 py-3"
          >
            <span
              className={`text-lg ${
                active === item.key ? "text-marigold" : "text-slate"
              }`}
            >
              {item.icon}
            </span>
            <span
              className={`text-[10px] font-medium ${
                active === item.key ? "text-ink" : "text-slate"
              }`}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
