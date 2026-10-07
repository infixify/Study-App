"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface LiveVideoCallModalProps {
  open?: boolean;
  isOpen?: boolean;
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

// ─── PHONETIC TEACHER NORMALIZER (CLEANS MATH FOR NATURAL ACCENT & FLUIDITY) ───
function cleanTextForNaturalSpeech(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // 1. Remove markdown symbols, asterisks, hashes, backticks
  text = text.replace(/[*#`_~]/g, " ");
  text = text.replace(/\$\$|\$/g, " ");
  text = text.replace(/Step \d+:\s*/gi, "");
  text = text.replace(/\\\[|\\\]|\\\(|\\\)/g, "");

  // 2. Expand LaTeX math into natural spoken Hindi/English teacher phrases
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 divided by $2");
  text = text.replace(/\\sqrt\{([^}]+)\}/g, "square root of $1");
  text = text.replace(/\^2/g, " squared");
  text = text.replace(/\^3/g, " cubed");
  text = text.replace(/\^([a-zA-Z0-9]+)/g, " power $1");
  text = text.replace(/\\times/g, " multiplied by ");
  text = text.replace(/\\div/g, " divided by ");
  text = text.replace(/\\pm/g, " plus minus ");
  text = text.replace(/\\approx/g, " approximately ");
  text = text.replace(/\\neq/g, " not equal to ");
  text = text.replace(/\\leq/g, " less than or equal to ");
  text = text.replace(/\\geq/g, " greater than or equal to ");
  text = text.replace(/\\theta/g, " theta ");
  text = text.replace(/\\alpha/g, " alpha ");
  text = text.replace(/\\beta/g, " beta ");
  text = text.replace(/\\pi/g, " pi ");
  text = text.replace(/\\infty/g, " infinity ");
  text = text.replace(/\\rightarrow/g, " gives ");

  // 3. Remove leftover brackets, hyphens, and multi-spaces
  text = text.replace(/[\[\]{}()]/g, " ");
  text = text.replace(/[-–—]/g, " ");
  text = text.replace(/\s+/g, " ");

  return text.trim();
}

// ─── CLEAN FORMATTER FOR WRITTEN STEP-BY-STEP SOLUTION ───
function formatSolutionText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/[*#`_~]/g, "")
    .replace(/\$\$|\$/g, "")
    .replace(/\\\[|\\\]|\\\(|\\\)/g, "")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)")
    .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
    .replace(/\\times/g, " × ")
    .replace(/\\div/g, " ÷ ")
    .replace(/\\rightarrow/g, " → ")
    .trim();
}

