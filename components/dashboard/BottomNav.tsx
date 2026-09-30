// components/dashboard/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: "Home", href: "/dashboard", icon: "🏠" },
    { label: "Rank", href: "/leaderboard", icon: "🏆" },
    { label: "Resources", href: "/resources", icon: "📖" },
    { label: "Study", href: "/focus", icon: "⏱️" },
    { label: "Test", href: "/tests", icon: "📊" },
    { label: "GROUPS", href: "/groups", icon: "👥" },
    { label: "Profile", href: "/profile", icon: "👤" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#121A29]/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-white/10 py-1.5 px-3 shadow-lg transition-colors">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-2xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? "text-teal dark:text-[#2DD4BF] font-black"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-medium"
              }`}
            >
              <div
                className={`w-9 h-7 rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? "bg-teal/15 dark:bg-teal/20 text-teal dark:text-[#2DD4BF]"
                    : "bg-transparent"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
              </div>
              <span
                className={`text-[9.5px] mt-0.5 tracking-tight ${
                  isActive
                    ? "text-teal dark:text-[#2DD4BF] font-bold"
                    : "text-slate-500 dark:text-slate-400 font-semibold"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
