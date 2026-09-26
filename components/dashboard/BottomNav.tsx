"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { key: "home", label: "Home", icon: "⌂", href: "/dashboard" },
  { key: "library", label: "Library", icon: "▤", href: "/library" },
  { key: "tests", label: "Tests", icon: "◎", href: "/tests" },
  { key: "focus", label: "Focus", icon: "◷", href: "/focus" },
  { key: "profile", label: "Profile", icon: "◍", href: "/profile" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-ink/10 z-20">
      <div className="max-w-md mx-auto flex justify-between px-2">
        {ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex-1 flex flex-col items-center gap-1 py-3"
            >
              <span className={`text-lg ${active ? "text-marigold" : "text-slate"}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-medium ${active ? "text-ink" : "text-slate"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
