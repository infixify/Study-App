"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface LiveVideoCallModalProps {
  open: boolean;
  onClose: () => void;
  studentContext?: {
    targetExam?: string;
    studentClass?: string;
    recentWeakTopics?: string[];
    studyStreakDays?: number;
  };
}

interface LiveMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  time: string;
  modelUsed?: string;
  provider?: string;
}

// ─── PHONETIC TEACHER NORMALIZER (CLEANS MATH FOR SEAMLESS NATURAL SPEECH) ───
function cleanTextForNaturalSpeech(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // 1. Remove Markdown syntax, asterisks, brackets & headers
  text = text.replace(/\*\*(.*?)\*\*/g, "$1");
  text = text.replace(/\*(.*?)\*/g, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/#+\s*/g, "");
  text = text.replace(/[-*•]\s+/g, "");
  text = text.replace(/\\\[|\\\]|\\\(|\\\)/g, "");

  // 2. Phonetic Math Conversions into Natural Spoken Words
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 divided by $2");
  text = text.replace(/\\sqrt\{([^}]+)\}/g, "under-root $1");
  text = text.replace(/(\w+)\^2\b/g, "$1 square");
  text = text.replace(/(\w+)\^3\b/g, "$1 cube");
  text = text.replace(/x²/g, "x square");
  text = text.replace(/y²/g, "y square");
  text = text.replace(/r²/g, "r square");
  text = text.replace(/v²/g, "v square");
  text = text.replace(/u²/g, "u square");
  text = text.replace(/√/g, "under-root ");

  text = text.replace(/M_o/gi, "M objective");
  text = text.replace(/M_e/gi, "M eyepiece");
  text = text.replace(/v_o/gi, "v objective");
  text = text.replace(/u_o/gi, "u objective");
  text = text.replace(/f_o/gi, "f objective");
  text = text.replace(/f_e/gi, "f eyepiece");

  text = text.replace(/m\/s²/g, "meter per second square");
  text = text.replace(/m\/s/g, "meter per second");
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
  text = text.replace(/×/g, " into ");
  text = text.replace(/÷/g, " divided by ");

  // Clean extra whitespace
  return text.replace(/\s+/g, " ").trim();
}

