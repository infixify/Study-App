// app/admin/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import ResourceUploader from "@/components/admin/ResourceUploader";

type ExamScheduleRow = {
  id: string;
  exam_key: string;
  label: string;
  target_exam: string;
  year: number;
  exam_date: string;
  is_confirmed: boolean;
  notes: string | null;
};

type ExamShiftRow = {
  id: string;
  exam_schedule_id: string;
  shift_date: string;
  shift_time: string;
  display_order: number;
};

type Stats = {
  totalUsers: number;
  jeeUsers: number;
  neetUsers: number;
  boardsOnly: number;
};

type RecentUser = {
  uid: string;
  name: string | null;
  email: string | null;
  target_exam: string | null;
  target_year: number | null;
  created_at?: string;
};

type AdminNotification = {
  id: string;
  title: string;
  body: string;
  target_audience: string;
  action_url: string | null;
  created_at: string;
};

type DailyContentItem = {
  id: string;
  content_type: "motivation" | "meme";
  quote: string;
  character: string;
  show: string;
  icon_or_sticker: string;
  is_active: boolean;
  created_at: string;
};

const DEFAULT_SEEDS = [
  { exam_key: "jee_mains_2026_s1", label: "JEE Main 2026 (Session 1)", target_exam: "JEE", year: 2026, exam_date: "2026-01-24", is_confirmed: true },
  { exam_key: "jee_mains_2026_s2", label: "JEE Main 2026 (Session 2)", target_exam: "JEE", year: 2026, exam_date: "2026-04-06", is_confirmed: false },
  { exam_key: "jee_advanced_2026", label: "JEE Advanced 2026", target_exam: "JEE", year: 2026, exam_date: "2026-05-24", is_confirmed: false },
  { exam_key: "neet_ug_2026", label: "NEET (UG) 2026", target_exam: "NEET", year: 2026, exam_date: "2026-05-03", is_confirmed: true },
  { exam_key: "cbse_boards_2026", label: "CBSE Class 12 Boards 2026", target_exam: "BOARDS", year: 2026, exam_date: "2026-02-15", is_confirmed: true },
];

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- Strict Auth Login State ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // --- Admin Data State ---
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsersList, setRecentUsersList] = useState<RecentUser[]>([]);
  const [schedule, setSchedule] = useState<ExamScheduleRow[]>([]);
  const [editedDates, setEditedDates] = useState<
    Record<string, { exam_date: string; is_confirmed: boolean }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [shiftsBySchedule, setShiftsBySchedule] = useState<
    Record<string, ExamShiftRow[]>
  >({});
  const [seeding, setSeeding] = useState(false);

  // --- Shift Form State ---
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [newShiftDate, setNewShiftDate] = useState("");
  const [newShiftTime, setNewShiftTime] = useState("");
  const [addingShift, setAddingShift] = useState(false);

  // --- Notification State ---
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifAudience, setNotifAudience] = useState("all");
  const [notifActionUrl, setNotifActionUrl] = useState("");
  const [deliveryChannel, setDeliveryChannel] = useState("both");
  const [priority, setPriority] = useState("high");
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState<string | null>(null);
  const [recentNotifs, setRecentNotifs] = useState<AdminNotification[]>([]);

  // --- Daily Content (Quotes & Memes) State ---
  const [dailyContents, setDailyContents] = useState<DailyContentItem[]>([]);
  const [contentType, setContentType] = useState<"motivation" | "meme">("motivation");
  const [contentQuote, setContentQuote] = useState("");
  const [contentCharacter, setContentCharacter] = useState("");
  const [contentShow, setContentShow] = useState("");
  const [contentMediaUrl, setContentMediaUrl] = useState("");
  const [savingContent, setSavingContent] = useState(false);
  const [contentSuccess, setContentSuccess] = useState<string | null>(null);

  const checkAdminStatus = useCallback(async () => {
    setChecking(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSession(false);
        setIsAdmin(false);
        return;
      }

      setSession(true);

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("uid", user.id)
        .maybeSingle();

      const hasAdmin =
        profile?.role === "admin" ||
        user.email === "sarthaksinghyadav1@gmail.com";

      setIsAdmin(hasAdmin);

      if (hasAdmin) {
        loadAdminData();
      }
    } finally {
      setChecking(false);
    }
  }, []);

  const loadAdminData = async () => {
    // 1. STATS: Accurate & Case-Insensitive Calculation
    try {
      const { data: users, count } = await supabase
        .from("users")
        .select("uid, name, email, target_exam, target_year, created_at", { count: "exact" })
        .order("created_at", { ascending: false });

      if (users) {
        const total = count ?? users.length;
        let jee = 0;
        let neet = 0;
        let boards = 0;

        users.forEach((u) => {
          const exam = (u.target_exam || "").trim().toUpperCase();
          if (exam.includes("JEE")) jee++;
          else if (exam.includes("NEET")) neet++;
          else if (exam.includes("BOARD")) boards++;
        });

        setStats({
          totalUsers: total,
          jeeUsers: jee,
          neetUsers: neet,
          boardsOnly: boards,
        });

        setRecentUsersList(users.slice(0, 8));
      }
    } catch (err) {
      console.warn("Stats load error", err);
    }

    // 2. Schedules
    const { data: schedules } = await supabase
      .from("exam_schedules")
      .select("*")
      .order("year", { ascending: true });

    if (schedules && schedules.length > 0) {
      setSchedule(schedules);
      if (!selectedScheduleId) {
        setSelectedScheduleId(schedules[0].id);
      }
    } else {
      setSchedule([]);
    }

    // 3. Shifts
    const { data: shifts } = await supabase
      .from("exam_shifts")
      .select("*")
      .order("display_order", { ascending: true });

    if (shifts) {
      const grouped: Record<string, ExamShiftRow[]> = {};
      for (const s of shifts) {
        if (!grouped[s.exam_schedule_id]) grouped[s.exam_schedule_id] = [];
        grouped[s.exam_schedule_id].push(s);
      }
      setShiftsBySchedule(grouped);
    }

    // 4. Notifications
    const { data: notifs } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (notifs) setRecentNotifs(notifs);

    // 5. Daily Content (Quotes & Memes)
    try {
      const { data: dc } = await supabase
        .from("daily_content")
        .select("*")
        .order("created_at", { ascending: false });
      if (dc) setDailyContents(dc);
    } catch (e) {
      console.warn("daily_content fetch error", e);
    }
  };

  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  // Seed Default Exam Dates if table is empty
  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      for (const s of DEFAULT_SEEDS) {
        await supabase.from("exam_schedules").upsert(s, { onConflict: "exam_key" });
      }
      await loadAdminData();
    } catch (e: any) {
      alert("Error seeding exams: " + e.message);
    } finally {
      setSeeding(false);
    }
  };

  // Login Only
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("uid", data.user.id)
        .maybeSingle();

      const isOwner =
        profile?.role === "admin" ||
        data.user.email === "sarthaksinghyadav1@gmail.com";

      if (!isOwner) {
        await supabase.auth.signOut();
        throw new Error("Access Denied: Account not marked as admin.");
      }

      setSession(true);
      setIsAdmin(true);
      loadAdminData();
    } catch (err: any) {
      setAuthError(err?.message ?? "Invalid admin credentials");
    } finally {
      setAuthBusy(false);
    }
  };

  // Broadcast Notification
  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) return;
    setSendingNotif(true);
    setNotifSuccess(null);

    try {
      if (deliveryChannel === "both" || deliveryChannel === "in_app") {
        const { error } = await supabase.from("notifications").insert({
          title: notifTitle.trim(),
          body: notifBody.trim(),
          target_audience: notifAudience,
          action_url: notifActionUrl.trim() || null,
        });
        if (error) throw error;
      }

      if (deliveryChannel === "both" || deliveryChannel === "push_only") {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        await fetch("/api/admin/send-notification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken || ""}`,
          },
          body: JSON.stringify({
            title: notifTitle.trim(),
            body: notifBody.trim(),
            target_audience: notifAudience,
            action_url: notifActionUrl.trim() || null,
            priority,
          }),
        });
      }

      setNotifSuccess("Notification broadcasted successfully!");
      setNotifTitle("");
      setNotifBody("");
      setNotifActionUrl("");
      loadAdminData();
    } catch (err: any) {
      alert("Failed to broadcast: " + err.message);
    } finally {
      setSendingNotif(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await supabase.from("notifications").delete().eq("id", id);
      setRecentNotifs((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // Add Quote or Meme
  const handleAddDailyContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentQuote.trim() || !contentCharacter.trim()) return;
    setSavingContent(true);
    setContentSuccess(null);

    const PRESETS = [
      { gradient_color: "from-sky-500 to-indigo-600", bg_color: "bg-sky-50", border_color: "border-sky-200", text_color: "text-sky-950", badge_color: "bg-sky-500" },
      { gradient_color: "from-amber-500 to-orange-600", bg_color: "bg-amber-50", border_color: "border-amber-200", text_color: "text-amber-950", badge_color: "bg-amber-500" },
      { gradient_color: "from-purple-500 to-indigo-600", bg_color: "bg-purple-50", border_color: "border-purple-200", text_color: "text-purple-950", badge_color: "bg-purple-500" },
      { gradient_color: "from-teal-500 to-emerald-600", bg_color: "bg-teal-50", border_color: "border-teal-200", text_color: "text-teal-950", badge_color: "bg-teal-500" },
      { gradient_color: "from-rose-500 to-pink-600", bg_color: "bg-rose-50", border_color: "border-rose-200", text_color: "text-rose-950", badge_color: "bg-rose-500" },
    ];
    const picked = PRESETS[Math.floor(Math.random() * PRESETS.length)];

    try {
      const { data, error } = await supabase
        .from("daily_content")
        .insert({
          content_type: contentType,
          quote: contentQuote.trim(),
          character: contentCharacter.trim(),
          show: contentShow.trim() || (contentType === "motivation" ? "Inspiration" : "PrepWise Roast"),
          icon_or_sticker: contentMediaUrl.trim() || (contentType === "motivation" ? "🔥" : "😂"),
          gradient_color: picked.gradient_color,
          bg_color: picked.bg_color,
          border_color: picked.border_color,
          text_color: picked.text_color,
          badge_color: picked.badge_color,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setDailyContents((prev) => [data, ...prev]);
        setContentQuote("");
        setContentCharacter("");
        setContentShow("");
        setContentMediaUrl("");
        setContentSuccess(`${contentType === "motivation" ? "Quote" : "Meme"} added successfully!`);
      }
    } catch (err: any) {
      alert("Failed to save content: " + err.message);
    } finally {
      setSavingContent(false);
    }
  };

  const handleDeleteContent = async (id: string) => {
    try {
      await supabase.from("daily_content").delete().eq("id", id);
      setDailyContents((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      console.error(err);
    }
  };

  const saveDate = async (row: ExamScheduleRow) => {
    const edit = editedDates[row.id];
    if (!edit) return;
    setSavingId(row.id);

    try {
      await supabase
        .from("exam_schedules")
        .update({
          exam_date: edit.exam_date,
          is_confirmed: edit.is_confirmed,
        })
        .eq("id", row.id);

      setSchedule((prev) =>
        prev.map((s) => (s.id === row.id ? { ...s, ...edit } : s))
      );
    } finally {
      setSavingId(null);
    }
  };

  const addShift = async () => {
    if (!selectedScheduleId || !newShiftDate || !newShiftTime) return;
    setAddingShift(true);

    try {
      const { data, error } = await supabase
        .from("exam_shifts")
        .insert({
          exam_schedule_id: selectedScheduleId,
          shift_date: newShiftDate,
          shift_time: newShiftTime,
          display_order: 1,
        })
        .select()
        .single();

      if (!error && data) {
        setShiftsBySchedule((prev) => ({
          ...prev,
          [selectedScheduleId]: [...(prev[selectedScheduleId] || []), data],
        }));
        setNewShiftDate("");
        setNewShiftTime("");
      }
    } finally {
      setAddingShift(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6 text-sm text-slate">
        Checking admin access…
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl border border-ink/10 bg-white p-7 shadow-xl">
          <div className="w-10 h-10 rounded-2xl bg-ink text-white flex items-center justify-center mb-3 text-lg font-bold">
            🛡️
          </div>
          <h1 className="font-display text-xl font-bold text-ink">
            Admin Authentication
          </h1>
          <p className="text-xs text-slate mt-1 mb-5">
            Strict Access: Only registered Super Admins can log in.
          </p>

          <form onSubmit={handleAuthSubmit} autoComplete="off" className="flex flex-col gap-3.5">
            <div>
              <label className="text-[10px] font-bold text-slate block mb-1">
                Admin Email
              </label>
              <input
                type="email"
                placeholder="admin@prepwise.in"
                autoComplete="new-password"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-ink/15 p-2.5 text-xs font-semibold outline-none focus:border-teal"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate block mb-1">
                Master Password
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-ink/15 p-2.5 text-xs font-semibold outline-none focus:border-teal"
                required
              />
            </div>

            {authError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                ⚠️ {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authBusy}
              className="mt-1 bg-ink text-white rounded-xl py-3 text-xs font-bold shadow-md hover:bg-ink-100 disabled:opacity-40 transition-all"
            >
              {authBusy ? "Authenticating Clearance…" : "Authorize Admin Access 🔐"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-24">
      {/* Header */}
      <header className="border-b border-ink/8 bg-white px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-ink text-white flex items-center justify-center font-bold text-xs">
              🛡️
            </span>
            <div>
              <h1 className="font-display text-xl font-bold text-ink">
                Admin Console
              </h1>
              <p className="text-[11px] text-slate">
                Authorized Super-Admin Session Active
              </p>
            </div>
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => setSession(false))}
            className="text-xs text-rose-600 font-bold hover:underline px-3 py-1.5 rounded-lg hover:bg-rose-50"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 pt-6 flex flex-col gap-8">
        {/* 1. STATS (REALTIME & ACCURATE) */}
        {stats && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Aspirants" value={stats.totalUsers} />
              <StatCard label="JEE Students" value={stats.jeeUsers} />
              <StatCard label="NEET Students" value={stats.neetUsers} />
              <StatCard label="Boards Only" value={stats.boardsOnly} />
            </div>

            {/* Recent Registered Students Quick Preview */}
            {recentUsersList.length > 0 && (
              <div className="mt-3 p-4 rounded-ticket border border-ink/10 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-ink">
                    Recently Enrolled Aspirants
                  </h4>
                  <span className="text-[10px] text-slate font-medium">
                    Showing latest {recentUsersList.length}
                  </span>
                </div>
                <div className="divide-y divide-ink/5">
                  {recentUsersList.map((u) => (
                    <div
                      key={u.uid}
                      className="py-2 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-ink/5 flex items-center justify-center font-bold text-[10px] text-ink">
                          {u.name ? u.name[0].toUpperCase() : "U"}
                        </div>
                        <div>
                          <p className="font-bold text-ink leading-none">
                            {u.name || "Student"}
                          </p>
                          <p className="text-[10px] text-slate">{u.email}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal/10 text-teal">
                        {u.target_exam || "JEE"} {u.target_year || ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. DAILY CONTENT: QUOTES & MEMES CONTROLLER */}
        <section className="rounded-ticket border border-ink/10 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                ✨ Daily Quotes & Memes Controller
              </h2>
              <p className="text-xs text-slate">
                Add, remove, and manage motivational quotes and humorous study roasts for the Dashboard HeroWidget.
              </p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {dailyContents.length} Items Live
            </span>
          </div>

          {contentSuccess && (
            <div className="p-3 mb-4 rounded-xl bg-teal/10 border border-teal/20 text-xs font-bold text-teal">
              ✓ {contentSuccess}
            </div>
          )}

          <form onSubmit={handleAddDailyContent} className="space-y-3 p-4 rounded-2xl bg-paper/50 border border-ink/8">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setContentType("motivation")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                  contentType === "motivation"
                    ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                    : "bg-white text-slate-700 border-ink/15"
                }`}
              >
                🔥 Motivational Quote
              </button>
              <button
                type="button"
                onClick={() => setContentType("meme")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                  contentType === "meme"
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                    : "bg-white text-slate-700 border-ink/15"
                }`}
              >
                😂 Meme / Sarcastic Roast
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate block mb-0.5">
                {contentType === "motivation" ? "Inspiring Quote" : "Meme / Roast Text"}
              </label>
              <textarea
                rows={2}
                placeholder={
                  contentType === "motivation"
                    ? "e.g. Dream is not that which you see while sleeping, it is something that does not let you sleep."
                    : "e.g. Bhai agar itna time padhai me lagata jitna reels me lagaya hai, toh AIR 1 pakki thi!"
                }
                value={contentQuote}
                onChange={(e) => setContentQuote(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 bg-white outline-none focus:border-teal"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">
                  Speaker / Character Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. A.P.J. Abdul Kalam / CID Daya / Saitama"
                  value={contentCharacter}
                  onChange={(e) => setContentCharacter(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 bg-white outline-none focus:border-teal"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">
                  Show / Context / Book
                </label>
                <input
                  type="text"
                  placeholder="e.g. Wings of Fire / Kota Realities"
                  value={contentShow}
                  onChange={(e) => setContentShow(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 bg-white outline-none focus:border-teal"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate block mb-0.5">
                Media: Direct Image / GIF URL (or Emoji)
              </label>
              <input
                type="text"
                placeholder="e.g. https://media.giphy.com/.../giphy.gif OR /memes/daya.gif OR 🚀"
                value={contentMediaUrl}
                onChange={(e) => setContentMediaUrl(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 bg-white outline-none focus:border-teal"
              />
              <p className="text-[10px] text-slate mt-0.5">
                Note: Gradient & card background colors are auto-picked to keep cards vibrant.
              </p>
            </div>

            <button
              type="submit"
              disabled={savingContent}
              className="w-full py-2.5 bg-ink text-white rounded-xl text-xs font-bold hover:bg-ink-100 disabled:opacity-40 transition-all shadow-xs"
            >
              {savingContent ? "Saving to Database…" : `+ Add to ${contentType === "motivation" ? "Motivation Deck" : "Meme Deck"}`}
            </button>
          </form>

          {dailyContents.length > 0 && (
            <div className="mt-5 space-y-2">
              <h4 className="text-xs font-bold text-slate uppercase tracking-wider">
                Active Deck Items ({dailyContents.length})
              </h4>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {dailyContents.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-paper/60 border border-ink/8 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg shrink-0">
                        {item.icon_or_sticker.startsWith("http") ? "🖼️" : item.icon_or_sticker}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            item.content_type === "motivation" ? "bg-amber-100 text-amber-800" : "bg-purple-100 text-purple-800"
                          }`}>
                            {item.content_type}
                          </span>
                          <span className="font-bold text-ink truncate">— {item.character}</span>
                        </div>
                        <p className="text-[11px] text-slate line-clamp-1 mt-0.5">
                          "{item.quote}"
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteContent(item.id)}
                      className="text-xs text-rose-600 font-bold hover:underline shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 3. BROADCAST NOTIFICATIONS */}
        <section className="rounded-ticket border border-ink/10 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                📢 Broadcast Push Notification
              </h2>
              <p className="text-xs text-slate">
                Sends instant In-App Bell notifications and Firebase Device Push.
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              FCM & Supabase Connected
            </span>
          </div>

          {notifSuccess && (
            <div className="p-3 mb-4 rounded-xl bg-teal/10 border border-teal/20 text-xs font-bold text-teal">
              ✓ {notifSuccess}
            </div>
          )}

          <form onSubmit={handleSendNotification} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate block mb-0.5">
                Notification Title
              </label>
              <input
                type="text"
                placeholder="e.g. 🎯 JEE Mains 2026 Shift Timings Released!"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 outline-none focus:border-teal"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate block mb-0.5">
                Message Body
              </label>
              <textarea
                rows={2}
                placeholder="e.g. NTA has announced exam dates. Check updated shifts and revision planner."
                value={notifBody}
                onChange={(e) => setNotifBody(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 outline-none focus:border-teal"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">
                  Target Audience
                </label>
                <select
                  value={notifAudience}
                  onChange={(e) => setNotifAudience(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 bg-white"
                >
                  <option value="all">🌍 All Aspirants</option>
                  <option value="jee">⚡ JEE Students Only</option>
                  <option value="neet">🩺 NEET Students Only</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">
                  Action Link / Route (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. /tests or /resources"
                  value={notifActionUrl}
                  onChange={(e) => setNotifActionUrl(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 outline-none focus:border-teal"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">
                  Delivery Channels
                </label>
                <select
                  value={deliveryChannel}
                  onChange={(e) => setDeliveryChannel(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 bg-white"
                >
                  <option value="both">🔔 In-App + 📲 Device Push (FCM)</option>
                  <option value="in_app">🔔 In-App Bell Only</option>
                  <option value="push_only">📲 Device Push Only</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">
                  Push Priority (Alert Sound)
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 bg-white"
                >
                  <option value="high">🚨 High Priority (Phone Sound & Vibrate)</option>
                  <option value="normal">💬 Normal (Silent in notification bar)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={sendingNotif}
              className="w-full py-3 bg-teal text-white rounded-xl text-xs font-bold shadow-md shadow-teal/20 hover:bg-teal/90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              <span>{sendingNotif ? "Broadcasting..." : "Send Notification Now 🚀"}</span>
            </button>
          </form>

          {recentNotifs.length > 0 && (
            <div className="mt-6 pt-5 border-t border-ink/8 space-y-2">
              <h4 className="text-xs font-bold text-slate uppercase tracking-wider">
                Recent Broadcasts
              </h4>
              <div className="space-y-2">
                {recentNotifs.map((rn) => (
                  <div
                    key={rn.id}
                    className="p-3 rounded-xl bg-paper/60 border border-ink/8 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-ink/5 text-ink/70">
                          {rn.target_audience.toUpperCase()}
                        </span>
                        <span className="font-bold text-ink">{rn.title}</span>
                      </div>
                      <p className="text-[11px] text-slate mt-0.5">{rn.body}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteNotification(rn.id)}
                      className="text-xs text-rose-600 hover:underline font-bold shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 4. EXAM DATES & SHIFTS (WITH AUTO SEED & SHIFTS CONTROLLER) */}
        <section className="rounded-ticket border border-ink/10 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Exam Schedules & Shifts
              </h2>
              <p className="text-xs text-slate">
                Manage exam dates, confirmation status, and morning/evening shifts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {schedule.length === 0 && (
                <button
                  onClick={handleSeedDefaults}
                  disabled={seeding}
                  className="px-3 py-1.5 bg-marigold text-ink font-bold rounded-lg text-xs hover:bg-marigold/80 shadow-xs"
                >
                  {seeding ? "Populating…" : "⚡ Seed Default 2026 Exams"}
                </button>
              )}
              <button
                onClick={loadAdminData}
                className="text-xs text-teal font-bold hover:underline"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {schedule.length === 0 ? (
              <div className="p-6 rounded-2xl bg-paper/60 border border-dashed border-ink/15 text-center">
                <p className="text-xs text-slate font-medium mb-3">
                  No exam schedules loaded yet in your database.
                </p>
                <button
                  onClick={handleSeedDefaults}
                  disabled={seeding}
                  className="px-4 py-2 bg-teal text-white rounded-xl text-xs font-bold shadow-xs hover:bg-teal/90"
                >
                  {seeding ? "Creating Schedules..." : "⚡ Click here to Load 2026 Exams Automatically"}
                </button>
              </div>
            ) : (
              schedule.map((row) => {
                const shifts = shiftsBySchedule[row.id] || [];
                return (
                  <div
                    key={row.id}
                    className="p-4 rounded-2xl bg-paper/60 border border-ink/8 flex flex-col gap-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-ink/5 text-ink">
                            {row.target_exam} {row.year}
                          </span>
                          <h4 className="text-xs font-bold text-ink">{row.label}</h4>
                        </div>
                        <p className="text-[10px] text-slate mt-0.5">Key: {row.exam_key}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={editedDates[row.id]?.exam_date ?? row.exam_date}
                          onChange={(e) =>
                            setEditedDates((prev) => ({
                              ...prev,
                              [row.id]: {
                                exam_date: e.target.value,
                                is_confirmed:
                                  editedDates[row.id]?.is_confirmed ?? row.is_confirmed,
                              },
                            }))
                          }
                          className="p-1.5 text-xs font-semibold rounded-lg border border-ink/15 bg-white"
                        />
                        <label className="flex items-center gap-1 text-[11px] font-semibold text-slate">
                          <input
                            type="checkbox"
                            checked={
                              editedDates[row.id]?.is_confirmed ?? row.is_confirmed
                            }
                            onChange={(e) =>
                              setEditedDates((prev) => ({
                                ...prev,
                                [row.id]: {
                                  exam_date:
                                    editedDates[row.id]?.exam_date ?? row.exam_date,
                                  is_confirmed: e.target.checked,
                                },
                              }))
                            }
                          />
                          Confirmed
                        </label>
                        <button
                          onClick={() => saveDate(row)}
                          disabled={savingId === row.id}
                          className="px-3 py-1.5 bg-ink text-paper rounded-lg text-xs font-bold hover:bg-ink-100 disabled:opacity-40"
                        >
                          {savingId === row.id ? "…" : "Save Date"}
                        </button>
                      </div>
                    </div>

                    {shifts.length > 0 && (
                      <div className="pt-2 border-t border-ink/6 flex flex-wrap gap-2">
                        <span className="text-[10px] font-bold text-slate self-center">Shifts:</span>
                        {shifts.map((s) => (
                          <span
                            key={s.id}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-ink/10 text-ink"
                          >
                            📅 {s.shift_date} • ⏰ {s.shift_time}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {schedule.length > 0 && (
            <div className="mt-5 p-4 rounded-2xl bg-paper/40 border border-ink/8">
              <h4 className="text-xs font-bold text-ink mb-2">➕ Add Shift to Exam</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                <select
                  value={selectedScheduleId}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  className="p-2 text-xs font-semibold rounded-xl border border-ink/15 bg-white"
                >
                  {schedule.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={newShiftDate}
                  onChange={(e) => setNewShiftDate(e.target.value)}
                  className="p-2 text-xs font-semibold rounded-xl border border-ink/15 bg-white"
                />

                <input
                  type="text"
                  placeholder="e.g. 9:00 AM - 12:00 PM"
                  value={newShiftTime}
                  onChange={(e) => setNewShiftTime(e.target.value)}
                  className="p-2 text-xs font-semibold rounded-xl border border-ink/15 bg-white"
                />

                <button
                  type="button"
                  onClick={addShift}
                  disabled={!newShiftDate || !newShiftTime || addingShift}
                  className="py-2 bg-teal text-white rounded-xl text-xs font-bold hover:bg-teal/90 disabled:opacity-40"
                >
                  {addingShift ? "Adding…" : "Add Shift"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 5. RESOURCE VAULT */}
        <section className="rounded-ticket border border-ink/10 bg-white p-6 shadow-xs">
          <h2 className="font-display text-lg font-bold mb-3">Resource Vault</h2>
          <ResourceUploader />
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-ticket border border-ink/10 bg-white p-4">
      <p className="font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate mt-0.5">{label}</p>
    </div>
  );
}
