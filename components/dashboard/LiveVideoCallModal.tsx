"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

export interface LiveVideoCallModalProps {
  open: boolean;
  onClose: () => void;
  studentContext?: {
    studentName?: string;
    targetExam?: string;
  };
}

interface LiveMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  time: string;
  provider?: string;
}

// ─── PHONETIC TEACHER NORMALIZER (CLEANS MATH & STRIPS ASTERISKS FOR NATURAL SPEECH) ───
function cleanTextForNaturalSpeech(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // 1. Remove Markdown syntax & asterisks
  text = text.replace(/\*\*(.*?)\*\*/g, "$1");
  text = text.replace(/\*(.*?)\*/g, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/#+\s*/g, "");
  text = text.replace(/Step \d+:\s*/gi, "");
  text = text.replace(/[-*•]\s+/g, "");

  // 2. Phonetic Math & Science Symbol Replacements
  text = text.replace(/(\w+)\^2\b/g, "$1 square");
  text = text.replace(/(\w+)\^3\b/g, "$1 cube");
  text = text.replace(/x²/g, "x square");
  text = text.replace(/y²/g, "y square");
  text = text.replace(/r²/g, "r square");
  text = text.replace(/v²/g, "v square");
  text = text.replace(/u²/g, "u square");
  text = text.replace(/√(\w+|\([^)]+\))/g, "under-root $1");
  text = text.replace(/√/g, "under-root ");

  text = text.replace(/ΔT/g, "delta T");
  text = text.replace(/Δ/g, "delta ");
  text = text.replace(/θ/g, "theta");
  text = text.replace(/λ/g, "lambda");
  text = text.replace(/Ω/g, "ohm");
  text = text.replace(/μ/g, "mu");
  text = text.replace(/π/g, "pi");
  text = text.replace(/≠/g, "not equal to");
  text = text.replace(/≈/g, "lagbhag");
  text = text.replace(/±/g, "plus minus");
  text = text.replace(/°C/g, "degree celsius");

  // Common physics equations spoken rhythm
  text = text.replace(/v\s*=\s*u\s*\+\s*at/gi, "v equals u plus a t");
  text = text.replace(/F\s*=\s*ma/gi, "F equals m a");

  // Clean trailing spaces and limit spoken length to 350 chars for swift pacing
  return text.trim().slice(0, 350);
}

