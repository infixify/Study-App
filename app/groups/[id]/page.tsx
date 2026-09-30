// app/groups/[id]/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import StudyRoomPanel from "@/components/groups/StudyRoomPanel";

type Tab = "home" | "chat" | "cam" | "members";
type MembershipStatus = "loading" | "member" | "pending" | "none";

interface Message {
  id: string;
  sender_name: string;
  sender_uid: string | null;
  content: string;
  created_at: string;
}

interface MemberFull {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_leader: boolean;
  is_live: boolean;
  today_seconds: number;
  week_seconds: number;
  attendance_days: number;
  joined_at: string;
}

function formatHM(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function Avatar({ url, name, size = 36 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0"
      />
    );
  }
  const initial = (name || "?").trim()[0]?.toUpperCase() || "?";
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-teal/20 text-teal font-bold flex items-center justify-center shrink-0"
    >
      {initial}
    </div>
  );
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

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params?.id as string;

  const [tab, setTab] = useState<Tab>("home");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [groupInfo, setGroupInfo] = useState<{
    name: string;
    target_exam: string;
    leader_name: string | null;
    created_by: string | null;
    rules: string | null;
  } | null>(null);

  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>("loading");
  const [joinMeta, setJoinMeta] = useState<{ has_password: boolean; requires_approval: boolean }>({
    has_password: true,
    requires_approval: false,
  });

  const [members, setMembers] = useState<MemberFull[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(true);

  const [selectedMember, setSelectedMember] = useState<MemberFull | null>(null);

  const [pendingRequests, setPendingRequests] = useState<
    { request_id: string; user_id: string; user_name: string; user_avatar: string | null; requested_at: string }[]
  >([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const [joinPasscode, setJoinPasscode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;
      setCurrentUser(user);

      const { data: adminCheck } = await supabase.rpc("is_admin");
      if (adminCheck) setIsAdmin(true);

      const { data: dbGroups } = await supabase.rpc("get_group_list");
      const thisGroup = (dbGroups ?? []).find((g: any) => g.id === groupId);

      const { data: ruleRow } = await supabase
        .from("study_groups")
        .select("rules")
        .eq("id", groupId)
        .single();

      if (thisGroup) {
        setGroupInfo({
          name: thisGroup.name,
          target_exam: thisGroup.target_exam,
          leader_name: thisGroup.leader_name,
          created_by: null,
          rules: ruleRow?.rules ?? null,
        });
      }

      const { data: metaRows } = await supabase.rpc("get_group_join_meta");
      const thisMeta = (metaRows ?? []).find((m: any) => m.group_id === groupId);
      if (thisMeta) {
        setJoinMeta({ has_password: thisMeta.has_password, requires_approval: thisMeta.requires_approval });
      }

      const { data: memberRow } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberRow) {
        setMembershipStatus("member");
        return;
      }

      const { data: pendingRow } = await supabase
        .from("group_join_requests")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();

      setMembershipStatus(pendingRow ? "pending" : "none");
    }
    init();
  }, [groupId]);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    const [{ data: memberData }, { data: progressData }] = await Promise.all([
      supabase.rpc("get_group_members_full", { p_group_id: groupId }),
      supabase.rpc("get_group_progress", { p_group_id: groupId }),
    ]);
    setMembers((memberData as MemberFull[]) ?? []);
    const progMap: Record<string, number> = {};
    (progressData ?? []).forEach((p: any) => {
      progMap[p.user_id] = p.pct_done;
    });
    setProgress(progMap);
    setLoadingMembers(false);
  }, [groupId]);

  useEffect(() => {
    if (membershipStatus === "loading") return;
    loadMembers();
    if (membershipStatus === "member") {
      const interval = setInterval(loadMembers, 20000);
      return () => clearInterval(interval);
    }
  }, [loadMembers, membershipStatus]);

  const loadMessages = useCallback(async () => {
    setLoadingMessages(true);
    const { data } = await supabase
      .from("group_messages")
      .select("id, sender_name, sender_uid, content, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages(
      (data ?? []).map((m) => ({
        ...m,
        created_at: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }))
    );
    setLoadingMessages(false);
  }, [groupId]);

  useEffect(() => {
    if (tab === "chat" && membershipStatus === "member") loadMessages();
  }, [tab, loadMessages, membershipStatus]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    const senderName =
      currentUser?.user_metadata?.full_name || currentUser?.email?.split("@")[0] || "Student";

    const optimistic: Message = {
      id: Date.now().toString(),
      sender_name: senderName,
      sender_uid: currentUser?.id ?? null,
      content: inputMsg.trim(),
      created_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInputMsg("");

    await supabase.from("group_messages").insert({
      group_id: groupId,
      sender_uid: currentUser?.id ?? null,
      sender_name: senderName,
      content: optimistic.content,
    });
  }

  async function handleDeleteMessage(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    await supabase.from("group_messages").delete().eq("id", id);
  }

  async function handleLeaveGroup() {
    await supabase.rpc("leave_group", { p_group_id: groupId });
    router.push("/groups");
  }

  async function handleCancelPending() {
    if (!currentUser) return;
    await supabase.rpc("cancel_join_request", { p_group_id: groupId, p_user_id: currentUser.id });
    router.push("/groups");
  }

  async function handleJoinFromPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setJoining(true);
    setJoinError(null);
    setJoinNotice(null);

    const { data: result, error } = await supabase.rpc("request_join_group", {
      p_group_id: groupId,
      p_user_id: currentUser.id,
      p_passcode: joinMeta.has_password ? joinPasscode.trim() : null,
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
    if (result === "pending") {
      setMembershipStatus("pending");
      setJoinNotice("Request sent! Waiting for admin approval.");
      return;
    }
    if (result === "joined") {
      const senderName =
        currentUser?.user_metadata?.full_name || currentUser?.email?.split("@")[0] || "Student";
      await supabase.from("group_messages").insert({
        group_id: groupId,
        sender_uid: null,
        sender_name: "System",
        content: `${senderName} joined the room`,
      });
      setMembershipStatus("member");
    }
  }

  async function handleRemoveMember(userId: string) {
    await supabase.rpc("remove_group_member", { p_group_id: groupId, p_target_user_id: userId });
    setSelectedMember(null);
    loadMembers();
  }

  const loadPendingRequests = useCallback(async () => {
    if (!currentUser) return;
    setLoadingPending(true);
    const { data } = await supabase.rpc("get_pending_requests", {
      p_group_id: groupId,
      p_creator_id: currentUser.id,
    });
    setPendingRequests(
      (data ?? []).map((r: any) => ({
        request_id: r.request_id,
        user_id: r.user_id,
        user_name: r.user_name,
        user_avatar: r.user_avatar,
        requested_at: r.requested_at,
      }))
    );
    setLoadingPending(false);
  }, [groupId, currentUser]);

  async function handleApproveRequest(requestId: string) {
    if (!currentUser) return;
    await supabase.rpc("approve_join_request", { p_request_id: requestId, p_creator_id: currentUser.id });
    setPendingRequests((prev) => prev.filter((r) => r.request_id !== requestId));
    loadMembers();
  }

  async function handleRejectRequest(requestId: string) {
    if (!currentUser) return;
    await supabase.rpc("reject_join_request", { p_request_id: requestId, p_creator_id: currentUser.id });
    setPendingRequests((prev) => prev.filter((r) => r.request_id !== requestId));
  }

  const isLeader = currentUser && members.some((m) => m.user_id === currentUser.id && m.is_leader);
  const canManage = isAdmin || isLeader;

  useEffect(() => {
    if (tab === "members" && canManage && membershipStatus === "member") loadPendingRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, canManage, membershipStatus]);

  const overallProgress = members.length
    ? Math.round(
        members.reduce((sum, m) => sum + (progress[m.user_id] ?? 0), 0) / members.length
      )
    : 0;
  const overallAttendance = members.length
    ? Math.round(
        (members.reduce((sum, m) => sum + m.attendance_days, 0) / (members.length * 7)) * 100
      )
    : 0;
  const totalWeekSeconds = members.reduce((sum, m) => sum + m.week_seconds, 0);
  const maxWeekSeconds = Math.max(1, ...members.map((m) => m.week_seconds));

  if (membershipStatus === "loading") {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-xs text-slate">Loading…</p>
      </div>
    );
  }

  // ---------- PREVIEW (not a member): pending OR not-yet-requested ----------
  if (membershipStatus !== "member") {
    return (
      <div className="min-h-screen bg-paper pb-10 flex flex-col">
        <div className="sticky top-0 z-20 bg-paper/95 backdrop-blur border-b border-ink/8">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => router.push("/groups")}
              className="w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center text-ink font-bold"
            >
              ←
            </button>
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-ink truncate">{groupInfo?.name || "Group"}</h1>
              {groupInfo?.target_exam && <p className="text-[10px] text-slate">{groupInfo.target_exam}</p>}
            </div>
          </div>
        </div>

        <main className="max-w-md mx-auto w-full px-4 pt-4 flex-1 flex flex-col gap-4">
          {membershipStatus === "pending" && (
            <div className="bg-amber-50 border border-amber-200 rounded-ticket p-4">
              <p className="text-xs font-bold text-amber-700">
                ⏳ Your join request is pending, waiting for admin approval
              </p>
              <button
                onClick={handleCancelPending}
                className="mt-2 text-[10px] font-bold text-rose-600 underline"
              >
                Cancel request
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <JoinTypeTag hasPassword={joinMeta.has_password} requiresApproval={joinMeta.requires_approval} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-ticket border border-ink/10 p-3 text-center">
              <p className="text-lg font-bold text-teal">{overallAttendance}%</p>
              <p className="text-[10px] text-slate">Group attendance (7d)</p>
            </div>
            <div className="bg-white rounded-ticket border border-ink/10 p-3 text-center">
              <p className="text-lg font-bold text-teal">{formatHM(totalWeekSeconds)}</p>
              <p className="text-[10px] text-slate">Total study time (week)</p>
            </div>
          </div>

          <div className="bg-white rounded-ticket border border-ink/10 p-4">
            <p className="text-xs font-bold text-ink mb-2">About this group</p>
            <p className="text-[10px] text-slate">
              {members.length} member{members.length === 1 ? "" : "s"}
              {groupInfo?.leader_name && ` · Led by ${groupInfo.leader_name}`}
            </p>
            {groupInfo?.rules && (
              <p className="text-xs text-ink mt-2 leading-snug whitespace-pre-wrap">{groupInfo.rules}</p>
            )}
          </div>

          <div className="bg-white rounded-ticket border border-ink/10 p-4">
            <p className="text-xs font-bold text-ink mb-3">Members</p>
            {loadingMembers ? (
              <p className="text-xs text-slate text-center py-4">Loading…</p>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2.5">
                    <div className="relative">
                      <Avatar url={m.avatar_url} name={m.display_name} size={32} />
                      {m.is_live && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs font-semibold text-ink flex-1 truncate">{m.display_name}</p>
                    {m.is_leader && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
                        Leader
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-[9.5px] text-slate/70 mt-3 text-center">
              Chat and Cam Study open up once you join the group.
            </p>
          </div>

          {membershipStatus === "none" && (
            <div className="bg-white rounded-ticket border border-ink/10 p-4">
              {joinError && (
                <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200 mb-2">
                  ⚠️ {joinError}
                </p>
              )}
              {joinNotice && (
                <p className="text-xs text-amber-700 font-bold bg-amber-50 p-2 rounded-lg border border-amber-200 mb-2">
                  ⏳ {joinNotice}
                </p>
              )}
              <form onSubmit={handleJoinFromPreview} className="space-y-3">
                {joinMeta.has_password && (
                  <div>
                    <label className="text-[10px] font-bold text-slate block mb-0.5">Passcode</label>
                    <input
                      type="password"
                      value={joinPasscode}
                      onChange={(e) => setJoinPasscode(e.target.value)}
                      className="w-full p-2.5 text-xs text-center font-bold tracking-widest rounded-xl border border-ink/15"
                      required
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={joining}
                  className="w-full py-2.5 rounded-xl bg-teal text-white text-xs font-bold disabled:opacity-50"
                >
                  {joining ? "Joining…" : joinMeta.requires_approval ? "Request to Join" : "Join Group"}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ---------- FULL MEMBER VIEW ----------
  return (
    <div className="min-h-screen bg-paper pb-20 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-paper/95 backdrop-blur border-b border-ink/8">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/groups")}
            className="w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center text-ink font-bold"
          >
            ←
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-sm text-ink truncate">{groupInfo?.name || "Group"}</h1>
            {groupInfo?.target_exam && (
              <p className="text-[10px] text-slate">{groupInfo.target_exam}</p>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-md mx-auto w-full px-4 pt-4 flex-1">
        {tab === "home" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white rounded-ticket border border-ink/10 p-3 text-center">
                <p className="text-lg font-bold text-teal">{overallAttendance}%</p>
                <p className="text-[10px] text-slate">Group attendance (7d)</p>
              </div>
              <div className="bg-white rounded-ticket border border-ink/10 p-3 text-center">
                <p className="text-lg font-bold text-teal">{overallProgress}%</p>
                <p className="text-[10px] text-slate">Avg syllabus progress</p>
              </div>
            </div>

            <div className="bg-white rounded-ticket border border-ink/10 p-4">
              <p className="text-xs font-bold text-ink mb-3">Studying now</p>
              {loadingMembers ? (
                <p className="text-xs text-slate text-center py-6">Loading…</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {members
                    .slice()
                    .sort((a, b) => (b.is_live ? 1 : 0) - (a.is_live ? 1 : 0) || b.week_seconds - a.week_seconds)
                    .map((m) => (
                      <button
                        key={m.user_id}
                        onClick={() => setSelectedMember(m)}
                        className="flex flex-col items-center gap-1"
                      >
                        <div className="relative">
                          <Avatar url={m.avatar_url} name={m.display_name} size={48} />
                          {m.is_live && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                          )}
                        </div>
                        <p className="text-[10px] font-semibold text-ink truncate w-full text-center">
                          {m.display_name}
                        </p>
                        <p className="text-[9px] text-slate">
                          {m.is_live ? "Live" : formatHM(m.today_seconds)}
                        </p>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-ticket border border-ink/10 p-4">
              <p className="text-xs font-bold text-ink mb-3">Weekly study time</p>
              <div className="flex flex-col gap-2">
                {members
                  .slice()
                  .sort((a, b) => b.week_seconds - a.week_seconds)
                  .map((m) => (
                    <div key={m.user_id} className="flex items-center gap-2">
                      <p className="text-[10px] text-ink w-16 truncate shrink-0">{m.display_name}</p>
                      <div className="flex-1 h-2 bg-ink/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal rounded-full"
                          style={{ width: `${(m.week_seconds / maxWeekSeconds) * 100}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-slate w-12 text-right shrink-0">
                        {formatHM(m.week_seconds)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {tab === "chat" && (
          <div className="flex flex-col gap-3">
            <div className="h-[60vh] overflow-y-auto space-y-2.5 pr-1 bg-white rounded-ticket border border-ink/10 p-3">
              {loadingMessages ? (
                <p className="text-center py-10 text-xs text-slate">Loading…</p>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-slate space-y-1">
                  <p className="text-2xl">🔒</p>
                  <p className="text-xs font-bold text-ink">Say hi to your group!</p>
                </div>
              ) : (
                messages.map((m) => {
                  const canDelete =
                    isAdmin || m.sender_uid === currentUser?.id || (canManage && m.sender_uid);
                  return (
                    <div
                      key={m.id}
                      className="bg-paper/70 p-2.5 rounded-xl border border-ink/5 flex items-start justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-indigo-800">{m.sender_name}</span>
                          <span className="text-[9.5px] text-slate">{m.created_at}</span>
                        </div>
                        <p className="text-xs text-ink mt-0.5 leading-snug break-words">{m.content}</p>
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteMessage(m.id)}
                          className="text-[10px] font-bold text-slate hover:text-rose-600 px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-1.5">
              <input
                type="text"
                placeholder="Type a message…"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-xl border border-ink/15 bg-white"
              />
              <button type="submit" className="px-4 py-2 bg-teal text-white rounded-xl text-xs font-bold">
                Send
              </button>
            </form>
          </div>
        )}

        {tab === "cam" && currentUser && (
          <div className="bg-white rounded-ticket border border-ink/10 p-4">
            <StudyRoomPanel
              groupId={groupId}
              userId={currentUser.id}
              displayName={
                currentUser?.user_metadata?.full_name || currentUser?.email?.split("@")[0] || "Student"
              }
            />
          </div>
        )}

        {tab === "members" && (
          <div className="flex flex-col gap-2.5">
            {canManage && (pendingRequests.length > 0 || loadingPending) && (
              <div className="bg-amber-50 border border-amber-200 rounded-ticket p-3 mb-1">
                <p className="text-xs font-bold text-amber-800 mb-2">
                  Pending Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
                </p>
                {loadingPending ? (
                  <p className="text-[11px] text-slate">Loading…</p>
                ) : (
                  <div className="space-y-2">
                    {pendingRequests.map((r) => (
                      <div
                        key={r.request_id}
                        className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-amber-100"
                      >
                        <Avatar url={r.user_avatar} name={r.user_name} size={30} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-ink truncate">{r.user_name}</p>
                          <p className="text-[9px] text-slate">
                            Requested{" "}
                            {new Date(r.requested_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                        </div>
                        <button
                          onClick={() => handleApproveRequest(r.request_id)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => handleRejectRequest(r.request_id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-[10px] font-bold"
                        >
                          ❌ Reject
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {loadingMembers ? (
              <p className="text-center py-10 text-xs text-slate">Loading…</p>
            ) : (
              members
                .slice()
                .sort((a, b) => (b.is_leader ? 1 : 0) - (a.is_leader ? 1 : 0))
                .map((m) => (
                  <button
                    key={m.user_id}
                    onClick={() => setSelectedMember(m)}
                    className="w-full text-left bg-white rounded-ticket border border-ink/10 p-3 flex items-center gap-3"
                  >
                    <div className="relative">
                      <Avatar url={m.avatar_url} name={m.display_name} />
                      {m.is_live && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-ink truncate">{m.display_name}</p>
                        {m.is_leader && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
                            Leader
                          </span>
                        )}
                        {m.is_live && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                            Live
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate mt-0.5">
                        Today {formatHM(m.today_seconds)} · Week {formatHM(m.week_seconds)}
                      </p>
                    </div>
                  </button>
                ))
            )}

            <button
              onClick={handleLeaveGroup}
              className="mt-2 py-2.5 rounded-xl border border-rose-200 text-rose-600 font-bold text-xs bg-rose-50"
            >
              Leave Group
            </button>
          </div>
        )}
      </main>

      {/* Internal bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-ink/10 z-20">
        <div className="max-w-md mx-auto grid grid-cols-4">
          {([
            { id: "home", label: "Home", icon: "🏠" },
            { id: "chat", label: "Chat", icon: "💬" },
            { id: "cam", label: "Cam Study", icon: "📷" },
            { id: "members", label: "Members", icon: "👥" },
          ] as { id: Tab; label: string; icon: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${
                tab === t.id ? "text-teal" : "text-slate"
              }`}
            >
              <span className="text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Member detail modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <div className="flex items-center gap-2">
                <Avatar url={selectedMember.avatar_url} name={selectedMember.display_name} />
                <div>
                  <p className="text-sm font-bold text-ink">{selectedMember.display_name}</p>
                  {selectedMember.is_leader && (
                    <p className="text-[9px] font-bold text-amber-700">Group Leader</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="w-6 h-6 rounded-full bg-ink/5 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-paper/70 rounded-xl p-2.5">
                <p className="text-sm font-bold text-teal">{formatHM(selectedMember.today_seconds)}</p>
                <p className="text-[9px] text-slate">Today</p>
              </div>
              <div className="bg-paper/70 rounded-xl p-2.5">
                <p className="text-sm font-bold text-teal">{formatHM(selectedMember.week_seconds)}</p>
                <p className="text-[9px] text-slate">This week</p>
              </div>
              <div className="bg-paper/70 rounded-xl p-2.5">
                <p className="text-sm font-bold text-teal">
                  {Math.round((selectedMember.attendance_days / 7) * 100)}%
                </p>
                <p className="text-[9px] text-slate">7-day attendance</p>
              </div>
              <div className="bg-paper/70 rounded-xl p-2.5">
                <p className="text-sm font-bold text-teal">{progress[selectedMember.user_id] ?? 0}%</p>
                <p className="text-[9px] text-slate">Syllabus progress</p>
              </div>
            </div>

            <p className="text-[10px] text-slate text-center">
              Joined {new Date(selectedMember.joined_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>

            {canManage && !selectedMember.is_leader && selectedMember.user_id !== currentUser?.id && (
              <button
                onClick={() => handleRemoveMember(selectedMember.user_id)}
                className="w-full py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs"
              >
                Remove from Group
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
