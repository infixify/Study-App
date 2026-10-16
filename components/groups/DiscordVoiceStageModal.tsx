// components/groups/DiscordVoiceStageModal.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

export interface VoicePeer {
  id: string;
  name: string;
  stream: MediaStream | null;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
}

export interface VoiceChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
}

interface DiscordVoiceStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  userId: string;
  displayName: string;
  onLeaveChannel: () => void;
  isMuted: boolean;
  isDeafened: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  localStream: MediaStream | null;
  remotePeers: VoicePeer[];
  screenStream: MediaStream | null;
  onToggleScreenShare: () => void;
  isScreenSharing: boolean;
  camStream: MediaStream | null;
  onToggleCamera: () => void;
  isCameraOn: boolean;
  isLocalSpeaking: boolean;
  // Ephemeral Chat props
  chatMessages?: VoiceChatMessage[];
  onSendMessage?: (text: string) => void;
  onClearChat?: () => void;
}

const QUICK_REACTIONS = [
  "Doubt ❓",
  "Got it! 👍",
  "Check notes 📝",
  "Formula 💡",
  "Mic mute 🔇",
];

export default function DiscordVoiceStageModal({
  isOpen,
  onClose,
  channelId,
  channelName,
  userId,
  displayName,
  onLeaveChannel,
  isMuted,
  isDeafened,
  onToggleMute,
  onToggleDeafen,
  localStream,
  remotePeers,
  screenStream,
  onToggleScreenShare,
  isScreenSharing,
  camStream,
  onToggleCamera,
  isCameraOn,
  isLocalSpeaking,
  chatMessages = [],
  onSendMessage,
  onClearChat,
}: DiscordVoiceStageModalProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const prevCountRef = useRef(chatMessages.length);

  // Unread badge tracking & auto-scroll
  useEffect(() => {
    if (chatMessages.length > prevCountRef.current) {
      if (!isChatOpen) {
        setUnreadCount((c) => c + (chatMessages.length - prevCountRef.current));
      } else {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
    prevCountRef.current = chatMessages.length;
  }, [chatMessages.length, isChatOpen]);

  // Video stream attachments
  useEffect(() => {
    if (localVideoRef.current && camStream) {
      localVideoRef.current.srcObject = camStream;
    }
  }, [camStream, isCameraOn]);

  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream, isScreenSharing]);

  const handleToggleChat = () => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (next) {
        setUnreadCount(0);
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
          inputRef.current?.focus();
        }, 150);
      }
      return next;
    });
  };

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !onSendMessage) return;
    onSendMessage(chatInput.trim());
    setChatInput("");
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const handleQuickReaction = (text: string) => {
    if (!onSendMessage) return;
    onSendMessage(text);
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0F172A] border border-slate-800 text-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* ── TOP HEADER ── */}
        <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <h3 className="text-xs font-black text-white tracking-wide truncate">
                  {channelName}
                </h3>
              </div>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {remotePeers.length + 1} connected · Voice Stage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Header Chat Toggle Button with Unread Badge */}
            <button
              onClick={handleToggleChat}
              title={isChatOpen ? "Hide Voice Chat" : "Open Voice Chat"}
              className={`relative px-2.5 py-1 rounded-xl text-[10px] font-bold border flex items-center gap-1.5 transition-all active:scale-95 ${
                isChatOpen
                  ? "bg-teal-500/20 border-teal-500/50 text-teal-300"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v7.018z" />
              </svg>
              <span>Chat</span>
              {unreadCount > 0 && !isChatOpen && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Minimize */}
            <button
              onClick={onClose}
              title="Minimize to floating dock"
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 flex items-center gap-1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
              <span>Minimize</span>
            </button>
          </div>
        </div>

        {/* ── STAGE MAIN AREA (SCROLLABLE GRID) ── */}
        <div className="p-3.5 flex-1 overflow-y-auto space-y-3">
          {/* Active Screen Share Tile (if any) */}
          {isScreenSharing && screenStream && (
            <div className="relative aspect-video w-full bg-slate-950 rounded-2xl overflow-hidden border border-teal-500/40 shadow-lg">
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain bg-black"
              />
              <div className="absolute top-2 left-2 bg-slate-900/90 border border-teal-400/50 px-2 py-0.5 rounded-lg flex items-center gap-1.5 text-[9px] font-bold text-teal-300">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                <span>Your Screen Share (Study Notes)</span>
              </div>
            </div>
          )}

          {/* Participant Cards Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Local User Card */}
            <div
              className={`relative p-3 rounded-2xl border transition-all flex flex-col items-center justify-center text-center gap-2 min-h-[125px] ${
                isLocalSpeaking && !isMuted
                  ? "bg-slate-800/90 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)] ring-2 ring-emerald-400/60"
                  : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
              }`}
            >
              {isCameraOn && camStream ? (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-700 mb-1">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-bold text-white">
                    Live Cam
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <div
                    className={`w-13 h-13 rounded-full flex items-center justify-center text-base font-black transition-all ${
                      isLocalSpeaking && !isMuted
                        ? "bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-md ring-4 ring-emerald-400/80 animate-pulse"
                        : "bg-gradient-to-tr from-slate-700 to-slate-600 text-white"
                    }`}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  {/* Status Badges */}
                  <div className="absolute -bottom-1 -right-1 flex gap-0.5">
                    {isMuted && (
                      <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shadow border border-slate-900" title="Muted">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      </span>
                    )}
                    {isDeafened && (
                      <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] shadow border border-slate-900" title="Deafened">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="w-full">
                <span className="text-xs font-black text-white truncate block">
                  {displayName} (You)
                </span>
                <span className={`text-[9px] font-bold block ${
                  isLocalSpeaking && !isMuted ? "text-emerald-400" : isMuted ? "text-rose-400" : "text-slate-400"
                }`}>
                  {isLocalSpeaking && !isMuted ? "Speaking..." : isMuted ? "Muted" : "Connected"}
                </span>
              </div>
            </div>

            {/* Remote Peers Cards */}
            {remotePeers.map((peer) => (
              <RemotePeerCard
                key={peer.id}
                peer={peer}
                isDeafenedGlobal={isDeafened}
              />
            ))}

            {/* Empty Spot Placeholders */}
            {remotePeers.length === 0 && (
              <div className="p-3.5 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 flex flex-col items-center justify-center text-center gap-1 text-slate-500 min-h-[125px]">
                <span className="text-xl">👋</span>
                <span className="text-[11px] font-bold text-slate-400">Waiting for peers</span>
                <span className="text-[9px] text-slate-600">Share with group mates to study together</span>
              </div>
            )}
          </div>
        </div>

        {/* ── EPHEMERAL VOICE CHAT DRAWER / OVERLAY ── */}
        {isChatOpen && (
          <div className="border-t border-slate-800/90 bg-slate-900/95 flex flex-col h-[280px] shrink-0 animate-in slide-in-from-bottom-2 duration-150">
            {/* Chat Drawer Header */}
            <div className="px-3.5 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-teal-400 font-bold text-xs">#</span>
                <span className="text-xs font-bold text-slate-200">Voice Channel Chat</span>
                <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md font-mono">
                  {chatMessages.length} msgs
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {onClearChat && chatMessages.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearChat}
                    title="Clear current voice chat"
                    className="text-[9px] text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded hover:bg-rose-500/10 font-bold transition-colors"
                  >
                    Clear Chat
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsChatOpen(false)}
                  className="w-5 h-5 rounded-md text-slate-400 hover:text-white flex items-center justify-center hover:bg-slate-800 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Ephemeral Notice Banner */}
            <div className="px-3 py-1 bg-teal-950/40 border-b border-teal-500/20 flex items-center justify-between text-[9px] text-teal-300">
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <span className="truncate">
                  Voice channel band/khali hote hi chat automatically clear ho jayegi.
                </span>
              </div>
              <span className="font-semibold text-teal-200 shrink-0 ml-1">Ephemeral</span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-3 text-slate-500">
                  <span className="text-lg mb-1">💬</span>
                  <p className="text-[11px] font-bold text-slate-400">No messages yet in this voice room</p>
                  <p className="text-[9px] text-slate-500 max-w-xs mt-0.5">
                    Send quick study links, PYQ questions, or formulas while speaking!
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMine = msg.senderId === userId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-baseline gap-1.5 mb-0.5">
                        <span className={`text-[9px] font-bold ${isMine ? "text-teal-400" : "text-indigo-400"}`}>
                          {isMine ? "You" : msg.senderName}
                        </span>
                        <span className="text-[8px] text-slate-500">{msg.timestamp}</span>
                      </div>
                      <div
                        className={`px-3 py-1.5 rounded-2xl text-[11px] leading-relaxed max-w-[85%] break-words ${
                          isMine
                            ? "bg-teal-600 text-white rounded-tr-xs shadow-sm"
                            : "bg-slate-800 text-slate-200 rounded-tl-xs border border-slate-700/80"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Reactions Bar */}
            <div className="px-3 py-1 bg-slate-950/50 border-t border-slate-800/60 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
              {QUICK_REACTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleQuickReaction(tag)}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-medium shrink-0 border border-slate-700 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Chat Input Form */}
            <form
              onSubmit={handleSendChat}
              className="p-2 border-t border-slate-800 bg-slate-950/80 flex items-center gap-1.5 shrink-0"
            >
              <input
                ref={inputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send a study note or doubt..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:hover:bg-teal-500 text-slate-950 font-black text-xs transition-all flex items-center gap-1 shrink-0"
              >
                <span>Send</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                </svg>
              </button>
            </form>
          </div>
        )}

        {/* ── BOTTOM CONTROL BAR ── */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/90 shrink-0">
          <div className="flex items-center justify-between gap-1.5">
            {/* Mic Button */}
            <button
              onClick={onToggleMute}
              className={`flex-1 py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                isMuted
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
                  : "bg-slate-800 border-slate-700 text-white hover:bg-slate-750"
              }`}
            >
              {isMuted ? (
                <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              )}
              <span className="text-[9px] font-bold">{isMuted ? "Unmute" : "Mute"}</span>
            </button>

            {/* Deafen Button */}
            <button
              onClick={onToggleDeafen}
              className={`flex-1 py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                isDeafened
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                  : "bg-slate-800 border-slate-700 text-white hover:bg-slate-750"
              }`}
            >
              <svg className={`w-4 h-4 ${isDeafened ? "text-amber-400" : "text-slate-300"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
                {isDeafened && <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2.5" />}
              </svg>
              <span className="text-[9px] font-bold">{isDeafened ? "Deafened" : "Deafen"}</span>
            </button>

            {/* Camera Button */}
            <button
              onClick={onToggleCamera}
              className={`flex-1 py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                isCameraOn
                  ? "bg-teal-500/20 border-teal-500/40 text-teal-300"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <span className="text-[9px] font-bold">{isCameraOn ? "Cam On" : "Cam"}</span>
            </button>

            {/* Screen Share Button */}
            <button
              onClick={onToggleScreenShare}
              className={`flex-1 py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                isScreenSharing
                  ? "bg-indigo-500/30 border-indigo-500/60 text-indigo-300 shadow-sm"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span className="text-[9px] font-bold">{isScreenSharing ? "Sharing" : "Share"}</span>
            </button>

            {/* Chat Toggle Button with Unread Badge */}
            <button
              onClick={handleToggleChat}
              className={`relative flex-1 py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                isChatOpen
                  ? "bg-teal-500/30 border-teal-500/60 text-teal-300 shadow-sm"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
              }`}
            >
              <div className="relative">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v7.018z" />
                </svg>
                {unreadCount > 0 && !isChatOpen && (
                  <span className="absolute -top-1 -right-2.5 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-bold">{isChatOpen ? "Hide Chat" : "Chat"}</span>
            </button>

            {/* Disconnect / Leave Button */}
            <button
              onClick={onLeaveChannel}
              className="py-2 px-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md flex flex-col items-center gap-1 active:scale-95 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-[9px] font-bold">Leave</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── REMOTE PEER CARD COMPONENT ──
function RemotePeerCard({
  peer,
  isDeafenedGlobal,
}: {
  peer: VoicePeer;
  isDeafenedGlobal: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPeerSpeaking, setIsPeerSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Attach audio stream
  useEffect(() => {
    if (audioRef.current && peer.stream) {
      audioRef.current.srcObject = peer.stream;
      audioRef.current.muted = isDeafenedGlobal;
    }
  }, [peer.stream, isDeafenedGlobal]);

  // Audio level analyzer for remote speaking indicator
  useEffect(() => {
    if (!peer.stream) return;
    const audioTrack = peer.stream.getAudioTracks()[0];
    if (!audioTrack) return;

    let animId: number;
    let ctx: AudioContext | null = null;
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const checkVolume = () => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        setIsPeerSpeaking(avg > 14);
        animId = requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch (_) {}

    return () => {
      cancelAnimationFrame(animId);
      if (ctx && ctx.state !== "closed") {
        ctx.close().catch(() => {});
      }
    };
  }, [peer.stream]);

  const hasVideo = peer.stream && peer.stream.getVideoTracks().length > 0;

  useEffect(() => {
    if (videoRef.current && peer.stream && hasVideo) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream, hasVideo]);

  return (
    <div
      className={`relative p-3 rounded-2xl border transition-all flex flex-col items-center justify-center text-center gap-2 min-h-[125px] ${
        isPeerSpeaking && !peer.isMuted
          ? "bg-slate-800/90 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)] ring-2 ring-emerald-400/60"
          : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
      }`}
    >
      <audio ref={audioRef} autoPlay playsInline />

      {hasVideo ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-700 mb-1">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <span className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-bold text-white">
            {peer.name}
          </span>
        </div>
      ) : (
        <div className="relative">
          <div
            className={`w-13 h-13 rounded-full flex items-center justify-center text-base font-black transition-all ${
              isPeerSpeaking && !peer.isMuted
                ? "bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-md ring-4 ring-emerald-400/80 animate-pulse"
                : "bg-gradient-to-tr from-indigo-700 to-blue-600 text-white"
            }`}
          >
            {peer.name.charAt(0).toUpperCase()}
          </div>
          {peer.isMuted && (
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shadow border border-slate-900">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </span>
          )}
        </div>
      )}

      <div className="w-full">
        <span className="text-xs font-black text-white truncate block">
          {peer.name}
        </span>
        <span className={`text-[9px] font-bold block ${
          isPeerSpeaking && !peer.isMuted ? "text-emerald-400" : peer.isMuted ? "text-rose-400" : "text-slate-400"
        }`}>
          {isPeerSpeaking && !peer.isMuted ? "Speaking..." : peer.isMuted ? "Muted" : "Listening"}
        </span>
      </div>
    </div>
  );
}
