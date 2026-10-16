// components/groups/FloatingVoiceDock.tsx
"use client";

import React from "react";

interface FloatingVoiceDockProps {
  channelName: string;
  participantCount: number;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onOpenStage: () => void;
  onDisconnect: () => void;
}

export default function FloatingVoiceDock({
  channelName,
  participantCount,
  isMuted,
  isDeafened,
  isSpeaking,
  onToggleMute,
  onToggleDeafen,
  onOpenStage,
  onDisconnect,
}: FloatingVoiceDockProps) {
  return (
    <div className="fixed bottom-20 left-3 right-3 max-w-md mx-auto z-40 animate-in slide-in-from-bottom-3 duration-200">
      <div className="p-2.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-2xl rounded-2xl flex items-center justify-between gap-2.5 text-white">
        {/* Left Side: Clickable Info Area that opens Stage Modal */}
        <button
          type="button"
          onClick={onOpenStage}
          className="flex-1 flex items-center gap-2.5 text-left min-w-0 group hover:opacity-90 transition-opacity"
        >
          <div className="relative shrink-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isSpeaking && !isMuted
                ? "bg-emerald-500/30 border border-emerald-400 text-emerald-300 ring-2 ring-emerald-400/50"
                : "bg-teal-500/20 border border-teal-500/40 text-teal-300"
            }`}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            </div>
            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
              isSpeaking && !isMuted ? "bg-emerald-400 animate-pulse" : "bg-emerald-500"
            }`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white truncate block">
                {channelName}
              </span>
              <svg className="w-3 h-3 text-slate-400 group-hover:translate-y-[-1px] transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </div>
            <div className="flex items-center gap-2 text-[9.5px] font-bold text-slate-400">
              <span className="text-emerald-400 flex items-center gap-1">
                <span>RTC Connected</span>
              </span>
              <span>·</span>
              <span>{participantCount} in room</span>
            </div>
          </div>
        </button>

        {/* Right Side: Quick Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mic Toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            title={isMuted ? "Unmute" : "Mute"}
            className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all active:scale-95 ${
              isMuted
                ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
                : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
            }`}
          >
            {isMuted ? (
              <svg className="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            )}
          </button>

          {/* Deafen Toggle */}
          <button
            type="button"
            onClick={onToggleDeafen}
            title={isDeafened ? "Undeafen" : "Deafen"}
            className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all active:scale-95 ${
              isDeafened
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
            }`}
          >
            <svg className={`w-3.5 h-3.5 ${isDeafened ? "text-amber-400" : "text-slate-300"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
              {isDeafened && <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2.5" />}
            </svg>
          </button>

          {/* Disconnect Button */}
          <button
            type="button"
            onClick={onDisconnect}
            title="Disconnect"
            className="w-8 h-8 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-md active:scale-95 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
