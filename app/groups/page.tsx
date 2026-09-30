// app/groups/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/dashboard/AppHeader";
import BottomNav from "@/components/dashboard/BottomNav";

interface GroupRow {
  id: string;
  name: string;
  target_exam: string;
  member_count: number;
  goal_hours: number | null;
  leader_name: string | null;
  created_at: string | null;
}

function daysAgo(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

export default function GroupsListPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [myJoinedGroupIds, setMyJoinedGroupIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupExam, setNewGroupExam] = useState("JEE");
  const [newGroupPasscode, setNewGroupPasscode] = useState("");
  const [newGroupGoalHours, setNewGroupGoalHours] = useState("6");
  const [newGroupRules, setNewGroupRules] = useState("");

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinTargetId, setJoinTargetId] = useState("");
  const [enteredPasscode, setEnteredPasscode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;
      setCurrentUser(user);

      const { data: memberRows } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);
      setMyJoinedGroupIds((memberRows ?? []).map((m) => m.group_id));

      const { data: dbGroups } = await supabase.rpc("get_group_list");
      setGroups(
        (dbGroups ?? []).map((g: any) => ({
          id: g.id,
          name: g.name,
          target_exam: g.target_exam,
          goal_hours: g.goal_hours,
          leader_name: g.leader_name,
          created_at: g.created_at,
          member_count: Number(g.member_count) || 0,
        }))
      );
      setLoading(false);
    }
    init();
  }, []);

  const myGroups = groups.filter((g) => myJoinedGroupIds.includes(g.id));
  const otherGroups = groups.filter((g) => !myJoinedGroupIds.includes(g.id));

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupPasscode.trim()) return;

    const { data: inserted, error } = await supabase
      .from("study_groups")
      .insert({
        name: newGroupName.trim(),
        target_exam: newGroupExam,
        passcode: newGroupPasscode.trim(),
        created_by: currentUser?.id ?? null,
        goal_hours: newGroupGoalHours ? Number(newGroupGoalHours) : null,
        rules: newGroupRules.trim() || null,
      })
      .select("id")
      .single();

    if (error || !inserted) return;

    setShowCreateModal(false);
    setNewGroupName("");
    setNewGroupPasscode("");
    setNewGroupGoalHours("6");
    setNewGroupRules("");
    router.push(`/groups/${inserted.id}`);
  }

  async function handleVerifyAndJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinTargetId) {
      setJoinError("Pick a group first.");
      return;
    }

    setJoining(true);
    setJoinError(null);

    const { data: isCorrect, error } = await supabase.rpc("verify_group_passcode", {
      p_group_id: joinTargetId,
      p_passcode: enteredPasscode.trim(),
    });

    setJoining(false);

    if (error || !isCorrect) {
      setJoinError("Incorrect passcode! Ask group admin.");
      return;
    }

    const senderName =
      currentUser?.user_metadata?.full_name || currentUser?.email?.split("@")[0] || "Student";
    await supabase.from("group_messages").insert({
      group_id: joinTargetId,
      sender_uid: null,
      sender_name: "System",
      content: `${senderName} joined the room`,
    });

    router.push(`/groups/${joinTargetId}`);
  }

  return (
    <div className="min-h-screen bg-paper pb-28">
      <AppHeader />

      <main className="max-w-md mx-auto px-5 pt-4 flex flex-col gap-5">
        <div>
          <h1 className="font-display text-2xl text-ink">Study Groups</h1>
          <p className="text-[11px] text-slate mt-0.5">Study together, stay accountable</p>
        </div>

        {loading ? (
          <p className="text-center py-10 text-xs text-slate">Loading groups…</p>
        ) : (
          <>
            {myGroups.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate mb-2 px-1">My Groups</p>
                <div className="space-y-2.5">
                  {myGroups.map((grp) => (
                    <GroupCard key={grp.id} grp={grp} joined onOpen={() => router.push(`/groups/${grp.id}`)} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-bold text-slate mb-2 px-1">All Groups</p>
              {otherGroups.length === 0 ? (
                <p className="text-xs text-slate px-1">No other groups yet — create one!</p>
              ) : (
                <div className="space-y-2.5">
                  {otherGroups.map((grp) => (
                    <GroupCard
                      key={grp.id}
                      grp={grp}
                      joined={false}
                      onOpen={() => router.push(`/groups/${grp.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              setJoinTargetId(otherGroups[0]?.id ?? "");
              setEnteredPasscode("");
              setJoinError(null);
              setShowJoinModal(true);
            }}
            className="flex-1 py-3 rounded-xl border border-ink/15 text-ink font-bold text-xs hover:bg-ink/5"
          >
            🔑 Join Group
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 py-3 rounded-xl bg-teal text-white font-bold text-xs shadow-xs hover:bg-teal/90"
          >
            + Create Group
          </button>
        </div>
      </main>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <h3 className="text-sm font-bold text-ink">Create Study Group</h3>
              <button onClick={() => setShowCreateModal(false)} className="w-6 h-6 rounded-full bg-ink/5 text-xs">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">Group Name</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">Target Exam</label>
                <select
                  value={newGroupExam}
                  onChange={(e) => setNewGroupExam(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 bg-white"
                >
                  <option>JEE</option>
                  <option>NEET</option>
                  <option>Boards</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">Daily Goal (hours)</label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={newGroupGoalHours}
                  onChange={(e) => setNewGroupGoalHours(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">Rules (optional)</label>
                <textarea
                  value={newGroupRules}
                  onChange={(e) => setNewGroupRules(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 text-xs rounded-xl border border-ink/15 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">Passcode</label>
                <input
                  type="text"
                  value={newGroupPasscode}
                  onChange={(e) => setNewGroupPasscode(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-ink/10 text-xs font-semibold text-slate"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-teal text-white text-xs font-bold">
                  Create & Enter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <h3 className="text-sm font-bold text-ink">Join a Group</h3>
              <button onClick={() => setShowJoinModal(false)} className="w-6 h-6 rounded-full bg-ink/5 text-xs">
                ✕
              </button>
            </div>
            {joinError && (
              <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200">
                ⚠️ {joinError}
              </p>
            )}
            <form onSubmit={handleVerifyAndJoin} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">Group</label>
                <select
                  value={joinTargetId}
                  onChange={(e) => setJoinTargetId(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 bg-white"
                >
                  {otherGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">Passcode</label>
                <input
                  type="password"
                  value={enteredPasscode}
                  onChange={(e) => setEnteredPasscode(e.target.value)}
                  className="w-full p-2.5 text-xs text-center font-bold tracking-widest rounded-xl border border-ink/15"
                  required
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-ink/10 text-xs font-semibold text-slate"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="flex-1 py-2.5 rounded-xl bg-teal text-white text-xs font-bold disabled:opacity-50"
                >
                  {joining ? "Checking…" : "Verify & Join"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

function GroupCard({ grp, joined, onOpen }: { grp: GroupRow; joined: boolean; onOpen: () => void }) {
  const started = daysAgo(grp.created_at);
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-white rounded-ticket border border-ink/10 p-4 shadow-2xs flex items-center justify-between gap-3"
    >
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9.5px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            {grp.target_exam}
          </span>
          <h4 className="font-bold text-xs text-ink">{grp.name}</h4>
        </div>
        <p className="text-[10px] text-slate mt-1">
          {grp.member_count} member{grp.member_count === 1 ? "" : "s"}
          {grp.leader_name && ` · Led by ${grp.leader_name}`}
        </p>
        {started && <p className="text-[9px] text-slate/70 mt-0.5">Started {started}</p>}
      </div>
      <span className="text-xs font-bold text-teal shrink-0">
        {joined ? "Open →" : "View →"}
      </span>
    </button>
  );
}