// ─── SYNTHESIZED SOUND EFFECTS ───
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
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === "send") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else {
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
  
  // Floating HUD Modes: "compact" | "expanded"
  const [hudMode, setHudMode] = useState<"compact" | "expanded">("compact");
  
  // Mic & Speech State
  const [isHoldingMic, setIsHoldingMic] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [typedInput, setTypedInput] = useState("");
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [flashTrigger, setFlashTrigger] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
  const holdStartTimeRef = useRef<number>(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Sentence-by-Sentence Queue Refs to guarantee full speech without stopping
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingQueueRef = useRef<boolean>(false);

  // 1. Preload Browser SpeechSynthesis Voices
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const load = () => {
        window.speechSynthesis.getVoices();
      };
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  }, []);

  // 2. Call Duration Timer
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

  // 3. Camera Stream (audio: false ensures hardware mic is 100% free for SpeechRecognition)
  const startCamera = useCallback(async (mode: "environment" | "user") => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const media = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: mode, 
          width: { ideal: 1280, min: 1024 }, 
          height: { ideal: 960, min: 720 } 
        },
        audio: false,
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
    stopSpeaking();
    setIsHoldingMic(false);
    setCallDuration(0);
    setTranscript("");
    transcriptRef.current = "";
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

  // 4. Flip Camera Switch
  const toggleCameraSwitch = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // 5. Cancel Speech & Queue (Barge-in)
  const stopSpeaking = () => {
    speechQueueRef.current = [];
    isSpeakingQueueRef.current = false;
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch (_) {}
      currentAudioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsAiSpeaking(false);
  };

  // 6. Sentence-by-Sentence Queue Player (Prevents Cutoff & Plays Full Solution)
  const speakNextSentence = () => {
    if (speechQueueRef.current.length === 0) {
      isSpeakingQueueRef.current = false;
      setIsAiSpeaking(false);
      return;
    }

    isSpeakingQueueRef.current = true;
    setIsAiSpeaking(true);
    const sentence = speechQueueRef.current.shift()!;

    // Layer 1: Online Neural Google Stream
    const ttsUrl = `/api/ai-doubt/live/tts?text=${encodeURIComponent(sentence)}`;
    const audio = new Audio(ttsUrl);
    currentAudioRef.current = audio;

    audio.onended = () => {
      currentAudioRef.current = null;
      setTimeout(speakNextSentence, 120); // 120ms gentle teacher pause
    };

    audio.onerror = () => {
      currentAudioRef.current = null;
      speakBrowserSentence(sentence, () => {
        setTimeout(speakNextSentence, 120);
      });
    };

    audio.play().catch(() => {
      currentAudioRef.current = null;
      speakBrowserSentence(sentence, () => {
        setTimeout(speakNextSentence, 120);
      });
    });
  };

  const speakBrowserSentence = (text: string, onDone: () => void) => {
    if (typeof window === "undefined" || !window.speechSynthesis || isMuted) {
      onDone();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Calm, respectful teacher pacing
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    // Case-insensitive voice matcher (handles Android hi-in, en-in, Google, Natural)
    const preferredVoice =
      voices.find((v) => {
        const name = (v.name || "").toLowerCase();
        const lang = (v.lang || "").toLowerCase();
        return (name.includes("google") || name.includes("natural")) && (lang.startsWith("hi") || lang.startsWith("en-in"));
      }) ||
      voices.find((v) => {
        const name = (v.name || "").toLowerCase();
        return name.includes("swara") || name.includes("madhur") || name.includes("neerja") || name.includes("prabhat");
      }) ||
      voices.find((v) => {
        const lang = (v.lang || "").toLowerCase();
        return lang.startsWith("hi") || lang.startsWith("en-in");
      });

    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    } else {
      utterance.lang = "en-IN";
    }

    utterance.onend = () => onDone();
    utterance.onerror = () => onDone();

    window.speechSynthesis.speak(utterance);
  };

  const speakResponse = (rawText: string) => {
    if (!rawText || isMuted) return;
    stopSpeaking();

    const cleaned = cleanTextForNaturalSpeech(rawText);
    if (!cleaned) return;

    // Split entire solution into individual sentences (never cuts off the full answer!)
    const sentences = cleaned
      .split(/(?<=[.!?\n])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);

    if (sentences.length === 0) return;

    speechQueueRef.current = sentences;
    playUiTone("ai");
    speakNextSentence();
  };

  // 7. Send High-Definition Frame & Real Spoken Query
  const sendLiveDoubt = async (spokenTextParam?: string) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setHudMode("compact");

    // Camera flash effect on capture
    setFlashTrigger(true);
    setTimeout(() => setFlashTrigger(false), 120);

    let frameBase64 = "";
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      // High-Definition capture (1280x960 @ 0.85) for razor-sharp reading of handwritten formulas & ray diagrams
      const w = Math.min(video.videoWidth || 1280, 1280);
      const h = Math.min(video.videoHeight || 960, 960);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        frameBase64 = canvas.toDataURL("image/jpeg", 0.85);
      }
    }

    // Exact user query (No hardcoded strings)
    const queryText = (spokenTextParam ?? transcriptRef.current ?? typedInput ?? "").trim();
    const promptToSend = queryText || "Camera par jo handwritten notes aur ray diagram hai use step-by-step detail mein explain kijiye.";

    const displayBubbleText = queryText ? `🎙️ "${queryText}"` : "📸 [Question Photo Scan]";

    const userMsg: LiveMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: displayBubbleText,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTranscript("");
    setTypedInput("");
    transcriptRef.current = "";

    try {
      const res = await fetch("/api/ai-doubt/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frame: frameBase64,
          message: promptToSend,
          studentContext,
        }),
      });

      const data = await res.json();
      const reply = data?.reply || "Sawal clear nahi dikh raha. Kripya camera notes par focus karein.";

      const aiMsg: LiveMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: reply,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        modelUsed: data?.model,
        provider: data?.provider,
      };

      setMessages((prev) => [...prev, aiMsg]);
      speakResponse(reply);
    } catch (err: any) {
      const errorMsg: LiveMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: "Network issue aagaya. Kripya dubara puchiye.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 8. Press & Hold Mic (en-IN captures "Explain this" in clean English)
  const handleHoldStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (isAnalyzing) return;

    holdStartTimeRef.current = Date.now();
    setIsHoldingMic(true);
    setTranscript("");
    transcriptRef.current = "";

    // Barge-in: immediately cancel AI speaking
    stopSpeaking();

    // Haptic feedback
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(40);
    }
    playUiTone("press");

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch (_) {}
        }
        const recognition = new SpeechRecognition();
        recognition.lang = "en-IN"; // English script captures "Explain this", "Solve this derivation" cleanly
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let full = "";
          for (let i = 0; i < event.results.length; i++) {
            full += event.results[i][0].transcript;
          }
          const cleaned = full.trim();
          if (cleaned) {
            transcriptRef.current = cleaned;
            setTranscript(cleaned);
          }
        };

        recognition.onerror = (err: any) => {
          console.warn("Speech recognition warning:", err?.error);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (e) {
        console.warn("SpeechRecognition start error:", e);
      }
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

    const holdDuration = Date.now() - holdStartTimeRef.current;

    // Immediately clear transcript display from top pill so analyzing pill takes over!
    setTranscript("");

    setTimeout(() => {
      const finalSpoken = transcriptRef.current.trim();
      if (holdDuration < 300 && !finalSpoken) {
        return;
      }
      sendLiveDoubt(finalSpoken);
    }, 150);
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

      {/* Screen White Flash Effect */}
      {flashTrigger && (
        <div className="absolute inset-0 bg-white/40 z-30 pointer-events-none transition-opacity duration-150 animate-pulse" />
      )}

      {/* Dark Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-transparent to-black/95 pointer-events-none" />

      {/* TOP HEADER: Status, Timer, AI Speaking & Camera Switch */}
      <div className="relative z-20 flex items-center justify-between p-4 pt-6">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-md">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-black text-white tracking-wide">LIVE AI FACULTY</span>
          <span className="text-[11px] font-mono font-bold text-slate-300">· {formatTime(callDuration)}</span>
        </div>

        {/* Live Speaking Indicator */}
        {isAiSpeaking && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-md animate-pulse">
            <span>🔊</span>
            <span className="text-[10px] tracking-wide">Faculty Speaking...</span>
          </div>
        )}

        {/* Camera Switch */}
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

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CENTER STATUS PILL: ANALYZING SCANNER vs LIVE MIC TRANSCRIPT */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isAnalyzing ? (
        /* 1. WHILE SOLVING: PROMINENT ANALYZING SCANNER PILL (FIX FOR POINT 1) */
        <div className="relative z-30 mx-auto max-w-xs px-4 py-2 rounded-full bg-slate-900/90 backdrop-blur-md border border-teal-400/60 text-center shadow-2xl flex items-center justify-center gap-2.5 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
          <p className="text-xs font-black text-teal-200 tracking-wide">
            ⚡ Analyzing notes & solving...
          </p>
        </div>
      ) : isHoldingMic && transcript ? (
        /* 2. WHILE HOLDING MIC: REAL-TIME CLEAN ENGLISH PREVIEW */
        <div className="relative z-30 mx-auto max-w-xs px-4 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-emerald-500/40 text-center shadow-lg">
          <p className="text-[11.5px] font-semibold text-emerald-300 truncate">
            🎙️ "{transcript}"
          </p>
        </div>
      ) : null}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* BOTTOM-ALIGNED FLOATING HUD (COMPACT & FULL EXPANDED SOLUTION) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative z-20 max-w-sm mx-auto w-full px-4 mb-2 mt-auto">
        {hudMode === "expanded" ? (
          /* EXPANDED FULL SOLUTION DRAWER */
          <div className="bg-slate-900/95 backdrop-blur-xl border border-teal-500/40 rounded-3xl p-4 shadow-2xl space-y-2.5 transition-all max-h-[60vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-400" />
                <h5 className="text-xs font-black text-teal-300 uppercase tracking-wider">
                  Live Solution & Derivation Notes
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

            {/* Scrollable Message History with Full Paragraphs */}
            <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
              {messages.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs font-bold text-white">Book ya handwritten notes camera ke samne rakhein</p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Niche <span className="text-emerald-400 font-bold">Mic daba kar</span> sawal puchein.
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      m.sender === "user"
                        ? "bg-teal-950/70 border border-teal-500/30 text-teal-100 ml-4 text-right"
                        : "bg-slate-800/95 border border-slate-700/60 text-slate-100"
                    }`}
                  >
                    <div className="text-[9px] font-mono text-slate-400 mb-1">
                      {m.sender === "user" ? "You" : m.provider || "AI Faculty"} · {m.time}
                    </div>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>
                ))
              )}

              {isAnalyzing && (
                <div className="flex items-center gap-2 bg-teal-950/60 border border-teal-500/30 rounded-xl px-3 py-1.5 w-fit">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                  <span className="text-[11px] font-bold text-teal-200">Reading formulas & solving derivation...</span>
                </div>
              )}
            </div>

            {/* Optional Type/Edit Input */}
            <div className="pt-2 border-t border-white/10 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && typedInput.trim()) {
                    sendLiveDoubt(typedInput.trim());
                  }
                }}
                placeholder="Ya type karke puchein..."
                className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-teal-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (typedInput.trim()) sendLiveDoubt(typedInput.trim());
                }}
                disabled={!typedInput.trim() || isAnalyzing}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs"
              >
                Send
              </button>
            </div>
          </div>
        ) : hudMode === "compact" && latestAiMessage ? (
          /* COMPACT BOTTOM PREVIEW */
          <div
            onClick={() => setHudMode("expanded")}
            className="w-full bg-slate-900/90 backdrop-blur-md border border-teal-500/30 rounded-2xl p-3 text-left shadow-xl active:scale-98 transition cursor-pointer flex items-center justify-between group"
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
              <span>View Full</span>
              <span>💬</span>
            </div>
          </div>
        ) : isAnalyzing ? (
          /* Scanning Pill */
          <div className="mx-auto w-fit flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-teal-500/30 rounded-full px-4 py-2 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span className="text-xs font-bold text-teal-200">Scanning handwritten formulas & diagram...</span>
          </div>
        ) : null}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* BOTTOM CONTROLS DOCK & PUSH-TO-TALK (HOLD MIC) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative z-20 p-4 pb-8 flex flex-col items-center gap-2.5 bg-gradient-to-t from-black via-black/90 to-transparent">
        {/* Dynamic Context Helper Badge */}
        <div className="px-3.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-center shadow-md">
          <p className="text-[10px] font-semibold text-slate-300">
            {isHoldingMic ? (
              <span className="text-emerald-400 font-bold animate-pulse">
                🔴 Listening... Sawal boliye (Release karte hi solve hoga)
              </span>
            ) : isAnalyzing ? (
              <span className="text-teal-300 font-bold">
                ⚡ Faculty analyzing question...
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
            onClick={() => {
              if (!isMuted) stopSpeaking();
              setIsMuted(!isMuted);
            }}
            className={`p-3.5 rounded-full transition-all active:scale-95 shadow-xl ${
              isMuted
                ? "bg-rose-600 text-white border border-rose-400"
                : "bg-slate-800/90 text-slate-300 border border-slate-700 hover:bg-slate-700"
            }`}
            title={isMuted ? "Unmute Voice" : "Mute Voice"}
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
