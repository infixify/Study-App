// components/dashboard/AppHeader.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
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

interface AppNotification {
  id: string;
  title: string;
  body: string;
  target_audience: string;
  action_url: string | null;
  created_at: string;
}

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profilePopupOpen, setProfilePopupOpen] = useState(false);
  const [notifPopupOpen, setNotifPopupOpen] = useState(false);
  const [user, setUser] = useState<HeaderUserData | null>(null);

  const [isDark, setIsDark] = useState(false);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadIds, setUnreadIds] = useState<string[]>([]);

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Bell button ref for positioning the fixed popup
  const [bellRect, setBellRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    setIsDark(isCurrentlyDark);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("prepwise_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("prepwise_theme", "light");
    }
  };

  const fetchNotifications = useCallback(async (userId: string, targetExam: string | null) => {
    try {
      const { data: allNotifs } = await supabase
        .from("notifications")
        .select("id, title, body, target_audience, action_url, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!allNotifs) return;

      const userExamLower = (targetExam || "jee").toLowerCase();
      const filtered = allNotifs.filter((n) => {
        const aud = (n.target_audience || "all").toLowerCase();
        return aud === "all" || aud === userExamLower;
      });

      setNotifications(filtered);

      const { data: readRows } = await supabase
        .from("notification_reads")
        .select("notification_id")
        .eq("user_id", userId);

      const readSet = new Set((readRows || []).map((r) => r.notification_id));
      const unreads = filtered.filter((n) => !readSet.has(n.id)).map((n) => n.id);
      setUnreadIds(unreads);
    } catch (e) {
      console.warn("Notifications load error", e);
    }
  }, []);

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
      const uData: HeaderUserData = {
        id: authUser.id,
        name: resolvedName,
        email: authUser.email || profile?.email || "",
        targetExam: profile?.target_exam || null,
        targetYear: profile?.target_year || null,
      };
      setUser(uData);
      setNewName(resolvedName);

      fetchNotifications(authUser.id, profile?.target_exam || null);
    }
    fetchUser();
  }, [fetchNotifications]);

  const markAllAsRead = async () => {
    if (!user || unreadIds.length === 0) return;
    const inserts = unreadIds.map((nid) => ({
      user_id: user.id,
      notification_id: nid,
    }));
    setUnreadIds([]);
    try {
      await supabase.from("notification_reads").upsert(inserts);
    } catch (e) {
      console.warn("Mark read error", e);
    }
  };

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

  const navLinks = [
    { name: "Dashboard", href: "/dashboard", icon: "⚡" },
    { name: "Syllabus", href: "/library", icon: "📚" },
    { name: "Daily Tasks", href: "/todo", icon: "✓" },
    { name: "Focus & Study Timer", href: "/focus", icon: "⏱️" },
    { name: "Tests & Schedule", href: "/tests", icon: "📊" },
    { name: "Resources Library", href: "/resources", icon: "📖" },
    { name: "Community", href: "/groups", icon: "👥" },
    { name: "Profile & Target", href: "/profile", icon: "👤" },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#141C2B]/90 backdrop-blur-md border-b border-ink/8 dark:border-white/10 px-4 py-3 flex items-center justify-between shadow-xs transition-colors">
        {/* Left: Hamburger + App Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open Navigation Menu"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-ink/75 hover:text-ink hover:bg-ink/5 dark:text-slate dark:hover:text-white dark:hover:bg-white/10 active:scale-95 transition-all"
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
            <span className="font-display font-bold text-base tracking-tight text-ink dark:text-white">
              Prep<span className="text-teal">Wise</span>
            </span>
          </Link>
        </div>

        {/* Right: Notifications + User Profile */}
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                // Capture bell position for fixed popup placement
                setBellRect(e.currentTarget.getBoundingClientRect());
                setNotifPopupOpen(!notifPopupOpen);
                setProfilePopupOpen(false);
                if (!notifPopupOpen && unreadIds.length > 0) {
                  markAllAsRead();
                }
              }}
              aria-label="Notifications"
              className="w-8 h-8 rounded-full flex items-center justify-center text-ink/70 hover:text-ink hover:bg-ink/5 dark:text-slate dark:hover:text-white dark:hover:bg-white/10 relative transition-all"
            >
              <span className="text-base leading-none">🔔</span>
              {unreadIds.length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-[#141C2B] animate-pulse" />
              )}
            </button>

            {notifPopupOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setNotifPopupOpen(false)}
                />
                {/* Fixed popup — positioned from the right edge of the screen
                    so it never clips on any phone width */}
                <div
                  className="fixed z-50 w-80 max-w-[calc(100vw-16px)] bg-white dark:bg-[#161F30] rounded-2xl border border-ink/12 dark:border-white/10 shadow-2xl p-4 animate-in fade-in zoom-in-95"
                  style={{
                    top: bellRect ? bellRect.bottom + 8 : 56,
                    right: 8,
                  }}
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-ink/8 dark:border-white/10">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-ink dark:text-white">
                        Notifications
                      </h4>
                      {unreadIds.length > 0 && (
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold dark:bg-rose-950 dark:text-rose-300">
                          {unreadIds.length} new
                        </span>
                      )}
                    </div>
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] font-semibold text-teal hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-ink/5 dark:divide-white/5 mt-2">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8 text-slate">
                        <p className="text-xl mb-1">🔕</p>
                        <p className="text-xs font-medium">No announcements yet</p>
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const isUnread = unreadIds.includes(n.id);
                        return (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (n.action_url) router.push(n.action_url);
                              setNotifPopupOpen(false);
                            }}
                            className={`py-2.5 px-2 rounded-xl cursor-pointer hover:bg-paper/80 dark:hover:bg-white/5 transition-all ${
                              isUnread ? "bg-teal/5 dark:bg-teal/10" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <h5 className="text-xs font-bold text-ink dark:text-white leading-tight">
                                {n.title}
                              </h5>
                              <span className="text-[9px] text-slate shrink-0">
                                {new Date(n.created_at).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate mt-1 leading-snug">
                              {n.body}
                            </p>
                            {n.action_url && (
                              <span className="inline-block mt-1 text-[10px] text-teal font-bold hover:underline">
                                View Details →
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User Profile Quick Action */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfilePopupOpen(!profilePopupOpen);
                setNotifPopupOpen(false);
              }}
              className="flex items-center gap-2 p-1 pl-2.5 rounded-full border border-ink/10 dark:border-white/15 hover:border-ink/20 bg-paper/50 dark:bg-white/5 active:scale-95 transition-all"
            >
              <span className="text-xs font-semibold text-ink dark:text-white max-w-[80px] truncate">
                {user?.name?.split(" ")[0] || "Profile"}
              </span>
              <div className="w-6 h-6 rounded-full bg-ink text-white dark:bg-white dark:text-ink text-[11px] font-bold flex items-center justify-center">
                {user?.name ? user.name[0].toUpperCase() : "U"}
              </div>
            </button>

            {profilePopupOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfilePopupOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#161F30] rounded-2xl border border-ink/12 dark:border-white/10 shadow-xl p-4 z-50 animate-in fade-in zoom-in-95">
                  <div className="pb-3 border-b border-ink/8 dark:border-white/10">
                    <div className="flex items-center justify-between">
                      {editingName ? (
                        <div className="flex items-center gap-1.5 w-full">
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full text-xs font-bold border border-ink/20 dark:border-white/20 bg-transparent rounded-lg px-2 py-1 focus:outline-none focus:border-teal text-ink dark:text-white"
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
                          <h4 className="text-sm font-bold text-ink dark:text-white truncate">
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
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-marigold/10 border border-marigold/20 text-[10px] font-bold text-marigold">
                        <span>🎯</span>
                        <span>
                          Targeting {user.targetExam} {user.targetYear || ""}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="py-2.5 border-b border-ink/8 dark:border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{isDark ? "🌙" : "☀️"}</span>
                      <span className="text-xs font-bold text-ink dark:text-white">
                        {isDark ? "Dark Theme" : "Light Theme"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-ink/5 dark:bg-white/10 hover:bg-ink/10 text-ink dark:text-white transition-all flex items-center gap-1.5"
                    >
                      <span>Switch to {isDark ? "Light ☀️" : "Dark 🌙"}</span>
                    </button>
                  </div>

                  <div className="py-2 flex flex-col gap-1 border-b border-ink/8 dark:border-white/10">
                    <Link
                      href="/profile"
                      onClick={() => setProfilePopupOpen(false)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-ink dark:text-white hover:bg-ink/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <span>👤</span> View Full Profile & Settings
                    </Link>
                    <Link
                      href="/focus"
                      onClick={() => setProfilePopupOpen(false)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-ink dark:text-white hover:bg-ink/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <span>⏱️</span> Open Study Timer
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
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
        </div>
      </header>

      {/* Hamburger Navigation Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-ink/60 dark:bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          <div className="relative w-72 max-w-[80%] bg-white dark:bg-[#141C2B] h-full flex flex-col justify-between p-5 shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-ink/8 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal to-emerald-400 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    PW
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-ink dark:text-white">
                      PrepWise
                    </h3>
                    <p className="text-[10px] text-slate font-medium">
                      Study Navigation
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate hover:text-ink dark:hover:text-white hover:bg-ink/5 dark:hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-1 mt-4">
                {navLinks.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-teal/15 text-teal shadow-xs font-bold dark:bg-teal/20"
                          : "text-ink dark:text-slate hover:text-ink dark:hover:text-white hover:bg-ink/5 dark:hover:bg-white/5"
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-ink/8 dark:border-white/10 space-y-3">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-paper dark:bg-white/5 border border-ink/8 dark:border-white/10 text-xs font-bold text-ink dark:text-white hover:bg-ink/5 dark:hover:bg-white/10 transition-all"
              >
                <div className="flex items-center gap-2">
                  <span>{isDark ? "🌙" : "☀️"}</span>
                  <span>Theme: {isDark ? "Dark Midnight" : "Light Clean"}</span>
                </div>
                <span className="text-[10px] text-teal">Switch</span>
              </button>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-ink text-white dark:bg-white dark:text-ink text-xs font-bold flex items-center justify-center">
                    {user?.name ? user.name[0].toUpperCase() : "U"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink dark:text-white truncate max-w-[120px]">
                      {user?.name}
                    </p>
                    <p className="text-[10px] text-slate truncate max-w-[120px]">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-xs font-bold text-rose-500 hover:underline"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
