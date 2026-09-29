// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/dashboard/BottomNav";
import AiMentorCard from "@/components/dashboard/AiMentorCard";
import AiChatSheet from "@/components/dashboard/AiChatSheet";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // AI Mentor & Doubt state
  const [mentorReport, setMentorReport] = useState<any>(null);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [doubtOpen, setDoubtOpen] = useState(false);

  // Quick stats
  const [stats, setStats] = useState({
    todayHours: 0,
    streak: 0,
    backlogs: 0,
  });

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }
      setUser(session.user);

      // Fetch user profile
      const { data: uProf } = await supabase
        .from("users")
        .select("*")
        .eq("uid", session.user.id)
        .maybeSingle();

      if (uProf) {
        setProfile(uProf);
        fetchMentorReport(session.user.id);
      }

      // Quick Stats
      const today = new Date().toISOString().split("T")[0];
      const [{ data: logs }, { data: backlogs }] = await Promise.all([
        supabase.from("daily_logs").select("study_time_minutes, streak_count").eq("user_id", session.user.id).eq("log_date", today).maybeSingle(),
        supabase.from("tasks").select("id").eq("user_id", session.user.id).eq("task_type", "backlog").neq("status", "completed"),
      ]);

      setStats({
        todayHours: logs?.study_time_minutes ? Number((logs.study_time_minutes / 60).toFixed(1)) : 0,
        streak: logs?.streak_count || 0,
        backlogs: backlogs?.length || 0,
      });

      setLoading(false);
    }

    loadData();
  }, [router]);

  const fetchMentorReport = async (uid: string, force = false) => {
    setMentorLoading(true);
    try {
      const res = await fetch("/api/ai-mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, forceRefresh: force }),
      });
      if (res.ok) {
        const json = await res.json();
        setMentorReport(json.report);
      }
    } catch (e) {
      console.error("Mentor fetch error:", e);
    } finally {
      setMentorLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-xs font-bold text-slate">
        <span className="animate-spin mr-2">⏳</span> Loading PrepWise Dashboard…
      </div>
    );
  }

  const studentName = profile?.name || user?.user_metadata?.full_name?.split(" ")[0] || "Aspirant";
  const targetExam = profile?.target_exam || "JEE";
  const targetYear = profile?.target_year || "2027";

  return (
    <div className="min-h-screen bg-paper/30 pb-28 text-ink">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-ink/8 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-teal text-white flex items-center justify-center font-black text-xs shadow-xs">
              PW
            </span>
            <div>
              <h1 className="text-xs font-black tracking-tight text-ink leading-none">PrepWise</h1>
              <span className="text-[10px] font-bold text-slate">Target: {targetExam} {targetYear}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Streak Counter */}
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/80 px-2 py-1 rounded-xl text-amber-800 text-[11px] font-black">
              <span>🔥</span>
              <span>{stats.streak}d</span>
            </div>

            {/* Profile Avatar */}
            <div className="w-7 h-7 rounded-full bg-ink text-paper flex items-center justify-center text-xs font-bold shadow-2xs">
              {studentName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Welcome Salutation */}
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate">Welcome back,</p>
            <h2 className="text-lg font-black tracking-tight text-ink">{studentName}</h2>
          </div>
          <span className="text-[10px] font-black bg-ink/5 text-slate px-2 py-0.5 rounded-md">
            Phase 1 Foundation
          </span>
        </div>

        {/* 1. COMPACT AI MENTOR CARD (With direct Ask Doubt button) */}
        <AiMentorCard
          userId={user?.id}
          report={mentorReport}
          loading={mentorLoading}
          onRefresh={() => fetchMentorReport(user?.id, true)}
          onOpenDoubtSolver={() => setDoubtOpen(true)}
        />

        {/* 2. THREE-PILLAR QUICK METRICS */}
        <div className="grid grid-cols-3 gap-2">
          {/* Today's Study Time */}
          <div className="bg-white p-3 rounded-2xl border border-ink/8 shadow-2xs">
            <span className="text-[10px] font-bold text-slate block mb-1">Today Study</span>
            <div className="text-base font-black text-ink">{stats.todayHours}<span className="text-[10px] font-normal text-slate">h</span></div>
            <span className="text-[9.5px] font-bold text-emerald-600 block mt-0.5">Target: 6.0h</span>
          </div>

          {/* Pending Backlogs */}
          <div className="bg-white p-3 rounded-2xl border border-ink/8 shadow-2xs">
            <span className="text-[10px] font-bold text-slate block mb-1">Backlogs</span>
            <div className="text-base font-black text-ink">{stats.backlogs}</div>
            <span className={`text-[9.5px] font-bold block mt-0.5 ${stats.backlogs > 0 ? "text-rose-500" : "text-slate"}`}>
              {stats.backlogs > 0 ? "Needs Clear" : "All Clear ✓"}
            </span>
          </div>

          {/* Quick Timer Trigger */}
          <button
            type="button"
            onClick={() => router.push("/study")}
            className="bg-teal/10 hover:bg-teal/20 border border-teal/20 p-3 rounded-2xl text-left transition-all active:scale-[0.98]"
          >
            <span className="text-[10px] font-bold text-teal block mb-1">Study Tab</span>
            <div className="text-sm font-black text-teal">Start Timer</div>
            <span className="text-[9.5px] font-bold text-teal/80 block mt-0.5">⏱ 90m Slot</span>
          </button>
        </div>

        {/* 3. DAILY STUDY PROTOCOL BANNER */}
        <div className="rounded-2xl p-3.5 bg-ink text-paper flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[10px] font-bold text-paper/60 uppercase tracking-wider">Kota Golden Rule</div>
            <div className="text-xs font-black text-paper mt-0.5">1 hr Lecture = 1.5 hr Question DPPs</div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/test")}
            className="text-[11px] font-bold bg-white text-ink px-3 py-1.5 rounded-xl hover:bg-paper active:scale-95 transition-all shadow-2xs flex-shrink-0"
          >
            Log Marks 📝
          </button>
        </div>
      </main>

      {/* Persistent AI Doubt Solver Modal Sheet */}
      <AiChatSheet
        open={doubtOpen}
        onClose={() => setDoubtOpen(false)}
      />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
