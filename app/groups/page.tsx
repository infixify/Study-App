// app/groups/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/dashboard/AppHeader";
import BottomNav from "@/components/dashboard/BottomNav";

interface Message {
  id: string;
  sender_name: string;
  sender_uid: string;
  content: string;
  created_at: string;
}

interface PrivateGroup {
  id: string;
  name: string;
  target_exam: string;
  member_count: number;
  created_by: string | null;
}

export default function CommunityPage() {
  const [currentTab, setCurrentTab] = useState<"world" | "custom">("world");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Private Groups State
  const [groups, setGroups] = useState<PrivateGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [myJoinedGroupIds, setMyJoinedGroupIds] = useState<string[]>([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupExam, setNewGroupExam] = useState("JEE");
  const [newGroupPasscode, setNewGroupPasscode] = useState("");

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedGroupToJoin, setSelectedGroupToJoin] = useState<PrivateGroup | null>(null);
  const [enteredPasscode, setEnteredPasscode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Load User & Groups
  useEffect(() => {
    async function init() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;
      setCurrentUser(user);

      // Real admin check — same mechanism as the rest of the app.
      const { data: adminCheck } = await supabase.rpc("is_admin");
      if (adminCheck) {
        setIsAdmin(true);
      }

      // Membership is now the DATABASE (group_members table), not
      // localStorage — localStorage was per-browser, not per-account, so
      // switching accounts on the same device let the wrong user appear
      // "already joined" and skip the passcode check entirely. The DB is
      // now the single source of truth, keyed by auth.uid().
      const { data: memberRows } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);
      setMyJoinedGroupIds((memberRows ?? []).map((m) => m.group_id));

      // Fetch groups — passcode is never selected. created_by is needed so
      // the UI can grant a group's author delete-any-message rights inside
      // their own room.
      const { data: dbGroups } = await supabase
        .from("study_groups")
        .select("id, name, target_exam, created_by")
        .order("created_at", { ascending: false });

      if (dbGroups && dbGroups.length > 0) {
        setGroups(
          dbGroups.map((g) => ({
            ...g,
            member_count: Math.floor(Math.random() * 8) + 3,
          }))
        );
      } else {
        // Fallback default community room (local-only, not in the DB)
        setGroups([
          {
            id: "room-kota-challengers",
            name: "Kota 10-Hour Challenge",
            target_exam: "JEE",
            member_count: 18,
            created_by: null,
          },
        ]);
      }
    }
    init();
  }, []);

  // Load Messages for current view (World or Private Group)
  const currentFeedId = activeGroupId || "world";
  const activeGroup = groups.find((g) => g.id === activeGroupId) || null;

  useEffect(() => {
    async function loadFeedMessages() {
      setLoadingMessages(true);
      try {
        const { data: dbMsgs } = await supabase
          .from("group_messages")
          .select("id, sender_name, sender_uid, content, created_at")
          .eq("group_id", currentFeedId)
          .order("created_at", { ascending: true })
          .limit(100);

        if (dbMsgs && dbMsgs.length > 0) {
          setMessages(
            dbMsgs.map((m) => ({
              ...m,
              created_at: new Date(m.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }))
          );
        } else {
          setMessages([]);
        }
      } catch (err) {
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    }
    loadFeedMessages();
  }, [currentFeedId]);

  // Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const senderName =
      currentUser?.user_metadata?.full_name ||
      currentUser?.email?.split("@")[0] ||
      "Student";
    const senderUid = currentUser?.id || "anon";

    const optimisticMsg: Message = {
      id: Date.now().toString(),
      sender_name: senderName,
      sender_uid: senderUid,
      content: inputMsg.trim(),
      created_at: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const nextMsgs = [...messages, optimisticMsg];
    setMessages(nextMsgs);
    setInputMsg("");

    try {
      // sender_uid must be the real signed-in uid — the insert RLS policy
      // requires sender_uid = auth.uid(), so this can't be spoofed.
      await supabase.from("group_messages").insert({
        group_id: currentFeedId,
        sender_uid: currentUser?.id ?? null,
        sender_name: senderName,
        content: optimisticMsg.content,
      });
    } catch (e) {
      console.warn("Message send failed", e);
    }
  };

  // Delete message — RLS enforces: sender can delete own, is_admin() can
  // delete any, and a private group's author (created_by) can delete any
  // message inside their own room.
  const handleDeleteMessage = async (id: string) => {
    const updated = messages.filter((m) => m.id !== id);
    setMessages(updated);

    try {
      await supabase.from("group_messages").delete().eq("id", id);
    } catch (e) {}
  };

  // Create Private Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupPasscode.trim()) return;

    try {
      const { data: inserted, error } = await supabase
        .from("study_groups")
        .insert({
          name: newGroupName.trim(),
          target_exam: newGroupExam,
          passcode: newGroupPasscode.trim(),
          created_by: currentUser?.id ?? null,
        })
        .select("id, name, target_exam, created_by")
        .single();

      if (error || !inserted) {
        console.warn("Could not create group", error);
        return;
      }

      // A DB trigger (add_creator_as_member) already inserted the creator
      // into group_members — this just updates local UI state to match.
      const newGroup: PrivateGroup = { ...inserted, member_count: 1 };
      setGroups((prev) => [newGroup, ...prev]);
      setMyJoinedGroupIds((prev) => [...prev, newGroup.id]);

      setShowCreateModal(false);
      setNewGroupName("");
      setNewGroupPasscode("");
      setActiveGroupId(newGroup.id);
    } catch (e) {
      console.warn("Could not create group", e);
    }
  };

  // Join Private Group with Passcode — verified server-side via a
  // security-definer function, which also records membership in
  // group_members on success. The passcode itself never reaches the
  // browser; only a true/false answer does.
  const handleVerifyAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupToJoin) return;

    setJoining(true);
    setJoinError(null);

    const { data: isCorrect, error } = await supabase.rpc("verify_group_passcode", {
      p_group_id: selectedGroupToJoin.id,
      p_passcode: enteredPasscode.trim(),
    });

    setJoining(false);

    if (error || !isCorrect) {
      setJoinError("Incorrect passcode! Ask group admin.");
      return;
    }

    setMyJoinedGroupIds((prev) => [...prev, selectedGroupToJoin.id]);

    setShowJoinModal(false);
    setEnteredPasscode("");
    setJoinError(null);
    setActiveGroupId(selectedGroupToJoin.id);
  };

  return (
    <div className="min-h-screen bg-paper pb-28">
      <AppHeader />

      <main className="max-w-md mx-auto px-5 pt-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-ink">👥 Community</h1>
            <p className="text-[11px] text-slate mt-0.5">
              Live peer accountability & study rooms
            </p>
          </div>
          {currentTab === "custom" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-teal text-white rounded-xl text-xs font-bold shadow-xs hover:bg-teal/90"
            >
              + New Room
            </button>
          )}
        </div>

        {/* Tab switch */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setCurrentTab("world");
              setActiveGroupId(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
              currentTab === "world" && !activeGroupId
                ? "bg-teal text-white border-teal shadow-xs"
                : "bg-white text-slate border-ink/10"
            }`}
          >
            🌍 Global Feed
          </button>
          <button
            onClick={() => setCurrentTab("custom")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
              currentTab === "custom" || activeGroupId
                ? "bg-teal text-white border-teal shadow-xs"
                : "bg-white text-slate border-ink/10"
            }`}
          >
            🔒 Study Rooms ({groups.length})
          </button>
        </div>

        {/* VIEW 1: GLOBAL FEED */}
        {currentTab === "world" && !activeGroupId && (
          <div className="bg-white rounded-ticket border border-ink/10 p-4 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8 text-xs font-bold text-ink">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Community Live Chat
              </span>
              <span className="text-[10px] text-slate">All Aspirants</span>
            </div>

            <div className="h-80 overflow-y-auto space-y-2.5 pr-1">
              {loadingMessages ? (
                <p className="text-center py-10 text-xs text-slate">Loading messages...</p>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-slate space-y-1">
                  <p className="text-2xl">💬</p>
                  <p className="text-xs font-bold text-ink">No messages yet!</p>
                  <p className="text-[11px]">Be the first to share your daily target.</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className="bg-paper/70 p-2.5 rounded-xl border border-ink/5 flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-teal-800">
                          {m.sender_name}
                        </span>
                        <span className="text-[9.5px] text-slate font-medium">
                          {m.created_at}
                        </span>
                      </div>
                      <p className="text-xs text-ink mt-0.5 leading-snug break-words">
                        {m.content}
                      </p>
                    </div>

                    {(isAdmin || m.sender_uid === currentUser?.id) && (
                      <button
                        onClick={() => handleDeleteMessage(m.id)}
                        className="text-[10px] font-bold text-slate hover:text-rose-600 px-1 py-0.5 rounded"
                        title="Delete message"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-1.5 pt-1">
              <input
                type="text"
                placeholder="Share your target or question with community..."
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-xl border border-ink/15 bg-white outline-none focus:border-teal"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-teal text-white rounded-xl text-xs font-bold hover:bg-teal/90 shadow-xs"
              >
                Send
              </button>
            </form>
          </div>
        )}

        {/* VIEW 2: STUDY ROOMS */}
        {(currentTab === "custom" || activeGroupId) && (
          <>
            {activeGroupId ? (
              <div className="bg-white rounded-ticket border border-ink/10 p-4 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-ink/8">
                  <div>
                    <h3 className="font-bold text-xs text-ink">
                      {activeGroup?.name || "Study Room"}
                    </h3>
                    <span className="text-[10px] text-teal font-semibold">🔒 Private Room</span>
                  </div>
                  <button
                    onClick={() => setActiveGroupId(null)}
                    className="text-xs text-slate hover:text-ink font-bold px-2 py-1 rounded bg-ink/5"
                  >
                    ← All Rooms
                  </button>
                </div>

                <div className="h-80 overflow-y-auto space-y-2.5 pr-1">
                  {messages.length === 0 ? (
                    <div className="text-center py-12 text-slate space-y-1">
                      <p className="text-2xl">🔒</p>
                      <p className="text-xs font-bold text-ink">Room Ready</p>
                      <p className="text-[11px]">Say hi to your study partners!</p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const canDelete =
                        isAdmin ||
                        m.sender_uid === currentUser?.id ||
                        (activeGroup?.created_by && activeGroup.created_by === currentUser?.id);
                      return (
                        <div
                          key={m.id}
                          className="bg-paper/70 p-2.5 rounded-xl border border-ink/5 flex items-start justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-indigo-800">
                                {m.sender_name}
                              </span>
                              <span className="text-[9.5px] text-slate font-medium">
                                {m.created_at}
                              </span>
                            </div>
                            <p className="text-xs text-ink mt-0.5 leading-snug break-words">
                              {m.content}
                            </p>
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

                <form onSubmit={handleSendMessage} className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="Type in private room..."
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs font-medium rounded-xl border border-ink/15 bg-white outline-none focus:border-teal"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal text-white rounded-xl text-xs font-bold"
                  >
                    Send
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate px-1">
                  <span>Available Study Rooms</span>
                  <span>{groups.length} active</span>
                </div>

                {groups.map((grp) => {
                  const isJoined = myJoinedGroupIds.includes(grp.id);
                  return (
                    <div
                      key={grp.id}
                      className="bg-white rounded-ticket border border-ink/10 p-4 shadow-2xs flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9.5px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {grp.target_exam}
                          </span>
                          <h4 className="font-bold text-xs text-ink">{grp.name}</h4>
                        </div>
                        <p className="text-[10px] text-slate mt-1">
                          Passcode Protected • {grp.member_count} Members
                        </p>
                      </div>

                      {isJoined ? (
                        <button
                          onClick={() => setActiveGroupId(grp.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-teal text-white font-bold text-xs shadow-xs hover:bg-teal/90"
                        >
                          Open Room
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedGroupToJoin(grp);
                            setShowJoinModal(true);
                            setJoinError(null);
                          }}
                          className="px-3.5 py-1.5 rounded-xl border border-ink/15 text-ink font-bold text-xs hover:bg-ink/5"
                        >
                          Join 🔑
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* CREATE NEW PRIVATE ROOM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <h3 className="text-sm font-bold text-ink">Create Study Room</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-6 h-6 rounded-full bg-ink/5 text-xs text-ink/60"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">
                  Room Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Allen Dropper Serious Batch"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 outline-none focus:border-teal"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">
                  Target Exam
                </label>
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
                <label className="text-[10px] font-bold text-slate block mb-0.5">
                  Passcode (Share with friends to join)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1234 or PW2026"
                  value={newGroupPasscode}
                  onChange={(e) => setNewGroupPasscode(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 outline-none focus:border-teal"
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
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-teal text-white text-xs font-bold shadow-xs hover:bg-teal/90"
                >
                  Create & Enter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN ROOM WITH PASSCODE MODAL */}
      {showJoinModal && selectedGroupToJoin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <div>
                <h3 className="text-sm font-bold text-ink">Enter Room Passcode</h3>
                <p className="text-[11px] text-slate">{selectedGroupToJoin.name}</p>
              </div>
              <button
                onClick={() => setShowJoinModal(false)}
                className="w-6 h-6 rounded-full bg-ink/5 text-xs text-ink/60"
              >
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
                <label className="text-[10px] font-bold text-slate block mb-0.5">
                  4-Digit / Group Passcode
                </label>
                <input
                  type="password"
                  placeholder="Enter passcode"
                  value={enteredPasscode}
                  onChange={(e) => setEnteredPasscode(e.target.value)}
                  className="w-full p-2.5 text-xs text-center font-bold tracking-widest rounded-xl border border-ink/15 outline-none focus:border-teal"
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
                  className="flex-1 py-2.5 rounded-xl bg-teal text-white text-xs font-bold shadow-xs hover:bg-teal/90 disabled:opacity-50"
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
