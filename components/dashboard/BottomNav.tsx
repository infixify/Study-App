// components/dashboard/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: "Home", href: "/dashboard", icon: "⚡" },
    { label: "Syllabus", href: "/library", icon: "📚" },
    { label: "Study", href: "/focus", icon: "⏱️" },
    { label: "Tasks", href: "/todo", icon: "✓" },
    { label: "Tests", href: "/tests", icon: "📊" },
    { label: "Notes", href: "/resources", icon: "📖" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-ink/8 py-2 px-3 shadow-lg">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[48px] py-1 px-1.5 rounded-xl transition-all ${
                isActive
                  ? "text-teal font-bold scale-105"
                  : "text-slate hover:text-ink font-medium"
              }`}
            >
              <span className="text-lg leading-none mb-1">{item.icon}</span>
              <span className={`text-[10px] leading-tight ${isActive ? "text-teal font-extrabold" : "text-slate"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