export function LiveVideoCallModal({
  open,
  isOpen,
  onClose,
  studentContext,
}: LiveVideoCallModalProps) {
  const isModalOpen = Boolean(open ?? isOpen);

  // Video & Stream State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashTrigger, setFlashTrigger] = useState(false);

  // Mic & Speech State
  const [isHoldingMic, setIsHoldingMic] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [typedInput, setTypedInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("male");

  // Call & HUD State
  const [callDuration, setCallDuration] = useState(0);
  const [hudMode, setHudMode] = useState<"compact" | "expanded">("compact");
  const [messages, setMessages] = useState<LiveMessage[]>([]);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingQueueRef = useRef<boolean>(false);
  const ttsHeartbeatRef = useRef<any>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // 1. Play Soft Auditory Feedback Beep
  const playUiTone = (type: "start" | "stop" | "ai") => {
    try {
      if (typeof window === "undefined") return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === "start") {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "stop") {
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "ai") {
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      }
    } catch (_) {}
  };

  // 2. Call Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isModalOpen) {
      timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isModalOpen]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // 3. Camera Start & Stream Management
  const startCamera = async (mode: "environment" | "user") => {
    try {
      setCameraError(null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn("Camera start failed, falling back to basic video:", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (err2: any) {
        setCameraError("Camera permission denied. Please enable camera access.");
      }
    }
  };

  const stopAll = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
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
    if (isModalOpen) {
      startCamera(facingMode);
    } else {
      stopAll();
    }
    return () => {
      stopAll();
    };
  }, [isModalOpen, facingMode]);

  // 4. Flip Camera Switch
  const toggleCameraSwitch = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // 5. Cancel Speech (Barge-in on tap/mic hold)
  const stopSpeaking = () => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch (_) {}
      activeAudioRef.current = null;
    }
    speechQueueRef.current = [];
    isSpeakingQueueRef.current = false;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (ttsHeartbeatRef.current) clearInterval(ttsHeartbeatRef.current);
    setIsAiSpeaking(false);
  };

  // 6. High-Speed Indian Faculty Speech Engine (Rate 1.15x, Zero Gaps, Crisp Accent)
  const speakNextSentence = () => {
    if (speechQueueRef.current.length === 0) {
      isSpeakingQueueRef.current = false;
      setIsAiSpeaking(false);
      if (ttsHeartbeatRef.current) clearInterval(ttsHeartbeatRef.current);
      return;
    }

    if (typeof window === "undefined" || !window.speechSynthesis || isMuted) {
      isSpeakingQueueRef.current = false;
      setIsAiSpeaking(false);
      return;
    }

    isSpeakingQueueRef.current = true;
    setIsAiSpeaking(true);
    const sentence = speechQueueRef.current.shift()!;

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = 1.15;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((v) => {
        const n = (v.name || "").toLowerCase();
        const l = (v.lang || "").toLowerCase();
        return (
          (n.includes("prabhat") || n.includes("madhur") || n.includes("male") || n.includes("google")) &&
          (l.startsWith("en-in") || l.startsWith("hi"))
        );
      }) ||
      voices.find((v) => (v.lang || "").toLowerCase().startsWith("en-in")) ||
      voices.find((v) => (v.lang || "").toLowerCase().startsWith("hi"));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    } else {
      utterance.lang = "en-IN";
    }

    utterance.onend = () => {
      speakNextSentence();
    };

    utterance.onerror = () => {
      speakNextSentence();
    };

    if (!ttsHeartbeatRef.current) {
      ttsHeartbeatRef.current = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          clearInterval(ttsHeartbeatRef.current);
          ttsHeartbeatRef.current = null;
        }
      }, 7000);
    }

    window.speechSynthesis.speak(utterance);
  };

  const fallbackClientSpeech = (cleaned: string) => {
    const sentences = cleaned
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);

    if (sentences.length === 0) {
      setIsAiSpeaking(false);
      return;
    }

    speechQueueRef.current = sentences;
    speakNextSentence();
  };

  const speakResponse = async (rawText: string) => {
    if (!rawText || isMuted) return;
    stopSpeaking();

    const cleaned = cleanTextForNaturalSpeech(rawText);
    if (!cleaned) return;

    playUiTone("ai");
    setIsAiSpeaking(true);

    // 3-Tier Cascade: Remote Google/Sarvam bulbul:v3 audio stream -> Local fallback
    try {
      const audioUrl = `/api/ai-doubt/live/tts?text=${encodeURIComponent(cleaned.slice(0, 320))}`;
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;

      audio.onended = () => {
        setIsAiSpeaking(false);
        activeAudioRef.current = null;
      };

      audio.onerror = () => {
        fallbackClientSpeech(cleaned);
      };

      await audio.play();
    } catch (_) {
      fallbackClientSpeech(cleaned);
    }
  };

  // 7. Send High-Definition Frame & Real Spoken Query
  const sendLiveDoubt = async (spokenTextParam?: string) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setHudMode("compact");

    setFlashTrigger(true);
    setTimeout(() => setFlashTrigger(false), 120);

    let frameBase64 = "";
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
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

  // 8. Press & Hold Mic
  const handleHoldStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (isAnalyzing) return;

    stopSpeaking();
    playUiTone("start");

    setIsHoldingMic(true);
    setTranscript("");
    transcriptRef.current = "";

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-IN";

        rec.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript + " ";
          }
          const cleanText = currentTranscript.trim();
          setTranscript(cleanText);
          transcriptRef.current = cleanText;
        };

        rec.onerror = (err: any) => {
          console.warn("Speech recognition error:", err);
        };

        rec.onend = () => {
          if (isHoldingMic && recognitionRef.current) {
            try { recognitionRef.current.start(); } catch (_) {}
          }
        };

        recognitionRef.current = rec;
        rec.start();
      } catch (err) {
        console.warn("Speech init failed:", err);
      }
    }
  };

  const handleHoldEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isHoldingMic) return;

    playUiTone("stop");
    setIsHoldingMic(false);

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    }

    setTimeout(() => {
      const finalSpoken = transcriptRef.current.trim();
      sendLiveDoubt(finalSpoken);
    }, 150);
  };

  if (!isModalOpen) return null;

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

      {/* TOP HEADER: Status, Timer, Faculty Badge & Camera Switch */}
      <div className="relative z-20 flex items-center justify-between p-4 pt-6">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-md">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-black text-white tracking-wide">LIVE AI FACULTY</span>
          <span className="text-[11px] font-mono font-bold text-slate-300">· {formatTime(callDuration)}</span>
        </div>

        {/* Center: Indian Faculty Badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-xs font-bold text-white shadow-md"
        >
          <span>👨‍🏫</span>
          <span className="text-[10.5px] font-semibold tracking-wide text-emerald-300">
            Indian Faculty
          </span>
        </div>

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

      {/* CENTER STATUS PILL: ANALYZING SCANNER vs LIVE MIC PREVIEW */}
      {isAnalyzing ? (
        <div className="relative z-30 mx-auto max-w-xs px-4 py-2 rounded-full bg-slate-900/90 backdrop-blur-md border border-teal-400/60 text-center shadow-2xl flex items-center justify-center gap-2.5 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
          <p className="text-xs font-black text-teal-200 tracking-wide">
            ⚡ Analyzing notes & solving...
          </p>
        </div>
      ) : isHoldingMic && transcript ? (
        <div className="relative z-30 mx-auto max-w-xs px-4 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-emerald-500/40 text-center shadow-lg">
          <p className="text-[11.5px] font-semibold text-emerald-300 truncate">
            🎙️ "{transcript}"
          </p>
        </div>
      ) : isAiSpeaking ? (
        <div className="relative z-30 mx-auto max-w-xs px-3.5 py-1.5 rounded-full bg-emerald-950/85 backdrop-blur-md border border-emerald-500/40 text-center shadow-lg flex items-center justify-center gap-2 animate-pulse">
          <span className="text-xs">🔊</span>
          <p className="text-[11px] font-bold text-emerald-300">
            Faculty Explaining... (Tap to pause)
          </p>
        </div>
      ) : null}

      {/* BOTTOM-ALIGNED FLOATING HUD */}
      <div className="relative z-20 max-w-sm mx-auto w-full px-4 mb-2 mt-auto">
        {hudMode === "expanded" ? (
          <div className="bg-slate-900/95 backdrop-blur-xl border border-teal-500/40 rounded-3xl p-4 shadow-2xl space-y-2.5 transition-all max-h-[60vh] flex flex-col">
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
                    <div>{formatSolutionText(m.text)}</div>
                  </div>
                ))
              )}

              {isAnalyzing && (
                <div className="p-3 rounded-2xl bg-teal-950/40 border border-teal-500/30 flex items-center gap-2.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                  <span className="text-[11px] font-bold text-teal-200">Reading formulas & solving derivation...</span>
                </div>
              )}
            </div>

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
              <p className="text-xs text-white truncate font-medium">
                {latestAiMessage.text.replace(/[*#`_~$]/g, "").slice(0, 80)}...
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-teal-300 bg-teal-500/20 border border-teal-500/30 px-2.5 py-1.5 rounded-xl shrink-0 font-bold group-hover:bg-teal-500/30">
              <span>View Full</span>
              <span>💬</span>
            </div>
          </div>
        ) : isAnalyzing ? (
          <div className="mx-auto w-fit flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-teal-500/30 rounded-full px-4 py-2 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span className="text-xs font-bold text-teal-200">Scanning handwritten formulas & diagram...</span>
          </div>
        ) : null}
      </div>

      {/* BOTTOM CONTROLS DOCK & PUSH-TO-TALK (HOLD MIC) */}
      <div className="relative z-20 p-4 pb-8 flex flex-col items-center gap-2.5 bg-gradient-to-t from-black via-black/90 to-transparent">
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

        <div className="flex items-center justify-center gap-4 w-full max-w-xs">
          {/* Mute/Unmute */}
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

          {/* PUSH-TO-TALK */}
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

          {/* Toggle Full Chat Drawer */}
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

          {/* End Call */}
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
