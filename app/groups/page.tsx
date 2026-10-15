// app/groups/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/dashboard/AppHeader";
import BottomNav from "@/components/dashboard/BottomNav";
import DiscordVoiceHub, {
  VoiceChannelData,
  INITIAL_OFFICIAL_CHANNELS,
} from "@/components/groups/DiscordVoiceHub";
import DiscordVoiceStageModal, {
  VoicePeer,
} from "@/components/groups/DiscordVoiceStageModal";
import FloatingVoiceDock from "@/components/groups/FloatingVoiceDock";

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

const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

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
        ðŸ”’ Password
      </span>
    );
  }
  if (requiresApproval) {
    return (
      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
        ðŸ›¡ï¸ Approval Required
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
      âœ… Open Join
    </span>
  );
}

export default function GroupsListPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeView, setActiveView] = useState<"groups" | "voice">("groups");

  // Traditional Groups State
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [myJoinedGroupIds, setMyJoinedGroupIds] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Group Create & Join Modals
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

  // â”€â”€â”€ DISCORD VOICE CHANNELS STATE â”€â”€â”€
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannelData[]>(() => {
    try {
      const saved = localStorage.getItem("pw_custom_voice_channels");
      if (saved) {
        const parsed = JSON.parse(saved);
        return [...INITIAL_OFFICIAL_CHANNELS, ...parsed];
      }
    } catch (_) {}
    return INITIAL_OFFICIAL_CHANNELS;
  });

  const [activeVoiceChannel, setActiveVoiceChannel] = useState<VoiceChannelData | null>(null);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remotePeers, setRemotePeers] = useState<VoicePeer[]>([]);
  const [peerCounts, setPeerCounts] = useState<Record<string, number>>({});
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);

  // Media Streams & WebRTC Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const displayName =
    currentUser?.user_metadata?.full_name ||
    currentUser?.email?.split("@")[0] ||
    "Student";
  const userId = currentUser?.id || "guest-user";

  // â”€â”€ LOAD USER & GROUPS â”€â”€
  async function loadPending(uid: string) {
    try {
      const { data } = await supabase.rpc("get_my_pending_requests", { p_user_id: uid });
      setPendingRequests(
        (data ?? []).map((r: any) => ({
          request_id: r.request_id,
          group_id: r.group_id,
          group_name: r.group_name,
          target_exam: r.target_exam,
        }))
      );
    } catch (_) {}
  }

  useEffect(() => {
    async function init() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentUser(user);

      try {
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
      } catch (err) {
        console.error("Groups load error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // â”€â”€ WEBRTC MESH CONNECTION LOGIC â”€â”€
  function createPeerConnection(remoteId: string, remoteName: string) {
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    // Add audio tracks
    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    // Add screen track if sharing
    screenStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, screenStreamRef.current!);
    });

    // Add camera track if active
    camStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, camStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { from: userId, to: remoteId, candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      setRemotePeers((prev) => {
        const existing = prev.find((p) => p.id === remoteId);
        if (existing) {
          return prev.map((p) =>
            p.id === remoteId ? { ...p, stream: event.streams[0] } : p
          );
        }
        return [...prev, { id: remoteId, name: remoteName, stream: event.streams[0] }];
      });
    };

    peerConnectionsRef.current.set(remoteId, pc);
    return pc;
  }

  // Real-time voice amplitude detector for speaking ring indicator
  const startSpeakingDetector = useCallback((audioTrack: MediaStreamTrack) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let animId: number;

      const checkVolume = () => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        setIsLocalSpeaking(avg > 15);
        animId = requestAnimationFrame(checkVolume);
      };
      checkVolume();

      return () => {
        cancelAnimationFrame(animId);
        if (ctx.state !== "closed") ctx.close().catch(() => {});
      };
    } catch (_) {
      return () => {};
    }
  }, []);

  // Join Voice Channel
  const handleJoinVoiceChannel = async (ch: VoiceChannelData) => {
    // If clicking same channel, re-open stage
    if (activeVoiceChannel?.id === ch.id) {
      setIsStageModalOpen(true);
      return;
    }

    // Leave current channel if already connected
    if (activeVoiceChannel) {
      handleLeaveVoiceChannel();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localStreamRef.current = stream;

      // Start silent focus muted by default
      if (ch.isSilentFocus) {
        stream.getAudioTracks().forEach((t) => (t.enabled = false));
        setIsMuted(true);
      } else {
        setIsMuted(false);
      }

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        startSpeakingDetector(audioTrack);
      }

      // Connect to Supabase Realtime Voice Room
      const channel = supabase.channel(`voice_room_${ch.id}`, {
        config: { presence: { key: userId } },
      });
      channelRef.current = channel;

      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setPeerCounts((prev) => ({ ...prev, [ch.id]: count }));
      });

      channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const pc = createPeerConnection(payload.from, payload.fromName);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({
          type: "broadcast",
          event: "answer",
          payload: { from: userId, to: payload.from, sdp: answer },
        });
      });

      channel.on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const pc = peerConnectionsRef.current.get(payload.from);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      });

      channel.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const pc = peerConnectionsRef.current.get(payload.from);
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (_) {}
        }
      });

      channel.on("broadcast", { event: "new-peer" }, async ({ payload }) => {
        if (payload.id === userId) return;
        const pc = createPeerConnection(payload.id, payload.name);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({
          type: "broadcast",
          event: "offer",
          payload: { from: userId, fromName: displayName, to: payload.id, sdp: offer },
        });
      });

      channel.on("broadcast", { event: "peer-left" }, ({ payload }) => {
        const pc = peerConnectionsRef.current.get(payload.id);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(payload.id);
        }
        setRemotePeers((prev) => prev.filter((p) => p.id !== payload.id));
      });

      await channel.subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, name: displayName });
          channel.send({
            type: "broadcast",
            event: "new-peer",
            payload: { id: userId, name: displayName },
          });

          setActiveVoiceChannel(ch);
          setIsStageModalOpen(true);
        }
      });
    } catch (err) {
      console.error("Failed to access microphone:", err);
      alert("Microphone permission is required to enter voice channels.");
    }
  };

  // Leave Voice Channel
  const handleLeaveVoiceChannel = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;

    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "peer-left",
        payload: { id: userId },
      });
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }

    setRemotePeers([]);
    setActiveVoiceChannel(null);
    setIsStageModalOpen(false);
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setIsLocalSpeaking(false);
  };

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMute = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !nextMute));
    setIsMuted(nextMute);
  };

  // Toggle Deafen
  const handleToggleDeafen = () => {
    const nextDeaf = !isDeafened;
    setIsDeafened(nextDeaf);
    if (nextDeaf && !isMuted) {
      handleToggleMute();
    }
  };

  // Toggle Camera
  const handleToggleCamera = async () => {
    if (isCameraOn) {
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
      setIsCameraOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        camStreamRef.current = stream;
        setIsCameraOn(true);
        // Add video track to existing peer connections
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          peerConnectionsRef.current.forEach((pc) => {
            pc.addTrack(videoTrack, stream);
          });
        }
      } catch (e) {
        alert("Camera permission denied.");
      }
    }
  };

  // Toggle Screen Share
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        setIsScreenSharing(true);

        const screenTrack = stream.getVideoTracks()[0];
        if (screenTrack) {
          screenTrack.onended = () => {
            setIsScreenSharing(false);
            screenStreamRef.current = null;
          };
          peerConnectionsRef.current.forEach((pc) => {
            pc.addTrack(screenTrack, stream);
          });
        }
      } catch (e) {
        console.log("Screen share cancelled or unsupported.");
      }
    }
  };

  // Create Custom Voice Channel
  const handleCreateCustomVoiceChannel = (name: string, topic: string, maxParticipants: number) => {
    const newChan: VoiceChannelData = {
      id: `custom-voice-${Date.now()}`,
      name,
      topic,
      maxParticipants,
      category: "custom",
    };
    const updated = [...voiceChannels, newChan];
    setVoiceChannels(updated);
    try {
      const customOnly = updated.filter((c) => c.category === "custom");
      localStorage.setItem("pw_custom_voice_channels", JSON.stringify(customOnly));
    } catch (_) {}
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerConnectionsRef.current.forEach((pc) => pc.close());
    };
  }, []);

  // Traditional Groups Filters
  const myGroups = groups.filter((g) => myJoinedGroupIds.includes(g.id));
  const otherGroups = groups.filter((g) => !myJoinedGroupIds.includes(g.id));

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = newGroupName.trim();
    if (!trimmedName) {
      setCreateError("Group name is required.");
      return;
    }
    if (newGroupHasPassword && !newGroupPasscode.trim()) {
      setCreateError("Passcode is required when passcode protection is enabled.");
      return;
    }
    setCreating(true);
    setCreateError(null);

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
      setJoinNotice(`Request sent! Join request is waiting for admin approval.`);
      await loadPending(currentUser.id);
      return;
    }
    if (result === "joined") {
      router.push(`/groups/${joinTargetId}`);
    }
  }

  async function handleCancelPending(groupId: string) {
    if (!currentUser) return;
    await supabase.rpc("cancel_join_request", { p_group_id: groupId, p_user_id: currentUser.id });
    await loadPending(currentUser.id);
  }

  return (
    <div className="min-h-screen bg-paper pb-32 text-ink">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-3.5 flex flex-col gap-4">
        {/* Title & Tagline */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-ink font-black tracking-tight">
              Study Hub
            </h1>
            <p className="text-[11px] text-slate font-medium">
              Join peer study groups & live Discord voice lounges
            </p>
          </div>

          {activeVoiceChannel && (
            <button
              onClick={() => setIsStageModalOpen(true)}
              className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-700 text-[10px] font-black flex items-center gap-1.5 animate-pulse"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Voice Active</span>
            </button>
          )}
        </div>

        {/* â”€â”€ TOP SEGMENT SWITCHER: GROUPS vs LIVE VOICE LOUNGES â”€â”€ */}
        <div className="flex p-1 bg-slate-200/80 rounded-2xl border border-slate-300/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveView("groups")}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeView === "groups"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>ðŸ‘¥ Study Groups</span>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full font-bold">
              {groups.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("voice")}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeView === "voice"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>ðŸ”Š Voice Lounges</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              activeVoiceChannel
                ? "bg-emerald-500 text-slate-950 font-black"
                : "bg-teal-500/20 text-teal-800"
            }`}>
              {activeVoiceChannel ? "Connected" : `${voiceChannels.length}`}
            </span>
          </button>
        </div>

        {/* â”€â”€ VIEW 1: DISCORD VOICE CHANNELS DIRECTLY ON GROUPS PAGE â”€â”€ */}
        {activeView === "voice" && (
          <div className="space-y-4">
            <DiscordVoiceHub
              channels={voiceChannels}
              activeChannelId={activeVoiceChannel?.id || null}
              onJoinChannel={handleJoinVoiceChannel}
              onCreateChannel={handleCreateCustomVoiceChannel}
              peerCounts={peerCounts}
            />
          </div>
        )}

        {/* â”€â”€ VIEW 2: TRADITIONAL STUDY GROUPS LIST â”€â”€ */}
        {activeView === "groups" && (
          <div>
            {loading ? (
              <p className="text-center py-10 text-xs text-slate">Loading groupsâ€¦</p>
            ) : (
              <div className="space-y-4">
                {/* My Groups Section */}
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
                      <GroupCard
                        key={grp.id}
                        grp={grp}
                        joined
                        onOpen={() => router.push(`/groups/${grp.id}`)}
                      />
                    ))}
                    {myGroups.length === 0 && pendingRequests.length === 0 && (
                      <p className="text-xs text-slate px-1 py-2">
                        You haven't joined any groups yet.
                      </p>
                    )}
                  </div>
                </div>

                {/* Join & Create Buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      setJoinTargetId(otherGroups[0]?.id ?? "");
                      setEnteredPasscode("");
                      setJoinError(null);
                      setJoinNotice(null);
                      setShowJoinModal(true);
                    }}
                    className="flex-1 py-3 rounded-xl border border-ink/15 text-ink font-bold text-xs hover:bg-ink/5 shadow-2xs"
                  >
                    ðŸ”‘ Join Group
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

                {/* Explore Groups */}
                {otherGroups.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-bold text-slate mb-2 px-1">Explore Other Groups</p>
                    <div className="space-y-2.5">
                      {otherGroups.map((grp) => (
                        <GroupCard
                          key={grp.id}
                          grp={grp}
                          joined={false}
                          onOpen={() => {
                            setJoinTargetId(grp.id);
                            setEnteredPasscode("");
                            setJoinError(null);
                            setJoinNotice(null);
                            setShowJoinModal(true);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* â”€â”€ FLOATING DISCORD-STYLE VOICE DOCK â”€â”€ */}
      {activeVoiceChannel && (
        <FloatingVoiceDock
          channelName={activeVoiceChannel.name}
          participantCount={remotePeers.length + 1}
          isMuted={isMuted}
          isDeafened={isDeafened}
          isSpeaking={isLocalSpeaking}
          onToggleMute={handleToggleMute}
          onToggleDeafen={handleToggleDeafen}
          onOpenStage={() => setIsStageModalOpen(true)}
          onDisconnect={handleLeaveVoiceChannel}
        />
      )}

      {/* â”€â”€ DISCORD VOICE STAGE FULL MODAL â”€â”€ */}
      {activeVoiceChannel && (
        <DiscordVoiceStageModal
          isOpen={isStageModalOpen}
          onClose={() => setIsStageModalOpen(false)}
          channelId={activeVoiceChannel.id}
          channelName={activeVoiceChannel.name}
          userId={userId}
          displayName={displayName}
          onLeaveChannel={handleLeaveVoiceChannel}
          isMuted={isMuted}
          isDeafened={isDeafened}
          onToggleMute={handleToggleMute}
          onToggleDeafen={handleToggleDeafen}
          localStream={localStreamRef.current}
          remotePeers={remotePeers}
          screenStream={screenStreamRef.current}
          onToggleScreenShare={handleToggleScreenShare}
          isScreenSharing={isScreenSharing}
          camStream={camStreamRef.current}
          onToggleCamera={handleToggleCamera}
          isCameraOn={isCameraOn}
          isLocalSpeaking={isLocalSpeaking}
        />
      )}

      {/* CREATE GROUP MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <h3 className="text-sm font-bold text-ink">Create Study Group</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError(null);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate text-xs font-bold"
              >
                âœ•
              </button>
            </div>

            {createError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. JEE 2027 Chasers"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-ink/20 focus:outline-none focus:border-teal"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Target Exam</label>
                <select
                  value={newGroupExam}
                  onChange={(e) => setNewGroupExam(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-ink/20 focus:outline-none focus:border-teal bg-white"
                >
                  <option value="All">All Exams</option>
                  <option value="JEE">JEE Main & Advanced</option>
                  <option value="NEET">NEET UG</option>
                  <option value="Boards">Class 11/12 Boards</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Daily Goal (Hours)</label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={newGroupGoalHours}
                  onChange={(e) => setNewGroupGoalHours(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-ink/20 focus:outline-none focus:border-teal"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Rules / Bio</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Minimum 6 hours daily, no spam"
                  value={newGroupRules}
                  onChange={(e) => setNewGroupRules(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-ink/20 focus:outline-none focus:border-teal"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-ink/20 text-ink font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl bg-teal text-white font-bold disabled:opacity-50"
                >
                  {creating ? "Creatingâ€¦" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN GROUP MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <h3 className="text-sm font-bold text-ink">Join Group</h3>
              <button
                onClick={() => setShowJoinModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate text-xs font-bold"
              >
                âœ•
              </button>
            </div>

            {joinError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {joinError}
              </div>
            )}
            {joinNotice && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium">
                {joinNotice}
              </div>
            )}

            <form onSubmit={handleRequestJoin} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Select Group</label>
                <select
                  value={joinTargetId}
                  onChange={(e) => setJoinTargetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-ink/20 focus:outline-none focus:border-teal bg-white"
                >
                  {otherGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.target_exam})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Passcode (if required)</label>
                <input
                  type="password"
                  placeholder="Enter group passcode"
                  value={enteredPasscode}
                  onChange={(e) => setEnteredPasscode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-ink/20 focus:outline-none focus:border-teal"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-ink/20 text-ink font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="flex-1 py-2.5 rounded-xl bg-teal text-white font-bold disabled:opacity-50"
                >
                  {joining ? "Joiningâ€¦" : "Join"}
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

// â”€â”€ GROUP CARD HELPER â”€â”€
function GroupCard({
  grp,
  joined,
  onOpen,
}: {
  grp: GroupRow;
  joined: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="p-3.5 bg-white rounded-2xl border border-ink/10 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-black text-ink truncate">{grp.name}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal/10 text-teal">
            {grp.target_exam}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate">
          <span>ðŸ‘¥ {grp.member_count} members</span>
          {grp.goal_hours && <span>Â· ðŸŽ¯ {grp.goal_hours}h goal</span>}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <JoinTypeTag
          hasPassword={grp.has_password}
          requiresApproval={grp.requires_approval}
        />
        <button
          type="button"
          className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
            joined ? "bg-slate-100 text-ink" : "bg-teal text-white shadow-xs"
          }`}
        >
          {joined ? "Open" : "Join"}
        </button>
      </div>
    </div>
  );
}

// â”€â”€ PENDING GROUP CARD HELPER â”€â”€
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
    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-2 shadow-2xs">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-black text-amber-950 truncate">{pending.group_name}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-200/60 text-amber-900">
            Pending
          </span>
        </div>
        <p className="text-[10px] text-amber-800 mt-0.5">Waiting for group admin approval</p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onCancel}
          className="px-2.5 py-1 text-[10px] font-bold text-rose-700 bg-white border border-rose-200 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
