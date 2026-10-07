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
  has_password: boolean;
  requires_approval: boolean;
}

interface PendingRow {
  request_id: string;
  group_id: string;
  group_name: string;
  target_exam: string;
}

function daysAgo(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

function JoinTypeTag({ hasPassword, requiresApproval }: { hasPassword: boolean; requiresApproval: boolean }) {
  if (hasPassword) {
    return (
      <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
        🔒 Password
      </span>
    );
  }
  if (requiresApproval) {
    return (
      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
        🛡️ Approval Required
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
      ✅ Open Join
    </span>
  );
}

export default function GroupsListPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [myJoinedGroupIds, setMyJoinedGroupIds] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupExam, setNewGroupExam] = useState("All");
  const [newGroupHasPassword, setNewGroupHasPassword] = useState(true);
  const [newGroupPasscode, setNewGroupPasscode] = useState("");
  const [newGroupRequiresApproval, setNewGroupRequiresApproval] = useState(false);
  const [newGroupGoalHours, setNewGroupGoalHours] = useState("6");
  const [newGroupRules, setNewGroupRules] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinTargetId, setJoinTargetId] = useState("");
  const [enteredPasscode, setEnteredPasscode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function loadPending(userId: string) {
    const { data } = await supabase.rpc("get_my_pending_requests", { p_user_id: userId });
    setPendingRequests(
      (data ?? []).map((r: any) => ({
        request_id: r.request_id,
        group_id: r.group_id,
        group_name: r.group_name,
        target_exam: r.target_exam,
      }))
    );
  }

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
      const { data: metaRows } = await supabase.rpc("get_group_join_meta");
      const metaById = new Map<string, { has_password: boolean; requires_approval: boolean }>();
      (metaRows ?? []).forEach((m: any) => {
        metaById.set(m.group_id, { has_password: m.has_password, requires_approval: m.requires_approval });
      });

      setGroups(
        (dbGroups ?? []).map((g: any) => {
          const meta = metaById.get(g.id) ?? { has_password: true, requires_approval: false };
          return {
            id: g.id,
            name: g.name,
            target_exam: g.target_exam,
            goal_hours: g.goal_hours,
            leader_name: g.leader_name,
            created_at: g.created_at,
            member_count: Number(g.member_count) || 0,
            has_password: meta.has_password,
            requires_approval: meta.requires_approval,
          };
        })
      );

      await loadPending(user.id);
      setLoading(false);
    }
    init();
  }, []);

  const myGroups = groups.filter((g) => myJoinedGroupIds.includes(g.id));
  const otherGroups = groups.filter(
    (g) => !myJoinedGroupIds.includes(g.id) && !pendingRequests.some((p) => p.group_id === g.id)
  );

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const trimmedName = newGroupName.trim();
    if (!trimmedName) return;
    if (newGroupHasPassword && !newGroupPasscode.trim()) return;

    const nameExistsLocally = groups.some(
      (g) => g.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (nameExistsLocally) {
      setCreateError("A group with this name already exists. Please choose a different name.");
      return;
    }

    setCreating(true);

    try {
      const { data: existingGroup } = await supabase
        .from("study_groups")
        .select("id")
        .ilike("name", trimmedName)
        .maybeSingle();

      if (existingGroup) {
        setCreateError("A group with this name already exists. Please choose a different name.");
        setCreating(false);
        return;
      }
    } catch (_) {}

    const { data: inserted, error } = await supabase
      .from("study_groups")
      .insert({
        name: trimmedName,
        target_exam: newGroupExam,
        passcode: newGroupHasPassword ? newGroupPasscode.trim() : null,
        requires_approval: newGroupHasPassword ? false : newGroupRequiresApproval,
        created_by: currentUser?.id ?? null,
        goal_hours: newGroupGoalHours ? Number(newGroupGoalHours) : null,
        rules: newGroupRules.trim() || null,
      })
      .select("id")
      .single();

    setCreating(false);

    if (error || !inserted) {
      setCreateError(error?.message || "Failed to create group. Please try again.");
      return;
    }

    setShowCreateModal(false);
    setNewGroupName("");
    setNewGroupExam("All");
    setNewGroupHasPassword(true);
    setNewGroupPasscode("");
    setNewGroupRequiresApproval(false);
    setNewGroupGoalHours("6");
    setNewGroupRules("");
    router.push(`/groups/${inserted.id}`);
  }

  async function handleRequestJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinTargetId || !currentUser) {
      setJoinError("Pick a group first.");
      return;
    }
    const target = groups.find((g) => g.id === joinTargetId);
    if (!target) return;

    setJoining(true);
    setJoinError(null);
    setJoinNotice(null);

    const { data: result, error } = await supabase.rpc("request_join_group", {
      p_group_id: joinTargetId,
      p_user_id: currentUser.id,
      p_passcode: target.has_password ? enteredPasscode.trim() : null,
    });

    setJoining(false);

    if (error) {
      setJoinError("Something went wrong. Try again.");
      return;
    }
    if (result === "wrong_passcode") {
      setJoinError("Incorrect passcode! Ask group admin.");
      return;
    }
    if (result === "already_member") {
      setJoinError("You're already in this group.");
      return;
    }
    if (result === "pending") {
      const senderName =
        currentUser?.user_metadata?.full_name || currentUser?.email?.split("@")[0] || "Student";
      setJoinNotice(`Request sent! ${senderName}'s join request is waiting for admin approval.`);
      await loadPending(currentUser.id);
      return;
    }
    if (result === "joined") {
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
  }

  async function handleCancelPending(groupId: string) {
    if (!currentUser) return;
    await supabase.rpc("cancel_join_request", { p_group_id: groupId, p_user_id: currentUser.id });
    await loadPending(currentUser.id);
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
          <div>
            <p className="text-xs font-bold text-slate mb-2 px-1">My Groups</p>

            <div className="space-y-2.5">
              {pendingRequests.map((p) => (
                <PendingGroupCard
                  key={p.request_id}
                  pending={p}
                  onOpen={() => router.push(`/groups/${p.group_id}`)}
                  onCancel={() => handleCancelPending(p.group_id)}
                />
              ))}

              {myGroups.map((grp) => (
                <GroupCard key={grp.id} grp={grp} joined onOpen={() => router.push(`/groups/${grp.id}`)} />
              ))}

              {myGroups.length === 0 && pendingRequests.length === 0 && (
                <p className="text-xs text-slate px-1 py-2">You haven't joined any groups yet.</p>
              )}
            </div>

            {/* Join & Create buttons — right below the last group card */}
            <div className="flex gap-2 pt-3">
              <button
                onClick={() => {
                  setJoinTargetId(otherGroups[0]?.id ?? "");
                  setEnteredPasscode("");
                  setJoinError(null);
                  setJoinNotice(null);
                  setShowJoinModal(true);
                }}
                className="flex-1 py-3 rounded-xl border border-ink/15 text-ink font-bold text-xs hover:bg-ink/5"
              >
                🔑 Join Group
              </button>
              <button
                onClick={() => {
                  setCreateError(null);
                  setShowCreateModal(true);
                }}
                className="flex-1 py-3 rounded-xl bg-teal text-white font-bold text-xs shadow-xs hover:bg-teal/90"
              >
                + Create Group
              </button>
            </div>
          </div>
        )}
      </main>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <h3 className="text-sm font-bold text-ink">Create Study Group</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError(null);
                }}
                className="w-6 h-6 rounded-full bg-ink/5 text-xs"
              >
                ✕
              </button>
            </div>

            {createError && (
              <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                ⚠️ {createError}
              </p>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">Group Name</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => {
                    setNewGroupName(e.target.value);
                    if (createError) setCreateError(null);
                  }}
                  placeholder="e.g. Daily Study Squad"
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
                  <option>All</option>
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
                  placeholder="e.g. Maintain streak daily"
                  className="w-full p-2.5 text-xs rounded-xl border border-ink/15 resize-none"
                />
              </div>

              <div className="pt-1 border-t border-ink/8">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-[11px] font-bold text-ink">Password protected</p>
                    <p className="text-[9.5px] text-slate">
                      {newGroupHasPassword
                        ? "Members need a passcode to join."
                        : "No passcode — anyone can try to join."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewGroupHasPassword((v) => !v);
                      setNewGroupRequiresApproval(false);
                    }}
                    className={`w-11 h-6 rounded-full shrink-0 transition-colors relative ${
                      newGroupHasPassword ? "bg-teal" : "bg-ink/15"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        newGroupHasPassword ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {newGroupHasPassword ? (
                  <div>
                    <label className="text-[10px] font-bold text-slate block mb-0.5">Passcode</label>
                    <input
                      type="text"
                      value={newGroupPasscode}
                      onChange={(e) => setNewGroupPasscode(e.target.value)}
                      placeholder="e.g. 1234"
                      className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15"
                      required
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-2">
                    <div className="pr-2">
                      <p className="text-[11px] font-bold text-ink">Creator verification needed</p>
                      <p className="text-[9.5px] text-slate">
                        {newGroupRequiresApproval
                          ? "New users can only join if you verify their request"
                          : "New users can directly join the group"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewGroupRequiresApproval((v) => !v)}
                      className={`w-11 h-6 rounded-full shrink-0 transition-colors relative ${
                        newGroupRequiresApproval ? "bg-teal" : "bg-ink/15"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          newGroupRequiresApproval ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-ink/10 text-xs font-semibold text-slate"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl bg-teal text-white text-xs font-bold disabled:opacity-50"
                >
                  {creating ? "Checking…" : "Create & Enter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-3 max-h-[90vh] overflow-y-auto">
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
            {joinNotice && (
              <p className="text-xs text-amber-700 font-bold bg-amber-50 p-2 rounded-lg border border-amber-200">
                ⏳ {joinNotice}
              </p>
            )}

            <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
              {otherGroups.length === 0 ? (
                <p className="text-xs text-slate px-1 py-3 text-center">No groups to join right now.</p>
              ) : (
                otherGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setJoinTargetId(g.id);
                      setEnteredPasscode("");
                      setJoinError(null);
                      setJoinNotice(null);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                      joinTargetId === g.id ? "border-teal bg-teal/5" : "border-ink/10"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-ink">{g.name}</p>
                      <p className="text-[9.5px] text-slate">{g.member_count} members · {g.target_exam}</p>
                    </div>
                    <JoinTypeTag hasPassword={g.has_password} requiresApproval={g.requires_approval} />
                  </button>
                ))
              )}
            </div>

            {joinTargetId && (
              <form onSubmit={handleRequestJoin} className="space-y-3 pt-1 border-t border-ink/8">
                {groups.find((g) => g.id === joinTargetId)?.has_password && (
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
                )}
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
                    {joining ? "Checking…" : "Join"}
                  </button>
                </div>
              </form>
            )}
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
          <JoinTypeTag hasPassword={grp.has_password} requiresApproval={grp.requires_approval} />
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

function PendingGroupCard({
  pending,
  onOpen,
  onCancel,
}: {
  pending: PendingRow;
  onOpen: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="w-full bg-amber-50/60 rounded-ticket border border-amber-200 p-4 shadow-2xs">
      <button onClick={onOpen} className="w-full text-left flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9.5px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
              {pending.target_exam}
            </span>
            <h4 className="font-bold text-xs text-ink">{pending.group_name}</h4>
          </div>
          <p className="text-[10px] font-bold text-amber-700 mt-1">
            ⏳ Your join request is pending, waiting for admin approval
          </p>
        </div>
      </button>
      <button
        onClick={onCancel}
        className="mt-2 text-[10px] font-bold text-rose-600 underline"
      >
        Cancel request
      </button>
    </div>
  );
}
