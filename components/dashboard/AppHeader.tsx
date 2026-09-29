// components/dashboard/AppHeader.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface HeaderUserData {
  id: string;
  name: string;
  email: string;
  targetExam: string | null;
  targetYear: number | null;
}

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profilePopupOpen, setProfilePopupOpen] = useState(false);
  const [user, setUser] = useState<HeaderUserData | null>(null);

  // Name editing state
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (!authUser) return;

      const { data: profile } = await supabase
        .from("users")
        .select("name, email, target_exam, target_year")
        .eq("uid", authUser.id)
        .maybeSingle();

      const resolvedName =
        profile?.name || authUser.user_metadata?.full_name || "Student";
      setUser({
        id: authUser.id,
        name: resolvedName,
        email: authUser.email || profile?.email || "",
        targetExam: profile?.target_exam || null,
        targetYear: profile?.target_year || null,
      });
      setNewName(resolvedName);
    }
    fetchUser();
  }, []);

  async function handleSaveName() {
    if (!newName.trim() || !user) return;
    setSavingName(true);

    try {
      await supabase
        .from("users")
        .update({ name: newName.trim() })
        .eq("uid", user.id);
      await supabase.auth.updateUser({ data: { full_name: newName.trim() } });
      setUser((prev) => (prev ? { ...prev, name: newName.trim() } : null));
      setEditingName(false);
    } catch (e) {
      console.error("Name update error:", e);
    } finally {
      setSavingName(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/onboarding");
  }

  // 🎯 Updated Hamburger Navigation Items Exactly As Requested:
  const navLinks = [
    { name: "Dashboard", href: "/dashboard", icon: "⚡" },
    { name: "Syllabus", href: "/library", icon: "📚" },
    { name: "Daily Tasks (To-Do List)", href: "/todo", icon: "✓" },
    { name: "Study", href: "/focus", icon: "⏱️" },
    { name: "Test and Test Schedule", href: "/tests", icon: "📊" },
    { name: "Resources Library", href: "/resources", icon: "📖" },
    { name: "Community", href: "/groups", icon: "👥" },
    { name: "Profile", href: "/profile", icon: "👤" },
  ];

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-ink/8 px-4 py-3 flex items-center justify-between shadow-xs">
        {/* Left: Hamburger + App Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open Navigation Menu"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-ink/75 hover:text-ink hover:bg-ink/5 active:scale-95 transition-all"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>

          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-teal to-emerald-400 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              PW
            </div>
            <span className="font-display font-bold text-base tracking-tight text-ink">
              Prep<span className="text-teal">Wise</span>
            </span>
          </Link>
        </div>

        {/* Right: User Avatar + Profile Quick Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfilePopupOpen(!profilePopupOpen)}
            className="flex items-center gap-2 p-1 pl-2.5 rounded-full border border-ink/10 hover:border-ink/20 bg-paper/50 active:scale-95 transition-all"
          >
            <span className="text-xs font-semibold text-ink max-w-[80px] truncate">
              {user?.name?.split(" ")[0] || "Profile"}
            </span>
            <div className="w-6 h-6 rounded-full bg-ink text-paper text-[11px] font-bold flex items-center justify-center">
              {user?.name ? user.name[0].toUpperCase() : "U"}
            </div>
          </button>

          {/* Quick Action Profile Popup */}
          {profilePopupOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setProfilePopupOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-ink/12 shadow-xl p-4 z-50 animate-in fade-in zoom-in-95">
                {/* User Identity Info */}
                <div className="pb-3 border-b border-ink/8">
                  <div className="flex items-center justify-between">
                    {editingName ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="w-full text-xs font-bold border border-ink/20 rounded-lg px-2 py-1 focus:outline-none focus:border-teal"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveName}
                          disabled={savingName}
                          className="text-[10px] bg-teal text-white px-2 py-1 rounded-lg font-bold"
                        >
                          {savingName ? "…" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingName(false)}
                          className="text-[10px] text-slate px-1 py-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <h4 className="text-sm font-bold text-ink truncate">
                          {user?.name}
                        </h4>
                        <button
                          onClick={() => setEditingName(true)}
                          className="text-[11px] text-teal font-semibold hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate truncate mt-0.5">
                    {user?.email}
                  </p>
                  {user?.targetExam && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-marigold/10 border border-marigold/20 text-[10px] font-bold text-ink">
                      <span>🎯</span>
                      <span>
                        Targeting {user.targetExam} {user.targetYear || ""}
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick Links */}
                <div className="py-2 flex flex-col gap-1 border-b border-ink/8">
                  <Link
                    href="/profile"
                    onClick={() => setProfilePopupOpen(false)}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-ink hover:bg-ink/5 transition-colors"
                  >
                    <span>👤</span> View Full Profile & Settings
                  </Link>
                  <Link
                    href="/focus"
                    onClick={() => setProfilePopupOpen(false)}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-ink hover:bg-ink/5 transition-colors"
                  >
                    <span>⏱️</span> Open Study Timer
                  </Link>
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                    />
                  </svg>
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Hamburger Navigation Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Slide-over Content */}
          <div className="relative w-72 max-w-[80%] bg-white h-full flex flex-col justify-between p-5 shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-ink/8">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal to-emerald-400 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    PW
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-ink">
                      PrepWise
                    </h3>
                    <p className="text-[10px] text-slate font-medium">
                      All Pages Navigation
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate hover:text-ink hover:bg-ink/5"
                >
                  ✕
                </button>
              </div>

              {/* Navigation Menu List */}
              <div className="flex flex-col gap-1.5 mt-5">
                {navLinks.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-teal/15 text-teal shadow-xs font-bold"
                          : "text-ink hover:bg-ink/5"
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-ink/8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-ink text-paper text-xs font-bold flex items-center justify-center">
                  {user?.name ? user.name[0].toUpperCase() : "U"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-ink truncate max-w-[120px]">
                    {user?.name}
                  </p>
                  <p className="text-[10px] text-slate truncate max-w-[120px]">
                    {user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="text-xs font-bold text-rose-600 hover:underline"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
