// components/groups/DiscordVoiceHub.tsx
"use client";

import React, { useState } from "react";

export interface VoiceChannelData {
  id: string;
  name: string;
  topic: string;
  maxParticipants: number;
  category: "official" | "custom";
  isSilentFocus?: boolean;
}

export const INITIAL_OFFICIAL_CHANNELS: VoiceChannelData[] = [
  {
    id: "official-general-lounge",
    name: "General Study Lounge",
    topic: "Open mic peer study hangout & revision",
    maxParticipants: 6,
    category: "official",
  },
  {
    id: "official-doubt-room",
    name: "Doubt Solving & PYQs",
    topic: "Share screens for question papers & HC Verma doubts",
    maxParticipants: 6,
    category: "official",
  },
  {
    id: "official-silent-focus",
    name: "Late Night Silent Focus",
    topic: "Strict quiet pomodoro session (default muted)",
    maxParticipants: 8,
    category: "official",
    isSilentFocus: true,
  },
];

interface DiscordVoiceHubProps {
  channels: VoiceChannelData[];
  activeChannelId: string | null;
  onJoinChannel: (channel: VoiceChannelData) => void;
  onCreateChannel: (name: string, topic: string, maxParticipants: number) => void;
  peerCounts: Record<string, number>;
}

export default function DiscordVoiceHub({
  channels,
  activeChannelId,
  onJoinChannel,
  onCreateChannel,
  peerCounts,
}: DiscordVoiceHubProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomTopic, setNewRoomTopic] = useState("");
  const [newRoomLimit, setNewRoomLimit] = useState(6);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    onCreateChannel(newRoomName.trim(), newRoomTopic.trim() || "Peer Study Discussion", newRoomLimit);
    setNewRoomName("");
    setNewRoomTopic("");
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-3.5">
      {/* ──── HEADER & BADGE ──── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-600">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          </div>
          <div>
            <h2 className="text-xs font-black text-slate-900 tracking-wide uppercase">
              Voice Channels
            </h2>
            <p className="text-[10px] text-slate-500 font-medium">
              Join live audio rooms or share screens to study together
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-[10px] font-bold border border-teal-200 transition-colors flex items-center gap-1 shadow-2xs"
        >
          <span>+ Create Room</span>
        </button>
      </div>

      {/* ──── CHANNELS LIST ──── */}
      <div className="space-y-2.5">
        {channels.map((ch) => {
          const isConnected = activeChannelId === ch.id;
          const count = (peerCounts[ch.id] || 0) + (isConnected ? 1 : 0);
          const isFull = count >= ch.maxParticipants && !isConnected;

          return (
            <div
              key={ch.id}
              onClick={() => {
                if (!isFull) onJoinChannel(ch);
              }}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group select-none ${
                isConnected
                  ? "bg-gradient-to-r from-slate-900 via-slate-850 to-teal-950 text-white border-teal-500 shadow-md ring-1 ring-teal-500/50"
                  : isFull
                  ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                  : "bg-white hover:bg-slate-50/80 border-slate-200/90 text-slate-900 shadow-2xs hover:shadow-xs hover:border-teal-400"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold shadow-2xs ${
                    isConnected
                      ? "bg-teal-500/30 text-teal-300 border border-teal-400/50"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}>
                    {ch.isSilentFocus ? "🤫" : "🔊"}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className={`text-xs font-black tracking-tight truncate ${
                        isConnected ? "text-white" : "text-slate-900"
                      }`}>
                        {ch.name}
                      </h3>
                      {ch.category === "custom" && (
                        <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-200 text-indigo-700">
                          Custom
                        </span>
                      )}
                      {ch.isSilentFocus && (
                        <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-amber-50 border border-amber-200 text-amber-700">
                          Mute Pod
                        </span>
                      )}
                    </div>
                    <p className={`text-[10px] mt-0.5 truncate ${
                      isConnected ? "text-slate-300" : "text-slate-500"
                    }`}>
                      {ch.topic}
                    </p>
                  </div>
                </div>

                {/* Right side: Count & Action Pill */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    isConnected
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : count > 0
                      ? "bg-teal-50 text-teal-700 border-teal-200"
                      : "bg-slate-100 text-slate-500 border-slate-200"
                  }`}>
                    {count}/{ch.maxParticipants}
                  </span>

                  <button
                    type="button"
                    disabled={isFull}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                      isConnected
                        ? "bg-emerald-500 text-slate-950 font-black shadow-xs"
                        : isFull
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-slate-900 group-hover:bg-teal-600 text-white shadow-2xs"
                    }`}
                  >
                    {isConnected ? "Connected" : isFull ? "Full" : "Join Voice"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ──── CREATE CHANNEL MODAL ──── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔊</span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Create Voice Channel</h3>
                  <p className="text-[10px] text-slate-500">Live audio room on the Groups page</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Channel Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physics HCV Numericals Lounge"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Topic / Agenda
                </label>
                <input
                  type="text"
                  placeholder="e.g. Solving Rotational Motion doubts together"
                  value={newRoomTopic}
                  onChange={(e) => setNewRoomTopic(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Room Capacity (Max Participants)
                </label>
                <div className="flex gap-2">
                  {[4, 6, 8].map((limit) => (
                    <button
                      key={limit}
                      type="button"
                      onClick={() => setNewRoomLimit(limit)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                        newRoomLimit === limit
                          ? "bg-teal-500 text-white border-teal-600 shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {limit} Peers
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
