"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface StudyRoomPanelProps {
  groupId: string;
  userId: string;
  displayName: string;
}

interface RemotePeer {
  id: string;
  name: string;
  stream: MediaStream | null;
}

const MAX_ROOM_SIZE = 4;
const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export default function StudyRoomPanel({ groupId, userId, displayName }: StudyRoomPanelProps) {
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [roomFull, setRoomFull] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<any>(null);
  const joinedRef = useRef(false);

  function createPeerConnection(remoteId: string, remoteName: string) {
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
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

  async function handleJoinRoom() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (e) {
      setError("Couldn't access camera/mic. Check your browser permissions.");
      return;
    }

    const channel = supabase.channel(`room:${groupId}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      if (count > MAX_ROOM_SIZE) {
        setRoomFull(true);
      }
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
        } catch (e) {}
      }
    });

    channel.on("broadcast", { event: "new-peer" }, async ({ payload }) => {
      if (payload.id === userId) return;
      const currentCount = Object.keys(channel.presenceState()).length;
      if (currentCount > MAX_ROOM_SIZE) return;

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
        const state = channel.presenceState();
        const existingCount = Object.keys(state).length;
        if (existingCount >= MAX_ROOM_SIZE) {
          setRoomFull(true);
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        await channel.track({ user_id: userId, name: displayName });
        channel.send({
          type: "broadcast",
          event: "new-peer",
          payload: { id: userId, name: displayName },
        });
        setJoined(true);
      }
    });
  }

  function handleLeaveRoom() {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "peer-left",
        payload: { id: userId },
      });
      supabase.removeChannel(channelRef.current);
    }
    setRemotePeers([]);
    setJoined(false);
    setRoomFull(false);
  }

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  useEffect(() => {
    return () => {
      if (joinedRef.current) handleLeaveRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMic() {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn(!micOn);
  }

  function toggleCam() {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn(!camOn);
  }

  if (!joined) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-2xl">🎥</p>
        <p className="text-xs font-bold text-ink">Live Study Room</p>
        <p className="text-[11px] text-slate">
          Turn on your camera/mic and study together, up to {MAX_ROOM_SIZE} people. Only works
          while this tab stays open in the foreground.
        </p>
        {error && <p className="text-[11px] text-rose-600 font-semibold">{error}</p>}
        {roomFull && (
          <p className="text-[11px] text-rose-600 font-semibold">
            Room is full ({MAX_ROOM_SIZE} max). Try again later.
          </p>
        )}
        <button
          onClick={handleJoinRoom}
          className="px-5 py-2.5 rounded-xl bg-teal text-white font-bold text-xs shadow-xs hover:bg-teal/90"
        >
          Join Room
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="relative aspect-video bg-ink rounded-xl overflow-hidden">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          <span className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded">
            You
          </span>
        </div>
        {remotePeers.map((peer) => (
          <RemoteVideo key={peer.id} peer={peer} />
        ))}
      </div>

      <div className="flex gap-2 justify-center pt-1">
        <button
          onClick={toggleMic}
          className={`px-3 py-2 rounded-xl text-xs font-bold border ${
            micOn ? "bg-white border-ink/15 text-ink" : "bg-rose-50 border-rose-200 text-rose-700"
          }`}
        >
          {micOn ? "🎤 On" : "🔇 Off"}
        </button>
        <button
          onClick={toggleCam}
          className={`px-3 py-2 rounded-xl text-xs font-bold border ${
            camOn ? "bg-white border-ink/15 text-ink" : "bg-rose-50 border-rose-200 text-rose-700"
          }`}
        >
          {camOn ? "📹 On" : "🚫 Off"}
        </button>
        <button
          onClick={handleLeaveRoom}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white"
        >
          Leave
        </button>
      </div>
    </div>
  );
}

function RemoteVideo({ peer }: { peer: RemotePeer }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div className="relative aspect-video bg-ink rounded-xl overflow-hidden">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <span className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded">
        {peer.name}
      </span>
    </div>
  );
      }