// ─── SYNTHESIZED SOUND EFFECTS (WEB AUDIO EARCONS) ───
function playUiTone(type: "press" | "send" | "ai") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === "press") {
      // Soft high-tech pop
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === "send") {
      // Crisp confirmation swoosh
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else {
      // AI response bell
      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch (_) {}
}

export function LiveVideoCallModal({ open, onClose, studentContext }: LiveVideoCallModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  
  // Floating HUD View Modes: "compact" (bottom preview) | "expanded" (full sheet) | "hidden"
  const [hudMode, setHudMode] = useState<"compact" | "expanded" | "hidden">("compact");
  
  // Press & Hold State
  const [isHoldingMic, setIsHoldingMic] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [flashTrigger, setFlashTrigger] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);
  const holdStartTimeRef = useRef<number>(0);
  const ttsHeartbeatRef = useRef<any>(null);

  // 1. Call Duration Timer
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [open]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // 2. Camera Stream Handler
  const startCamera = useCallback(async (mode: "environment" | "user") => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      setStream(media);
      if (videoRef.current) {
        videoRef.current.srcObject = media;
      }
    } catch (err) {
      console.error("Camera access failed:", err);
    }
  }, [stream]);

  // Teardown / Cleanup
  const stopAll = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (ttsHeartbeatRef.current) {
      clearInterval(ttsHeartbeatRef.current);
    }
    setIsAiSpeaking(false);
    setIsHoldingMic(false);
    setCallDuration(0);
    setTranscript("");
    setMessages([]);
    setHudMode("compact");
  }, [stream]);

  useEffect(() => {
    if (open) {
      startCamera(facingMode);
    } else {
      stopAll();
    }
    return () => {
      stopAll();
    };
  }, [open, facingMode]);

  // 3. Mute / Unmute Microphone
  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  // 4. Flip Camera Switch (Rear <-> Front)
  const toggleCameraSwitch = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // 5. Natural Indian Teacher Speech Engine with 8s Heartbeat Keep-Alive (Rule 15)
  const speakResponse = (rawText: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    if (ttsHeartbeatRef.current) clearInterval(ttsHeartbeatRef.current);

    const speechText = cleanTextForNaturalSpeech(rawText);
    if (!speechText) return;

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick Indian Teacher Neural / Standard Voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((v) => v.name.includes("Google") && (v.lang === "hi-IN" || v.lang === "en-IN")) ||
      voices.find((v) => v.name.includes("Neerja") || v.name.includes("Heera") || v.name.includes("Prabhat")) ||
      voices.find((v) => v.lang === "hi-IN") ||
      voices.find((v) => v.lang === "en-IN");

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    utterance.lang = preferredVoice?.lang || "hi-IN";

    utterance.onstart = () => {
      setIsAiSpeaking(true);
      // 8-Second Heartbeat to prevent Android Chrome 15s GC silence
      ttsHeartbeatRef.current = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          clearInterval(ttsHeartbeatRef.current);
        }
      }, 8000);
    };

    utterance.onend = () => {
      setIsAiSpeaking(false);
      if (ttsHeartbeatRef.current) clearInterval(ttsHeartbeatRef.current);
    };

    utterance.onerror = () => {
      setIsAiSpeaking(false);
      if (ttsHeartbeatRef.current) clearInterval(ttsHeartbeatRef.current);
    };

    playUiTone("ai");
    window.speechSynthesis.speak(utterance);
  };

  // 6. Send Frame Snapshot & Spoken Transcript to Backend Pool
  const sendLiveDoubt = async (spokenText?: string) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setHudMode("compact");

    // Flash animation on send
    setFlashTrigger(true);
    setTimeout(() => setFlashTrigger(false), 120);

    let frameBase64 = "";
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = Math.min(video.videoWidth || 640, 640);
      canvas.height = Math.min(video.videoHeight || 480, 480);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frameBase64 = canvas.toDataURL("image/jpeg", 0.72);
      }
    }

    const userQuery = spokenText?.trim() || transcript.trim() || "Camera par jo question hai use step-by-step samjha do.";

    const userMsg: LiveMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: userQuery,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTranscript("");

    try {
      const res = await fetch("/api/ai-doubt/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frame: frameBase64,
          message: userQuery,
          studentContext,
        }),
      });

      const data = await res.json();
      const aiReply = data?.reply || "Sawal clear nahi dikha, camera thoda nazdeek laayein.";

      const aiMsg: LiveMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: aiReply,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        provider: data?.model || "AI Faculty",
      };
      setMessages((prev) => [...prev, aiMsg]);
      speakResponse(aiReply);
    } catch {
      const errMsg: LiveMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: "Network slow hai. Kripya sawal dobara puchiye.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 7. Push-To-Talk (Walkie-Talkie Press & Hold) Handlers
  const handleHoldStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (isAnalyzing) return;

    holdStartTimeRef.current = Date.now();
    setIsHoldingMic(true);
    setTranscript("");

    // Barge-in: immediately cancel ongoing speech
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsAiSpeaking(false);
    }

    // Haptic & Sound Earcon
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(40);
    }
    playUiTone("press");

    // Start Web Speech listener (Rule 14: continuous=false for Android mobile chrome)
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch (_) {}
        }
        const recognition = new SpeechRecognition();
        recognition.lang = "en-IN";
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let curr = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            curr += event.results[i][0].transcript;
          }
          if (curr) setTranscript(curr);
        };

        recognition.onerror = () => {};
        recognitionRef.current = recognition;
        recognition.start();
      } catch (_) {}
    }
  };

  const handleHoldEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isHoldingMic) return;

    setIsHoldingMic(false);
    playUiTone("send");

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }

    // Small delay to capture final speech result buffer
    setTimeout(() => {
      sendLiveDoubt();
    }, 250);
  };

  if (!open) return null;

  const latestAiMessage = [...messages].reverse().find((m) => m.sender === "ai");

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none">
      {/* Background Live Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Screen White Flash Effect on Question Snap */}
      {flashTrigger && (
        <div className="absolute inset-0 bg-white/40 z-30 pointer-events-none transition-opacity duration-150 animate-pulse" />
      )}

      {/* Dark Vignette Overlay for Readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-transparent to-black/95 pointer-events-none" />

      {/* TOP HEADER: Status Badge, Live Timer, AI Speaking Equalizer & Camera Switch */}
      <div className="relative z-20 flex items-center justify-between p-4 pt-6">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-md">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-black text-white tracking-wide">LIVE AI FACULTY</span>
          <span className="text-[11px] font-mono font-bold text-slate-300">· {formatTime(callDuration)}</span>
        </div>

        {/* Live Audio Speaking Wave (When AI explains) */}
        {isAiSpeaking && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-md animate-pulse">
            <span>🔊</span>
            <span className="text-[10px] tracking-wide">Speaking...</span>
          </div>
        )}

        {/* Camera Switch (Front/Back) */}
        <button
          type="button"
          onClick={toggleCameraSwitch}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 text-xs font-bold transition active:scale-95 shadow-md"
          title="Switch Camera (Back/Front)"
        >
          <span>🔄</span>
          <span className="text-[11px] font-semibold">{facingMode === "environment" ? "Back" : "Front"}</span>
        </button>
      </div>

      {/* REAL-TIME SPEECH TRANSCRIPT FLOATING PILL */}
      {transcript && (
        <div className="relative z-20 mx-auto max-w-xs px-4 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-emerald-500/40 text-center shadow-lg">
          <p className="text-[11.5px] font-semibold text-emerald-300 truncate">🎙️ "{transcript}"</p>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* BOTTOM-ALIGNED FLOATING HUD (COMPACT PREVIEW & EXPANDED SHEET) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative z-20 max-w-sm mx-auto w-full px-4 mb-2 mt-auto">
        {hudMode === "expanded" ? (
          /* EXPANDED FULL SHEET DRAWER (PULLED UP OR TOGGLED BY CHAT BUTTON) */
          <div className="bg-slate-900/90 backdrop-blur-xl border border-teal-500/40 rounded-3xl p-4 shadow-2xl space-y-2.5 transition-all max-h-[55vh] flex flex-col">
            {/* Drag Handle & Minimize Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-400" />
                <h5 className="text-xs font-black text-teal-300 uppercase tracking-wider">
                  Live Solution Steps & Notes
                </h5>
              </div>
              <button
                type="button"
                onClick={() => setHudMode("compact")}
                className="text-slate-300 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-white/10 font-bold"
              >
                Minimize ▾
              </button>
            </div>

            {/* Scrollable Message History */}
            <div className="space-y-2 overflow-y-auto pr-1 flex-1">
              {messages.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs font-bold text-white">Book ya question camera ke samne rakhein</p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Niche <span className="text-emerald-400 font-bold">Mic daba kar</span> sawal puchein.
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded-2xl text-xs ${
                      m.sender === "user"
                        ? "bg-teal-950/70 border border-teal-500/30 text-teal-100 ml-4 text-right"
                        : "bg-slate-800/90 border border-slate-700/60 text-slate-100"
                    }`}
                  >
                    <div className="text-[9px] font-mono text-slate-400 mb-0.5">
                      {m.sender === "user" ? "You" : m.provider || "AI Faculty"} · {m.time}
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                  </div>
                ))
              )}

              {isAnalyzing && (
                <div className="flex items-center gap-2 bg-teal-950/60 border border-teal-500/30 rounded-xl px-3 py-1.5 w-fit">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                  <span className="text-[11px] font-bold text-teal-200">AI Faculty analyze kar raha hai...</span>
                </div>
              )}
            </div>
          </div>
        ) : hudMode === "compact" && latestAiMessage ? (
          /* COMPACT BOTTOM PREVIEW CARD (LEAVES SCREEN CLEAR FOR CAMERA) */
          <div
            onClick={() => setHudMode("expanded")}
            className="w-full bg-slate-900/85 backdrop-blur-md border border-teal-500/30 rounded-2xl p-3 text-left shadow-xl active:scale-98 transition cursor-pointer flex items-center justify-between group"
          >
            <div className="truncate mr-2.5 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                <span className="text-[9.5px] font-mono font-bold text-teal-300 uppercase tracking-wide">
                  Latest Solution
                </span>
              </div>
              <p className="text-xs text-white truncate font-medium">{latestAiMessage.text}</p>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-teal-300 bg-teal-500/20 border border-teal-500/30 px-2.5 py-1.5 rounded-xl shrink-0 font-bold group-hover:bg-teal-500/30">
              <span>View All</span>
              <span>💬</span>
            </div>
          </div>
        ) : isAnalyzing ? (
          /* Analyzing Pill */
          <div className="mx-auto w-fit flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-teal-500/30 rounded-full px-4 py-2 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span className="text-xs font-bold text-teal-200">AI Faculty analyzing camera question...</span>
          </div>
        ) : null}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* BOTTOM CONTROLS DOCK & PUSH-TO-TALK (HOLD MIC) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative z-20 p-4 pb-8 flex flex-col items-center gap-2.5 bg-gradient-to-t from-black via-black/90 to-transparent">
        {/* Dynamic Context Helper Badge (Requested by user) */}
        <div className="px-3.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-center shadow-md">
          <p className="text-[10px] font-semibold text-slate-300">
            {isHoldingMic ? (
              <span className="text-emerald-400 font-bold animate-pulse">
                🔴 Listening... Sawal boliye (Release karte hi solve hoga)
              </span>
            ) : (
              <span>🎙️ Hold mic to speak · Chhodte hi AI solve karega</span>
            )}
          </p>
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-center gap-4 w-full max-w-xs">
          {/* 1. Mute/Unmute Audio Toggle */}
          <button
            type="button"
            onClick={toggleMic}
            className={`p-3.5 rounded-full transition-all active:scale-95 shadow-xl ${
              isMuted
                ? "bg-rose-600 text-white border border-rose-400"
                : "bg-slate-800/90 text-slate-300 border border-slate-700 hover:bg-slate-700"
            }`}
            title={isMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {isMuted ? "🔇" : "🔈"}
          </button>

          {/* 2. PUSH-TO-TALK (PRESS & HOLD MIC SYSTEM) */}
          <button
            type="button"
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            disabled={isAnalyzing}
            className={`px-6 py-4 rounded-full font-black text-sm tracking-wide shadow-2xl transition-all flex items-center gap-2.5 select-none ${
              isHoldingMic
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white scale-105 ring-4 ring-emerald-400/50 shadow-emerald-500/50"
                : "bg-gradient-to-r from-teal-500 via-teal-600 to-emerald-600 text-white hover:from-teal-400 hover:to-emerald-500 active:scale-95 shadow-teal-500/30"
            } ${isAnalyzing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {isHoldingMic ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                <span className="tracking-wide">Release to Solve</span>
              </>
            ) : (
              <>
                <span className="text-base">🎙️</span>
                <span>{isAnalyzing ? "Solving..." : "Hold to Ask"}</span>
              </>
            )}
          </button>

          {/* 3. Open/Expand Full Chat Drawer */}
          <button
            type="button"
            onClick={() => setHudMode(hudMode === "expanded" ? "compact" : "expanded")}
            className={`p-3.5 rounded-full transition-all active:scale-95 shadow-xl ${
              hudMode === "expanded"
                ? "bg-indigo-600 text-white border border-indigo-400"
                : "bg-slate-800/90 text-slate-300 border border-slate-700 hover:bg-slate-700"
            }`}
            title="Toggle Solution Steps & Chat"
          >
            💬
          </button>

          {/* 4. End Call Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-3.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl active:scale-95 transition-all border border-rose-500"
            title="End Video Call"
          >
            🔴
          </button>
        </div>
      </div>
    </div>
  );
}

export default LiveVideoCallModal;
