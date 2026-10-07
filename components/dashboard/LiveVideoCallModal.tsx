// components/dashboard/LiveVideoCallModal.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";

interface LiveVideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentContext?: {
    name?: string;
    targetExam?: string;
    classLevel?: string;
    weakChapters?: string[];
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

  // 2. Phonetic Scientific Replacements (Short & Crisp for natural speed)
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 by $2");
  text = text.replace(/\\sqrt\{([^}]+)\}/g, "under root $1");
  text = text.replace(/(\w+)\^2\b/g, "$1 square");
  text = text.replace(/(\w+)\^3\b/g, "$1 cube");
  text = text.replace(/x²/g, "x square");
  text = text.replace(/y²/g, "y square");
  text = text.replace(/r²/g, "r square");
  text = text.replace(/v²/g, "v square");
  text = text.replace(/u²/g, "u square");
  text = text.replace(/√/g, "under root ");

  // Common optics & physics subscripts in natural spoken words
  text = text.replace(/M_o/gi, "M objective");
  text = text.replace(/M_e/gi, "M eyepiece");
  text = text.replace(/v_o\/u_o/gi, "v objective by u objective");
  text = text.replace(/v_o/gi, "v objective");
  text = text.replace(/u_o/gi, "u objective");
  text = text.replace(/f_o/gi, "f objective");
  text = text.replace(/f_e/gi, "f eyepiece");
  text = text.replace(/L\/f_o/gi, "L by f objective");
  text = text.replace(/D\/f_e/gi, "D by f eyepiece");
  text = text.replace(/1\s*\+\s*D\/f_e/gi, "1 plus D by f eyepiece");

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
  text = text.replace(/≈/g, "approximately");
  text = text.replace(/±/g, "plus minus");
  text = text.replace(/°C/g, "degree celsius");
  text = text.replace(/×/g, " into ");
  text = text.replace(/÷/g, " by ");

  // 3. Remove all multiple gaps & line breaks so voice never pauses awkwardly
  text = text.replace(/[\r\n]+/g, ". ");
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

// ─── CLEAN UI FORMATTER (TURNS RAW TEXT INTO CLEAN STUDY CARDS WITHOUT UGLY SYMBOLS) ───
function formatSolutionText(raw: string) {
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  return lines.map((line, idx) => {
    let clean = line
      .replace(/\$\$|\$/g, "")
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 / $2")
      .replace(/\\left|\\right/g, "")
      .trim();

    const isHeading = clean.startsWith("#") || (clean.startsWith("**") && clean.endsWith("**"));
    clean = clean.replace(/[*#]/g, "").trim();

    const isBullet = line.trim().startsWith("*") || line.trim().startsWith("-");

    if (isHeading) {
      return (
        <h6 key={idx} className="font-bold text-teal-300 text-xs mt-1 mb-0.5">
          {clean}
        </h6>
      );
    }

    if (isBullet) {
      return (
        <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-200 my-0.5">
          <span className="text-teal-400 font-bold">•</span>
          <span>{clean}</span>
        </div>
      );
    }

    return (
      <p key={idx} className="text-xs text-slate-200 my-1 leading-relaxed">
        {clean}
      </p>
    );
  });
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

    if (type === "press") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === "send") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === "ai") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch (_) {}
}

