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

type AdminNotification = {
  id: string;
  title: string;
  body: string;
  target_audience: string;
  action_url: string | null;
  created_at: string;
};

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- auth form state ---
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // --- admin data state ---
  const [stats, setStats] = useState<Stats | null>(null);
  const [schedule, setSchedule] = useState<ExamScheduleRow[]>([]);
  const [editedDates, setEditedDates] = useState<
    Record<string, { exam_date: string; is_confirmed: boolean }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [shiftsBySchedule, setShiftsBySchedule] = useState<
    Record<string, ExamShiftRow[]>
  >({});

  // --- shift form state ---
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [newShiftDate, setNewShiftDate] = useState("");
  const [newShiftTime, setNewShiftTime] = useState("");
  const [addingShift, setAddingShift] = useState(false);

  // --- NOTIFICATION & PUSH BROADCAST STATE ---
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifAudience, setNotifAudience] = useState("all");
  const [notifActionUrl, setNotifActionUrl] = useState("");
  const [deliveryChannel, setDeliveryChannel] = useState("both"); // 'both' | 'in_app' | 'push_only'
  const [priority, setPriority] = useState("high"); // 'high' (sound) | 'normal' (silent)
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState<string | null>(null);
  const [recentNotifs, setRecentNotifs] = useState<AdminNotification[]>([]);

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

      const hasAdmin = profile?.role === "admin";
      setIsAdmin(hasAdmin);

      if (hasAdmin) {
        loadAdminData();
      }
    } finally {
      setChecking(false);
    }
  }, []);

  const loadAdminData = async () => {
    // 1. Stats
    const { data: users } = await supabase
      .from("users")
      .select("target_exam, class_level");

    if (users) {
      setStats({
        totalUsers: users.length,
        jeeUsers: users.filter((u) => u.target_exam === "JEE").length,
        neetUsers: users.filter((u) => u.target_exam === "NEET").length,
        boardsOnly: users.filter((u) => u.target_exam === "BOARDS").length,
      });
    }

    // 2. Schedule
    const { data: schedules } = await supabase
      .from("exam_schedules")
      .select("*")
      .order("year", { ascending: true });

    if (schedules) {
      setSchedule(schedules);
      if (schedules.length > 0 && !selectedScheduleId) {
        setSelectedScheduleId(schedules[0].id);
      }
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

    // 4. Notifications History
    loadNotifications();
  };

  const loadNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setRecentNotifs(data);
  };

  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  // Auth Submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuthNotice("Account created. Check email if confirmation is required.");
      }
      checkAdminStatus();
    } catch (err: any) {
      setAuthError(err?.message ?? "Authentication failed");
    } finally {
      setAuthBusy(false);
    }
  };

  // Broadcast Notification (In-App + Firebase FCM)
  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) return;
    setSendingNotif(true);
    setNotifSuccess(null);

    try {
      // 1. Insert into Supabase if In-App is selected
      if (deliveryChannel === "both" || deliveryChannel === "in_app") {
        const { error } = await supabase.from("notifications").insert({
          title: notifTitle.trim(),
          body: notifBody.trim(),
          target_audience: notifAudience,
          action_url: notifActionUrl.trim() || null,
        });
        if (error) throw error;
      }

      // 2. Trigger Firebase Push API Route if Push is selected
      if (deliveryChannel === "both" || deliveryChannel === "push_only") {
        await fetch("/api/admin/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
      loadNotifications();
    } catch (err: any) {
      alert("Failed to broadcast notification: " + err.message);
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

  // Save Exam Date
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

  // Add Shift
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
        <div className="w-full max-w-sm rounded-ticket border border-ink/10 bg-white p-6 shadow-sm">
          <h1 className="font-display text-xl font-bold mb-1">Admin Portal</h1>
          <p className="text-xs text-slate mb-4">
            {session
              ? "Access denied. Your account does not have the admin role."
              : "Sign in with admin credentials to access."}
          </p>

          {!session && (
            <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Admin email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-ink/15 p-2.5 text-xs font-semibold"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-ink/15 p-2.5 text-xs font-semibold"
                required
              />
              {authError && (
                <p className="text-xs text-rose-600 font-medium">{authError}</p>
              )}
              {authNotice && (
                <p className="text-xs text-teal font-medium">{authNotice}</p>
              )}
              <button
                type="submit"
                disabled={authBusy}
                className="bg-teal text-white rounded-xl py-2.5 text-xs font-bold shadow-xs hover:bg-teal/90 disabled:opacity-40"
              >
                {authBusy ? "Verifying…" : "Sign In as Admin"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-24">
      {/* Header */}
      <header className="border-b border-ink/8 bg-white px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">
              Admin Console
            </h1>
            <p className="text-xs text-slate mt-0.5">
              PrepWise Operations & Notifications Center
            </p>
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => setSession(false))}
            className="text-xs text-rose-600 font-bold hover:underline"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 pt-6 flex flex-col gap-8">
        {/* 1. STATS SECTION */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Aspirants" value={stats.totalUsers} />
            <StatCard label="JEE Students" value={stats.jeeUsers} />
            <StatCard label="NEET Students" value={stats.neetUsers} />
            <StatCard label="Boards Only" value={stats.boardsOnly} />
          </div>
        )}

        {/* 2. 📢 BROADCAST PUSH NOTIFICATION SECTION */}
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

          {/* Recent Sent Notifications */}
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

        {/* 3. EXAM DATES & SHIFTS */}
        <section className="rounded-ticket border border-ink/10 bg-white p-6 shadow-xs">
          <h2 className="font-display text-lg font-bold mb-3">
            Exam Schedules & Shifts
          </h2>
          <div className="space-y-4">
            {schedule.map((row) => (
              <div
                key={row.id}
                className="p-3.5 rounded-xl bg-paper/60 border border-ink/8 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div>
                  <h4 className="text-xs font-bold text-ink">{row.label}</h4>
                  <p className="text-[10px] text-slate">
                    {row.target_exam} {row.year} • Key: {row.exam_key}
                  </p>
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
                    className="px-3 py-1.5 bg-ink text-paper rounded-lg text-xs font-bold hover:bg-ink-100"
                  >
                    {savingId === row.id ? "…" : "Save"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. RESOURCE UPLOADER */}
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
