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
  VoiceChatMessage,
} from "@/components/groups/DiscordVoiceStageModal";
import FloatingVoiceDock from "@/components/groups/FloatingVoiceDock";

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  target_exam: string;
  member_count: number;
  is_private: boolean;
  user_membership_status: "member" | "pending" | "none";
}

interface PendingRequest {
  request_id: string;
  group_id: string;
  group_name: string;
  target_exam: string;
}

export default function GroupsPage() {
  const router = useRouter();

  // ── LOCAL STATE ──
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"my_groups" | "browse">("my_groups");
  const [examFilter, setExamFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Group Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupExam, setNewGroupExam] = useState("JEE");
  const [newGroupPrivate, setNewGroupPrivate] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // ── DISCORD VOICE CHANNELS STATE ──
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannelData[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("custom_voice_channels");
        if (stored) {
          const parsed = JSON.parse(stored);
          return [...INITIAL_OFFICIAL_CHANNELS, ...parsed];
        }
      } catch (_) {}
    }
    return INITIAL_OFFICIAL_CHANNELS;
  });

  const [activeVoiceChannel, setActiveVoiceChannel] = useState<VoiceChannelData | null>(null);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [peerCounts, setPeerCounts] = useState<Record<string, number>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remotePeers, setRemotePeers] = useState<VoicePeer[]>([]);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [voiceChatMessages, setVoiceChatMessages] = useState<VoiceChatMessage[]>([]);

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

  // ── LOAD USER & GROUPS ──
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

  async function loadGroups(uid?: string) {
    try {
      const { data, error } = await supabase.rpc("get_groups_directory", {
        p_user_id: uid || null,
      });
      if (error) throw error;
      setGroups(
        (data ?? []).map((g: any) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          target_exam: g.target_exam,
          member_count: g.member_count ?? 1,
          is_private: g.is_private ?? false,
          user_membership_status: g.membership_status || "none",
        }))
      );
    } catch (_) {
      // Fallback direct query if RPC missing
      try {
        const { data } = await supabase
          .from("study_groups")
          .select("id, name, description, target_exam, member_count, is_private")
          .limit(40);
        if (data) {
          setGroups(
            data.map((g: any) => ({
              ...g,
              user_membership_status: "none",
            }))
          );
        }
      } catch (_) {}
    }
  }

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const { data: sessData } = await supabase.auth.getSession();
        if (sessData?.session?.user && mounted) {
          setCurrentUser(sessData.session.user);
          await loadGroups(sessData.session.user.id);
          await loadPending(sessData.session.user.id);
        } else if (mounted) {
          await loadGroups();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  // ── RTC PEER CONNECTION FACTORY ──
  const createPeerConnection = useCallback(
    (targetUserId: string, targetName: string) => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      // Add local audio track
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Add camera track if on
      if (camStreamRef.current) {
        camStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, camStreamRef.current!);
        });
      }

      // Add screen share track if on
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, screenStreamRef.current!);
        });
      }

      // Remote track handling
      pc.ontrack = (event) => {
        setRemotePeers((prev) => {
          const exists = prev.find((p) => p.id === targetUserId);
          if (exists) {
            return prev.map((p) =>
              p.id === targetUserId ? { ...p, stream: event.streams[0] } : p
            );
          }
          return [
            ...prev,
            {
              id: targetUserId,
              name: targetName || "Study Mate",
              stream: event.streams[0],
            },
          ];
        });
      };

      // ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "ice-candidate",
            payload: {
              candidate: event.candidate,
              from: userId,
              to: targetUserId,
            },
          });
        }
      };

      peerConnectionsRef.current.set(targetUserId, pc);
      return pc;
    },
    [userId]
  );

  // Local Voice Activity Detection (Speaking Indicator)
  const startSpeakingDetector = (audioTrack: MediaStreamTrack) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const checkVolume = () => {
        if (!audioContextRef.current || audioContextRef.current.state === "closed") return;
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        setIsLocalSpeaking(avg > 14);
        requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch (_) {}
  };

  // ── VOICE CHANNEL HANDLERS ──

  // Create Custom Voice Channel
  const handleCreateCustomVoiceChannel = (
    name: string,
    topic: string,
    maxParticipants: number
  ) => {
    const newChan: VoiceChannelData = {
      id: `custom-${Date.now()}`,
      name,
      topic,
      maxParticipants,
      category: "custom",
    };
    setVoiceChannels((prev) => {
      const updated = [...prev, newChan];
      const customOnly = updated.filter((c) => c.category === "custom");
      try {
        localStorage.setItem("custom_voice_channels", JSON.stringify(customOnly));
      } catch (_) {}
      return updated;
    });
    handleJoinVoiceChannel(newChan);
  };

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
      setVoiceChatMessages([]);
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
        if (count === 0) {
          setVoiceChatMessages([]);
        }
      });

      channel.on("broadcast", { event: "voice-chat-msg" }, ({ payload }) => {
        if (payload && payload.senderId !== userId) {
          setVoiceChatMessages((prev) => [...prev, payload]);
        }
      });

      channel.on("broadcast", { event: "voice-chat-clear" }, () => {
        setVoiceChatMessages([]);
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
    setVoiceChatMessages([]);
    setActiveVoiceChannel(null);
    setIsStageModalOpen(false);
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setIsLocalSpeaking(false);
  };

  // Ephemeral Voice Chat message send
  const handleSendVoiceChatMessage = (text: string) => {
    if (!text.trim() || !channelRef.current || !activeVoiceChannel) return;
    const newMsg: VoiceChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderId: userId,
      senderName: displayName,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setVoiceChatMessages((prev) => [...prev, newMsg]);
    channelRef.current.send({
      type: "broadcast",
      event: "voice-chat-msg",
      payload: newMsg,
    });
  };

  const handleClearVoiceChat = () => {
    setVoiceChatMessages([]);
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "voice-chat-clear",
        payload: { channelId: activeVoiceChannel?.id },
      });
    }
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 480, height: 360, frameRate: 15 },
        });
        camStreamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach((pc) => {
          pc.addTrack(videoTrack, stream);
        });
        setIsCameraOn(true);
      } catch (err) {
        alert("Camera permission not available or denied.");
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
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 15 },
        });
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];
        screenTrack.onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
        };
        peerConnectionsRef.current.forEach((pc) => {
          pc.addTrack(screenTrack, stream);
        });
        setIsScreenSharing(true);
      } catch (err) {
        // user cancelled picker
      }
    }
  };

  // ── GROUP MEMBERSHIP ACTIONS ──
  const handleJoinOrRequest = async (group: GroupRow) => {
    if (!currentUser) {
      router.push("/auth");
      return;
    }
    try {
      if (group.is_private) {
        const { error } = await supabase.from("group_join_requests").insert({
          group_id: group.id,
          user_id: currentUser.id,
          status: "pending",
        });
        if (error) throw error;
        setGroups((prev) =>
          prev.map((g) => (g.id === group.id ? { ...g, user_membership_status: "pending" } : g))
        );
        loadPending(currentUser.id);
      } else {
        const { error } = await supabase.from("group_members").insert({
          group_id: group.id,
          user_id: currentUser.id,
          role: "member",
        });
        if (error) throw error;
        setGroups((prev) =>
          prev.map((g) =>
            g.id === group.id
              ? { ...g, user_membership_status: "member", member_count: g.member_count + 1 }
              : g
          )
        );
      }
    } catch (e: any) {
      alert(e.message || "Could not join group.");
    }
  };

  // Create Group Form
  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !currentUser) return;
    setCreatingGroup(true);
    try {
      const { data: newG, error: gErr } = await supabase
        .from("study_groups")
        .insert({
          name: newGroupName.trim(),
          description: newGroupDesc.trim() || null,
          target_exam: newGroupExam,
          is_private: newGroupPrivate,
          created_by: currentUser.id,
          member_count: 1,
        })
        .select()
        .single();

      if (gErr) throw gErr;

      // Add creator as admin
      await supabase.from("group_members").insert({
        group_id: newG.id,
        user_id: currentUser.id,
        role: "admin",
      });

      setShowCreateModal(false);
      setNewGroupName("");
      setNewGroupDesc("");
      loadGroups(currentUser.id);
    } catch (err: any) {
      alert(err.message || "Failed to create group.");
    } finally {
      setCreatingGroup(false);
    }
  };

  // Filter groups
  const filteredGroups = groups.filter((g) => {
    if (examFilter !== "ALL" && g.target_exam !== examFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = g.name.toLowerCase().includes(q);
      const matchDesc = g.description?.toLowerCase().includes(q) ?? false;
      if (!matchName && !matchDesc) return false;
    }
    if (activeTab === "my_groups") {
      return g.user_membership_status === "member";
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-28">
      <AppHeader />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-3 space-y-4">
        {/* ── TOP HERO BANNER & PRIMARY CONTROLS ── */}
        <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-teal-950/40 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-black tracking-widest uppercase text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                Peer Study Network
              </span>
              <h1 className="text-lg font-black text-white mt-1">Study Groups & Audio</h1>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-1"
            >
              <span>+ Create Group</span>
            </button>
          </div>
        </div>

                {/* ── STUDY GROUPS DIRECTORY ── */}
{/* ── VIEW 2: CLASSIC STUDY GROUPS DIRECTORY ── */}
                  <div className="space-y-3.5">
            {/* Search & Exam Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <select
                value={examFilter}
                onChange={(e) => setExamFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-teal-400 font-bold focus:outline-none"
              >
                <option value="ALL">All Exams</option>
                <option value="JEE">JEE</option>
                <option value="NEET">NEET</option>
                <option value="BOARDS">Boards</option>
              </select>
            </div>

            {/* My Groups vs Browse Tabs */}
            <div className="flex border-b border-slate-800 text-xs font-bold text-slate-400">
              <button
                onClick={() => setActiveTab("my_groups")}
                className={`pb-2 px-3 border-b-2 transition-colors ${
                  activeTab === "my_groups"
                    ? "border-teal-400 text-teal-400 font-black"
                    : "border-transparent hover:text-slate-200"
                }`}
              >
                My Groups (
                {groups.filter((g) => g.user_membership_status === "member").length}
                )
              </button>
              <button
                onClick={() => setActiveTab("browse")}
                className={`pb-2 px-3 border-b-2 transition-colors ${
                  activeTab === "browse"
                    ? "border-teal-400 text-teal-400 font-black"
                    : "border-transparent hover:text-slate-200"
                }`}
              >
                Browse All ({groups.length})
              </button>
            </div>

            {/* Groups List */}
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500 font-mono animate-pulse">
                Loading study groups...
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="py-12 text-center space-y-2 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
                <span className="text-2xl">📚</span>
                <p className="text-xs font-bold text-slate-400">No study groups found</p>
                <p className="text-[10px] text-slate-500 max-w-xs mx-auto">
                  Be the first one to create a peer study circle for your target exam!
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 text-xs font-bold"
                >
                  Create Group Now
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredGroups.map((group) => {
                  const isMember = group.user_membership_status === "member";
                  const isPending = group.user_membership_status === "pending";

                  return (
                    <div
                      key={group.id}
                      className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/20">
                            {group.target_exam}
                          </span>
                          {group.is_private && (
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              Private 🔒
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">
                            👥 {group.member_count}
                          </span>
                        </div>

                        <h3 className="text-xs font-black text-white truncate">{group.name}</h3>
                        {group.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {group.description}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0">
                        {isMember ? (
                          <button
                            onClick={() => router.push(`/groups/${group.id}`)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-xs border border-slate-700 transition-colors"
                          >
                            Open Group →
                          </button>
                        ) : isPending ? (
                          <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                            Requested ⏳
                          </span>
                        ) : (
                          <button
                            onClick={() => handleJoinOrRequest(group)}
                            className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all shadow-sm active:scale-95"
                          >
                            {group.is_private ? "Request" : "Join"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        {/* ── VOICE CHANNELS (LIVE AUDIO ROOMS) ── */}
{/* ── VIEW 1: DISCORD VOICE CHANNELS DIRECTLY ON GROUPS PAGE ── */}
                  <div className="space-y-4">
            <DiscordVoiceHub
              channels={voiceChannels}
              activeChannelId={activeVoiceChannel?.id || null}
              onJoinChannel={handleJoinVoiceChannel}
              onCreateChannel={handleCreateCustomVoiceChannel}
              peerCounts={peerCounts}
            />
          </div>
      </main>

      {/* ── MINIMIZED FLOATING VOICE DOCK ── */}
      {activeVoiceChannel && !isStageModalOpen && (
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

      {/* ── DISCORD VOICE STAGE FULL MODAL ── */}
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
          chatMessages={voiceChatMessages}
          onSendMessage={handleSendVoiceChatMessage}
          onClearChat={handleClearVoiceChat}
        />
      )}

      {/* CREATE GROUP MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white">Create Study Group</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Chemistry Speed Drill"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Daily targets, PYQ solving..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 h-16 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Target Exam
                  </label>
                  <select
                    value={newGroupExam}
                    onChange={(e) => setNewGroupExam(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="JEE">JEE</option>
                    <option value="NEET">NEET</option>
                    <option value="BOARDS">Boards</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Access Type
                  </label>
                  <select
                    value={newGroupPrivate ? "private" : "public"}
                    onChange={(e) => setNewGroupPrivate(e.target.value === "private")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="public">Public (Open)</option>
                    <option value="private">Private (Approval)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup || !newGroupName.trim()}
                  className="flex-1 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs disabled:opacity-50"
                >
                  {creatingGroup ? "Creating..." : "Create Group"}
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