export function LiveVideoCallModal({
  isOpen,
  onClose,
  studentContext,
}: LiveVideoCallModalProps) {
  // Video & Stream State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [callDuration, setCallDuration] = useState<number>(0);

  // Audio & Speech State
  const [isMuted, setIsMuted] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isHoldingMic, setIsHoldingMic] = useState(false);
  const [transcript, setTranscript] = useState<string>("");

  // Messaging & UI Drawer State
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [hudMode, setHudMode] = useState<"compact" | "expanded">("compact");

  // High-Speed Speech & Audio Refs
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingQueueRef = useRef<boolean>(false);
  const ttsHeartbeatRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // 1. Preload Browser SpeechSynthesis Voices (Tier 3 fallback setup)
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const load = () => {
        window.speechSynthesis.getVoices();
      };
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  }, []);

  // 2. Call Timer
  useEffect(() => {
    let interval: any;
    if (isOpen) {
      setCallDuration(0);
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen]);

  // 3. Camera Stream (audio: false guarantees mic is 100% free for user speech recognition)
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let isMounted = true;
    const startCamera = async () => {
      try {
        setCameraError(null);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false, // Critical: Camera must not lock Android phone microphone
        });

        if (isMounted) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setCameraError(
            err.name === "NotAllowedError"
              ? "Camera permission denied. Kripya browser settings mein allow karein."
              : "Camera start nahi ho paya. Refresh karke try karein."
          );
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      stopCamera();
      stopSpeaking();
    };
  }, [isOpen, facingMode]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleCameraSwitch = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // 4. Capture Frame (High Quality JPEG)
  const captureFrame = (): string | null => {
    if (!videoRef.current) return null;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 960;
    canvas.height = videoRef.current.videoHeight || 540;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  };

  // 5. Cancel Speech (Barge-in on tap/mic hold)
  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch (_) {}
      currentAudioRef.current = null;
    }
    speechQueueRef.current = [];
    isSpeakingQueueRef.current = false;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (ttsHeartbeatRef.current) clearInterval(ttsHeartbeatRef.current);
    setIsAiSpeaking(false);
  };

  // ─── TIER 3 LOCAL FALLBACK: High-Speed Indian Male Faculty Voice ───
  const speakNextSentenceLocal = () => {
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
    utterance.pitch = 0.98;

    const voices = window.speechSynthesis.getVoices();
    // Default: Top Indian male faculty voice
    const preferredVoice =
      voices.find((v) => {
        const n = (v.name || "").toLowerCase();
        const l = (v.lang || "").toLowerCase();
        return (
          (n.includes("prabhat") || n.includes("madhur") || n.includes("male") || n.includes("google")) &&
          (l.startsWith("en-in") || l.startsWith("hi"))
        );
      }) || voices.find((v) => (v.lang || "").toLowerCase().startsWith("en-in"));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    } else {
      utterance.lang = "en-IN";
    }

    utterance.onend = () => {
      speakNextSentenceLocal();
    };

    utterance.onerror = () => {
      speakNextSentenceLocal();
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

  const fallbackToLocalSpeech = (cleanedText: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis || isMuted) {
      setIsAiSpeaking(false);
      return;
    }

    const sentences = cleanedText
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);

    if (sentences.length === 0) {
      setIsAiSpeaking(false);
      return;
    }

    speechQueueRef.current = sentences;
    playUiTone("ai");
    speakNextSentenceLocal();
  };

  // ─── 3-TIER CASCADE AUDIO ENGINE (Google ➔ Sarvam ➔ Local Male) ───
  const speakResponse = async (rawText: string) => {
    if (!rawText || isMuted) return;
    stopSpeaking();

    const cleaned = cleanTextForNaturalSpeech(rawText);
    if (!cleaned) return;

    setIsAiSpeaking(true);

    // Take first 250 characters for immediate spoken intro/explanation
    const speechChunk = cleaned.slice(0, 250);

    try {
      const ttsUrl = `/api/ai-doubt/live/tts?text=${encodeURIComponent(speechChunk)}`;
      const audio = new Audio(ttsUrl);
      currentAudioRef.current = audio;

      audio.onended = () => {
        setIsAiSpeaking(false);
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        console.warn("Cloud TTS failed or timed out. Falling back to Tier 3 Local Engine.");
        currentAudioRef.current = null;
        fallbackToLocalSpeech(cleaned);
      };

      await audio.play();
    } catch (err) {
      console.warn("Audio playback interrupted or blocked. Engaging Local Engine.");
      currentAudioRef.current = null;
      fallbackToLocalSpeech(cleaned);
    }
  };

  // 6. Send High-Definition Frame & Real Spoken Query
  const sendLiveDoubt = async (spokenTextParam?: string) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setHudMode("compact");

    try {
      playUiTone("send");
      const frameData = captureFrame();

      const userText = (spokenTextParam || transcript).trim();
      const promptToSend =
        userText && userText.length > 1
          ? userText
          : "Camera par jo handwritten notes ya numerical problem hai use step-by-step explain kijiye.";

      const userMsg: LiveMessage = {
        id: Date.now().toString(),
        sender: "user",
        text: promptToSend,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, userMsg]);
      setTranscript("");

      const res = await fetch("/api/ai-doubt/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frame: frameData,
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

  // 7. Press & Hold Mic (Turn-Loop Android Web Speech Capture)
  const handleHoldStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (isAnalyzing) return;

    playUiTone("press");
    stopSpeaking();
    setIsHoldingMic(true);
    setTranscript("");

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch (_) {}
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false; // Turn-based for Android Chrome stability
        recognition.interimResults = true;
        recognition.lang = "en-IN";

        recognition.onresult = (event: any) => {
          let currentSpoken = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentSpoken += event.results[i][0].transcript;
          }
          if (currentSpoken.trim()) {
            setTranscript(currentSpoken.trim());
          }
        };

        recognition.onerror = (err: any) => {
          console.warn("Speech recognition warning:", err?.error);
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.warn("SpeechRecognition start error:", e);
      }
    }
  };

  const handleHoldEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isHoldingMic) return;
    setIsHoldingMic(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }

    // Trigger analysis with whatever was transcribed
    setTimeout(() => {
      sendLiveDoubt(transcript);
    }, 150);
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, hudMode]);

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const latestAiMessage = messages.filter((m) => m.sender === "ai").slice(-1)[0];

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* FULLSCREEN REAL-TIME CAMERA FEED */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${
            facingMode === "user" ? "-scale-x-100" : ""
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/90 pointer-events-none" />

        {/* Optical Scanning Guidelines (Ray & Numerical Crosshair) */}
        <div className="absolute inset-x-8 inset-y-24 border border-teal-400/25 rounded-3xl pointer-events-none flex flex-col justify-between p-4">
          <div className="flex justify-between">
            <span className="w-4 h-4 border-t-2 border-l-2 border-teal-400 rounded-tl-sm" />
            <span className="w-4 h-4 border-t-2 border-r-2 border-teal-400 rounded-tr-sm" />
          </div>
          <div className="flex justify-between">
            <span className="w-4 h-4 border-b-2 border-l-2 border-teal-400 rounded-bl-sm" />
            <span className="w-4 h-4 border-b-2 border-r-2 border-teal-400 rounded-br-sm" />
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TOP HEADER: Status, Timer, Faculty Voice Badge & Camera Switch */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative z-30 flex items-center justify-between p-4">
        {/* Left: Live Status Pill */}
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-md">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-black text-white tracking-wide">LIVE AI FACULTY</span>
          <span className="text-[11px] font-mono font-bold text-slate-300">· {formatTime(callDuration)}</span>
        </div>

        {/* Center: Indian Male Faculty Voice Badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-teal-400/30 text-xs font-bold text-teal-200 shadow-md"
          title="Active Indian Faculty Voice Engine"
        >
          <span>👨‍🏫</span>
          <span className="text-[10.5px] font-semibold">Indian Faculty</span>
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

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CENTER STATUS PILL: ANALYZING SCANNER vs LIVE MIC PREVIEW */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isAnalyzing ? (
        /* While Solving: Prominent Scanner Pill */
        <div className="relative z-30 mx-auto max-w-xs px-4 py-2 rounded-full bg-slate-900/90 backdrop-blur-md border border-teal-400/60 text-center shadow-2xl flex items-center justify-center gap-2.5 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
          <p className="text-xs font-black text-teal-200 tracking-wide">
            ⚡ Analyzing notes & solving...
          </p>
        </div>
      ) : isHoldingMic && transcript ? (
        /* While Holding Mic: Live Real Speech Words Preview */
        <div className="relative z-30 mx-auto max-w-xs px-4 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-emerald-500/40 text-center shadow-lg">
          <p className="text-[11.5px] font-semibold text-emerald-300 truncate">
            🎙️ "{transcript}"
          </p>
        </div>
      ) : isAiSpeaking ? (
        /* While Speaking: Animated Voice Pill (Tap to Pause/Barge-in) */
        <button
          type="button"
          onClick={stopSpeaking}
          className="relative z-30 mx-auto max-w-xs px-3.5 py-1.5 rounded-full bg-emerald-950/85 backdrop-blur-md border border-emerald-500/40 text-center shadow-lg flex items-center justify-center gap-2 animate-pulse active:scale-95 transition"
        >
          <span className="text-xs">🔊</span>
          <p className="text-[11px] font-bold text-emerald-300">
            Faculty Explaining... (Tap to pause)
          </p>
        </button>
      ) : null}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* BOTTOM-ALIGNED FLOATING HUD (COMPACT & EXPANDED STUDY CARDS) */}
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
                className="text-slate-400 hover:text-white p-1 text-xs"
              >
                ✕ Close
              </button>
            </div>

            {/* Conversation Stream */}
            <div className="overflow-y-auto space-y-3 pr-1 text-sm flex-1">
              {messages.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <p className="text-2xl mb-1.5">📖</p>
                  <p className="font-semibold text-slate-300">Camera ko apne question ya notes par point karein.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Mic hold karke puchiye, AI faculty step-by-step samjhayenge.</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs shadow-md ${
                        m.sender === "user"
                          ? "bg-teal-600 text-white rounded-br-none"
                          : "bg-slate-800/90 text-slate-100 border border-teal-500/30 rounded-bl-none"
                      }`}
                    >
                      {m.sender === "ai" ? formatSolutionText(m.text) : m.text}
                    </div>
                    <span className="text-[9.5px] font-mono text-slate-400 mt-0.5 px-1">
                      {m.time} {m.modelUsed ? `· ${m.modelUsed}` : ""}
                    </span>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>
          </div>
        ) : (
          /* COMPACT FLOATING GLASS CARD */
          <div
            onClick={() => setHudMode("expanded")}
            className="cursor-pointer bg-slate-900/85 hover:bg-slate-900/95 backdrop-blur-xl border border-white/15 hover:border-teal-400/40 rounded-2xl p-3 shadow-xl transition-all"
          >
            {latestAiMessage ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-teal-300 uppercase tracking-wider">
                      Faculty Explanation
                    </span>
                  </div>
                  <span className="text-[10px] text-teal-400 font-semibold flex items-center gap-1">
                    Tap to expand full solution ↗
                  </span>
                </div>
                <div className="text-xs text-slate-200 line-clamp-2 leading-snug">
                  {cleanTextForNaturalSpeech(latestAiMessage.text)}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-base">📸</span>
                  <span>Point camera at textbook & hold mic to speak</span>
                </div>
                <span className="text-[10.5px] text-teal-400 font-semibold">Details ↗</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* BOTTOM CONTROLS: MUTE, HOLD-TO-SPEAK MIC, CHAT EXPAND & END CALL */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative z-30 p-4 pb-6 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="max-w-xs mx-auto flex flex-col items-center gap-3">
          {/* Micro-Help Tooltip */}
          <div className="text-center text-[11px] font-medium text-slate-300">
            {isHoldingMic ? (
              <span className="text-emerald-400 font-bold animate-pulse">
                🔴 Listening... Chhodte hi AI solve karega
              </span>
            ) : (
              <span>🎙️ Hold mic to speak · Chhodte hi AI solve karega</span>
            )}
          </div>

          <div className="flex items-center justify-between w-full">
            {/* 1. Mute/Unmute Audio Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsMuted(!isMuted);
                if (!isMuted) stopSpeaking();
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-lg backdrop-blur-md border transition active:scale-95 shadow-md ${
                isMuted
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                  : "bg-slate-800/80 border-white/20 text-white hover:bg-slate-700/80"
              }`}
              title={isMuted ? "Unmute Voice" : "Mute Voice"}
            >
              {isMuted ? "🔇" : "🔊"}
            </button>

            {/* 2. Primary Hold-to-Speak Microphone Trigger */}
            <button
              type="button"
              onMouseDown={handleHoldStart}
              onMouseUp={handleHoldEnd}
              onTouchStart={handleHoldStart}
              onTouchEnd={handleHoldEnd}
              disabled={isAnalyzing}
              className={`relative flex items-center justify-center rounded-full transition-all select-none shadow-2xl ${
                isHoldingMic
                  ? "w-20 h-20 bg-rose-500 text-white scale-110 ring-4 ring-rose-400/50"
                  : isAnalyzing
                  ? "w-16 h-16 bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "w-16 h-16 bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 hover:brightness-110 active:scale-95 ring-2 ring-teal-300/40"
              }`}
            >
              {isHoldingMic && (
                <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-40" />
              )}
              <span className="text-2xl font-black">{isHoldingMic ? "🔴" : "🎙️"}</span>
            </button>

            {/* 3. Solution Drawer Toggle */}
            <button
              type="button"
              onClick={() => setHudMode(hudMode === "expanded" ? "compact" : "expanded")}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-lg backdrop-blur-md border transition active:scale-95 shadow-md ${
                hudMode === "expanded"
                  ? "bg-teal-500/30 border-teal-400 text-teal-300"
                  : "bg-slate-800/80 border-white/20 text-white hover:bg-slate-700/80"
              }`}
              title="Toggle Full Chat Solution Drawer"
            >
              💬
            </button>

            {/* 4. End Call Button */}
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                stopCamera();
                onClose();
              }}
              className="w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center text-lg active:scale-95 transition shadow-lg border border-rose-400/30"
              title="End Live Video Call"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Camera Error Alert */}
      {cameraError && (
        <div className="absolute inset-x-4 top-20 z-40 bg-rose-950/90 border border-rose-500/60 p-3 rounded-2xl text-center backdrop-blur-md shadow-2xl">
          <p className="text-xs font-bold text-rose-200">{cameraError}</p>
        </div>
      )}
    </div>
  );
}

export default LiveVideoCallModal;
