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
  failoverReason?: string;
  latencyMs?: number;
}

// ─── PHONETIC TEACHER NORMALIZER (CLEANS MATH FOR NATURAL ACCENT & FLUIDITY) ───
function cleanTextForNaturalSpeech(raw: string): string {
  if (!raw) return "";
  let text = raw;

  text = text.replace(/[*#`_~]/g, " ");
  text = text.replace(/\$\$|\$/g, " ");
  text = text.replace(/Step \d+:\s*/gi, "");
  text = text.replace(/\\\[|\\\]|\\\(|\\\)/g, "");

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

  text = text.replace(/[\[\]{}()]/g, " ");
  text = text.replace(/[-–—]/g, " ");
  text = text.replace(/\s+/g, " ");

  return text.trim();
}

// ─── CLEAN FORMATTER FOR COPIED / PLAIN TEXT ───
function cleanFormulaSymbols(raw: string): string {
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

// ─── RICH STRUCTURED SOLUTION CARD COMPONENT ───
function FormattedSolutionCard({
  message,
  onReplay,
  isSpeakingThis,
  onStopSpeech,
}: {
  message: LiveMessage;
  onReplay: (text: string) => void;
  isSpeakingThis: boolean;
  onStopSpeech: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = cleanFormulaSymbols(message.text);
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const rawLines = message.text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return (
    <div className="bg-slate-900/95 border border-teal-500/30 rounded-2xl p-3.5 text-slate-100 shadow-xl space-y-2.5 transition-all">
      {/* Header: Provider Badge, Latency, and Timestamps */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {message.provider === "google" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
              ✨ Gemini Vision AI
            </span>
          ) : message.provider === "groq" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              ⚡ Groq LPU (Fast Failover)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              👨‍🏫 AI Faculty
            </span>
          )}

          {message.latencyMs && (
            <span className="text-[9px] font-mono text-slate-400">
              ⚡ {(message.latencyMs / 1000).toFixed(1)}s
            </span>
          )}
          <span className="text-[9px] font-mono text-slate-500">· {message.time}</span>
        </div>

        {/* Quick Actions: Audio & Copy */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => (isSpeakingThis ? onStopSpeech() : onReplay(message.text))}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
              isSpeakingThis
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                : "bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30"
            }`}
            title={isSpeakingThis ? "Stop Voice" : "Replay Voice"}
          >
            <span>{isSpeakingThis ? "⏹️ Stop" : "🔊 Listen"}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 transition"
            title="Copy Solution"
          >
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
        </div>
      </div>

      {/* Failover Alert if Gemini had quota / network trouble */}
      {message.failoverReason && (
        <div className="text-[9px] text-amber-300/90 bg-amber-950/40 border border-amber-500/30 rounded-lg px-2.5 py-1 leading-normal font-mono">
          ℹ️ {message.failoverReason}
        </div>
      )}

      {/* Structured Solution Content with Steps & Formulas */}
      <div className="space-y-2 text-xs leading-relaxed">
        {rawLines.map((line, idx) => {
          const cleanLine = cleanFormulaSymbols(line);
          const lower = cleanLine.toLowerCase();

          // Step / Heading detection
          const isStepHeader =
            lower.startsWith("step") ||
            lower.startsWith("case") ||
            lower.startsWith("formula:") ||
            lower.startsWith("derivation:") ||
            lower.startsWith("given:") ||
            lower.startsWith("calculation:") ||
            lower.startsWith("final answer:") ||
            lower.startsWith("conclusion:");

          if (isStepHeader) {
            return (
              <div key={idx} className="pt-1.5 pb-0.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-teal-500/20 border border-teal-500/40 text-teal-300 text-[10.5px] font-bold uppercase tracking-wide">
                  <span>✦</span>
                  <span>{cleanLine}</span>
                </div>
              </div>
            );
          }

          // Math Formula detection
          const isFormula =
            (cleanLine.includes("=") ||
              cleanLine.includes("×") ||
              cleanLine.includes("÷") ||
              cleanLine.includes("√") ||
              cleanLine.includes("Mo =") ||
              cleanLine.includes("Me =") ||
              cleanLine.includes("M =")) &&
            !cleanLine.includes(" ") &&
            cleanLine.length < 90;

          const isMathLine =
            (cleanLine.includes("=") || cleanLine.includes(" → ")) &&
            (cleanLine.includes("/") ||
              cleanLine.includes("+") ||
              cleanLine.includes("-") ||
              cleanLine.includes("×") ||
              cleanLine.includes("√") ||
              cleanLine.length < 80);

          if (isFormula || isMathLine) {
            return (
              <div
                key={idx}
                className="my-1.5 p-2.5 rounded-xl bg-black/60 border border-teal-500/40 text-teal-200 font-mono text-[11.5px] flex items-center justify-between shadow-inner"
              >
                <span className="font-semibold select-all tracking-wide">{cleanLine}</span>
                <span className="text-[8.5px] text-teal-400/60 font-sans uppercase font-bold tracking-wider">
                  Formula
                </span>
              </div>
            );
          }

          // Bullet points
          if (cleanLine.startsWith("-") || cleanLine.startsWith("•") || cleanLine.startsWith("*")) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1 text-slate-200">
                <span className="text-teal-400 font-bold">•</span>
                <span className="flex-1">{cleanLine.replace(/^[-•*]\s*/, "")}</span>
              </div>
            );
          }

          // Standard explanatory paragraph
          return (
            <p key={idx} className="text-slate-100 leading-relaxed font-normal">
              {cleanLine}
            </p>
          );
        })}
      </div>
    </div>
  );
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

  // Call & HUD State
  const [callDuration, setCallDuration] = useState(0);
  const [hudMode, setHudMode] = useState<"compact" | "expanded">("compact");
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [activeSpeechMessageId, setActiveSpeechMessageId] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);

  // Continuous Sentence Queue Refs
  const audioQueueRef = useRef<string[]>([]);
  const isAudioQueuePlayingRef = useRef<boolean>(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioPreloadRef = useRef<HTMLAudioElement | null>(null);
  const ttsHeartbeatRef = useRef<any>(null);

  // Sound FX synthesizer
  const playUiTone = (type: "start" | "stop" | "ai") => {
    try {
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
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === "stop") {
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === "ai") {
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (_) {}
  };

  // Timer Hook
  useEffect(() => {
    if (!isModalOpen) {
      setCallDuration(0);
      return;
    }
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isModalOpen]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Camera Initializer & Stream Manager
  const startCamera = useCallback(
    async (mode: "environment" | "user") => {
      try {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        setCameraError(null);

        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: mode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (_) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        setCameraError(
          "Camera access allow karein taaki handwritten notes aur book scan ho sakein."
        );
      }
    },
    [stream]
  );

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

  const stopAll = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    stopSpeaking();
    setIsTorchOn(false);
    setHudMode("compact");
  };

  // Torch / Flashlight Toggle
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && typeof (track as any).applyConstraints === "function") {
      try {
        const nextTorch = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextTorch }],
        });
        setIsTorchOn(nextTorch);
      } catch (_) {
        setIsTorchOn(false);
      }
    }
  };

  // Flip Camera
  const toggleCameraSwitch = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
  };

  // ─── CONTINUOUS, MULTI-SENTENCE STREAMING SPEECH ENGINE ───
  const stopSpeaking = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    if (nextAudioPreloadRef.current) {
      nextAudioPreloadRef.current.src = "";
      nextAudioPreloadRef.current = null;
    }
    audioQueueRef.current = [];
    isAudioQueuePlayingRef.current = false;

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (ttsHeartbeatRef.current) {
      clearInterval(ttsHeartbeatRef.current);
      ttsHeartbeatRef.current = null;
    }
    setIsAiSpeaking(false);
    setActiveSpeechMessageId(null);
  };

  const fallbackClientChunk = (chunkText: string, onDone: () => void) => {
    if (typeof window === "undefined" || !window.speechSynthesis || isMuted) {
      onDone();
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(chunkText);
      utterance.rate = 1.15;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => {
          const n = (v.name || "").toLowerCase();
          const l = (v.lang || "").toLowerCase();
          return (
            (n.includes("prabhat") ||
              n.includes("madhur") ||
              n.includes("male") ||
              n.includes("google") ||
              n.includes("indian")) &&
            (l.startsWith("en-in") || l.startsWith("hi"))
          );
        }) ||
        voices.find((v) => (v.lang || "").toLowerCase().startsWith("hi")) ||
        voices.find((v) => (v.lang || "").toLowerCase().startsWith("en-in"));

      if (preferred) {
        utterance.voice = preferred;
        utterance.lang = preferred.lang;
      } else {
        utterance.lang = "en-IN";
      }

      utterance.onend = () => onDone();
      utterance.onerror = () => onDone();

      if (!ttsHeartbeatRef.current) {
        ttsHeartbeatRef.current = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          } else {
            clearInterval(ttsHeartbeatRef.current);
            ttsHeartbeatRef.current = null;
          }
        }, 6000);
      }

      window.speechSynthesis.speak(utterance);
    } catch (_) {
      onDone();
    }
  };

  const playNextInQueue = () => {
    if (audioQueueRef.current.length === 0) {
      setIsAiSpeaking(false);
      isAudioQueuePlayingRef.current = false;
      setActiveSpeechMessageId(null);
      return;
    }

    if (isMuted) {
      stopSpeaking();
      return;
    }

    const chunk = audioQueueRef.current.shift()!;
    if (!chunk || chunk.trim().length === 0) {
      playNextInQueue();
      return;
    }

    setIsAiSpeaking(true);
    isAudioQueuePlayingRef.current = true;

    if (audioQueueRef.current.length > 0) {
      const nextChunk = audioQueueRef.current[0];
      const preload = new Audio(
        `/api/ai-doubt/live/tts?text=${encodeURIComponent(nextChunk.slice(0, 180))}`
      );
      preload.preload = "auto";
      nextAudioPreloadRef.current = preload;
    }

    const audioUrl = `/api/ai-doubt/live/tts?text=${encodeURIComponent(chunk.slice(0, 180))}`;
    const audio =
      nextAudioPreloadRef.current &&
      nextAudioPreloadRef.current.src.includes(encodeURIComponent(chunk.slice(0, 180)))
        ? nextAudioPreloadRef.current
        : new Audio(audioUrl);

    activeAudioRef.current = audio;

    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      activeAudioRef.current = null;
      playNextInQueue();
    };

    audio.onended = advance;
    audio.onerror = () => {
      fallbackClientChunk(chunk, advance);
    };

    audio.play().catch(() => {
      fallbackClientChunk(chunk, advance);
    });
  };

  const speakFullResponse = (rawText: string, messageId?: string) => {
    if (!rawText || isMuted) return;
    stopSpeaking();

    const cleaned = cleanTextForNaturalSpeech(rawText);
    if (!cleaned) return;

    const rawChunks = cleaned
      .split(/(?<=[.?!।\n])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1);

    const fineChunks: string[] = [];
    for (const c of rawChunks) {
      if (c.length <= 150) {
        fineChunks.push(c);
      } else {
        const sub = c
          .split(/(?<=[,;])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 1);
        fineChunks.push(...sub);
      }
    }

    if (fineChunks.length === 0) return;

    playUiTone("ai");
    if (messageId) setActiveSpeechMessageId(messageId);
    audioQueueRef.current = fineChunks;
    playNextInQueue();
  };

  // Send Doubt with Camera Snapshot
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
    const promptToSend =
      queryText ||
      "Camera par jo handwritten notes aur ray diagram hai use step-by-step detail mein explain kijiye.";

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
      const reply =
        data?.reply || "Sawal clear nahi dikh raha. Kripya camera notes par focus karein.";

      const aiMsgId = (Date.now() + 1).toString();
      const aiMsg: LiveMessage = {
        id: aiMsgId,
        sender: "ai",
        text: reply,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        modelUsed: data?.model,
        provider: data?.provider,
        failoverReason: data?.failoverReason,
        latencyMs: data?.latencyMs,
      };

      setMessages((prev) => [...prev, aiMsg]);
      speakFullResponse(reply, aiMsgId);
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

  // Push-to-Talk (Hold Mic)
  const handleHoldStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (isAnalyzing) return;

    stopSpeaking();
    setIsHoldingMic(true);
    playUiTone("start");
    setTranscript("");
    transcriptRef.current = "";

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "hi-IN";

        rec.onresult = (event: any) => {
          let current = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          if (current) {
            setTranscript(current);
            transcriptRef.current = current;
          }
        };

        rec.onerror = () => {};
        rec.start();
        recognitionRef.current = rec;
      } catch (_) {}
    }
  };

  const handleHoldEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isHoldingMic) return;

    setIsHoldingMic(false);
    playUiTone("stop");

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }

    const captured = transcriptRef.current.trim();
    sendLiveDoubt(captured);
  };

  if (!isModalOpen) return null;

  const latestAiMessage = [...messages].reverse().find((m) => m.sender === "ai");

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none font-sans">
      <canvas ref={canvasRef} className="hidden" />

      {/* CAMERA FULLSCREEN FEED */}
      <div className="absolute inset-0 z-0 bg-slate-950 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            facingMode === "user" ? "scale-x-[-1]" : ""
          }`}
        />

        {/* Optical Scanning Target Crosshair */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
          <div className="w-full max-w-sm aspect-[4/3] border-2 border-teal-400/40 rounded-3xl relative">
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-teal-300 rounded-tl-lg" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-teal-300 rounded-tr-lg" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-teal-300 rounded-bl-lg" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-teal-300 rounded-br-lg" />

            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-teal-400/30 text-[9px] font-bold text-teal-300">
              Align derivation / diagram here
            </div>
          </div>
        </div>

        {/* Shutter White Flash effect */}
        {flashTrigger && (
          <div className="absolute inset-0 bg-white/70 pointer-events-none z-30 transition-opacity duration-150 animate-out fade-out" />
        )}

        {/* Camera Permission Alert */}
        {cameraError && (
          <div className="absolute z-20 max-w-xs bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-rose-500/50 text-center text-xs text-white">
            <p className="font-bold text-rose-400 mb-1">Camera Permission Required</p>
            <p className="text-slate-300">{cameraError}</p>
            <button
              onClick={() => startCamera(facingMode)}
              className="mt-3 px-4 py-1.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* TOP FLOATING HEADER (Call Info & Controls) */}
      <div className="relative z-20 flex items-center justify-between p-4 pt-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2.5 bg-black/40 backdrop-blur-md border border-white/10 px-3.5 py-1.5 rounded-full shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-wide text-white">
              LIVE FACULTY AI
            </span>
            <span className="text-[10px] font-mono text-teal-300 font-bold">
              {formatTime(callDuration)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTorch}
            className={`w-10 h-10 rounded-full flex items-center justify-center border text-sm backdrop-blur-md transition-all shadow-md ${
              isTorchOn
                ? "bg-amber-400 border-amber-300 text-black font-bold scale-105"
                : "bg-black/40 border-white/15 text-white hover:bg-black/60"
            }`}
            title="Toggle Flashlight"
          >
            🔦
          </button>

          <button
            type="button"
            onClick={toggleCameraSwitch}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-black/40 border border-white/15 text-white backdrop-blur-md hover:bg-black/60 text-sm shadow-md"
            title="Flip Camera"
          >
            🔄
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-rose-600/90 border border-rose-500 text-white backdrop-blur-md hover:bg-rose-700 text-sm font-bold shadow-md"
            title="End Video Call"
          >
            ✕
          </button>
        </div>
      </div>

      {/* REAL-TIME SPEECH BUBBLE OVERLAY */}
      {isHoldingMic && transcript && (
        <div className="relative z-20 max-w-sm mx-auto px-4 w-full">
          <div className="bg-emerald-950/90 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-3 text-center shadow-xl animate-pulse">
            <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block mb-1">
              🎙️ Listening to your question...
            </span>
            <p className="text-xs text-white font-medium italic">"{transcript}"</p>
          </div>
        </div>
      )}

      {/* BOTTOM-ALIGNED FLOATING HUD */}
      <div className="relative z-20 max-w-md mx-auto w-full px-4 mb-2 mt-auto">
        {hudMode === "expanded" ? (
          <div className="bg-slate-900/95 backdrop-blur-2xl border border-teal-500/40 rounded-3xl p-4 shadow-2xl space-y-3 transition-all max-h-[65vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
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

            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {messages.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs font-bold text-white">
                    Book ya handwritten notes camera ke samne rakhein
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Niche <span className="text-emerald-400 font-bold">Mic daba kar</span> sawal puchein.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  if (m.sender === "user") {
                    return (
                      <div
                        key={m.id}
                        className="p-3 rounded-2xl text-xs leading-relaxed bg-teal-950/70 border border-teal-500/30 text-teal-100 ml-6 text-right"
                      >
                        <div className="text-[9px] font-mono text-teal-400/80 mb-0.5">
                          You · {m.time}
                        </div>
                        <div>{m.text}</div>
                      </div>
                    );
                  }
                  return (
                    <FormattedSolutionCard
                      key={m.id}
                      message={m}
                      onReplay={(txt) => speakFullResponse(txt, m.id)}
                      isSpeakingThis={isAiSpeaking && activeSpeechMessageId === m.id}
                      onStopSpeech={stopSpeaking}
                    />
                  );
                })
              )}

              {isAnalyzing && (
                <div className="p-3.5 rounded-2xl bg-teal-950/60 border border-teal-500/40 flex items-center gap-3 animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
                  <span className="text-xs font-bold text-teal-200">
                    Reading handwritten formulas & diagram...
                  </span>
                </div>
              )}
            </div>

            {/* Quick Typed Query Bar */}
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
                className="flex-1 bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-teal-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (typedInput.trim()) sendLiveDoubt(typedInput.trim());
                }}
                disabled={!typedInput.trim() || isAnalyzing}
                className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs"
              >
                Send
              </button>
            </div>
          </div>
        ) : hudMode === "compact" && latestAiMessage ? (
          <div
            onClick={() => setHudMode("expanded")}
            className="w-full bg-slate-900/90 backdrop-blur-md border border-teal-500/40 rounded-2xl p-3 text-left shadow-xl active:scale-98 transition cursor-pointer flex items-center justify-between group"
          >
            <div className="truncate mr-2.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-teal-400" />
                <span className="text-[9.5px] font-mono font-bold text-teal-300 uppercase tracking-wide">
                  {latestAiMessage.provider === "google"
                    ? "✨ Gemini Solution"
                    : latestAiMessage.provider === "groq"
                    ? "⚡ Groq Solution"
                    : "Latest Solution"}
                </span>
                {isAiSpeaking && (
                  <span className="text-[9px] font-bold text-emerald-400 animate-pulse flex items-center gap-1">
                    <span>🔊</span>
                    <span>Speaking...</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-white truncate font-medium">
                {cleanFormulaSymbols(latestAiMessage.text).slice(0, 85)}...
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-teal-300 bg-teal-500/20 border border-teal-500/30 px-3 py-1.5 rounded-xl shrink-0 font-bold group-hover:bg-teal-500/30">
              <span>View Full</span>
              <span>💬</span>
            </div>
          </div>
        ) : isAnalyzing ? (
          <div className="mx-auto w-fit flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-teal-500/30 rounded-full px-4 py-2 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span className="text-xs font-bold text-teal-200">
              Scanning handwritten formulas & diagram...
            </span>
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
                ⚡ Reading notes & formulating solution...
              </span>
            ) : isAiSpeaking ? (
              <span className="text-emerald-300 font-bold flex items-center justify-center gap-1">
                <span>🔊 AI Faculty is speaking...</span>
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="underline ml-1 text-rose-400 font-bold"
                >
                  (Stop)
                </button>
              </span>
            ) : (
              <span>🎙️ Hold mic to speak · Chhodte hi AI solve karega</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-5">
          {/* Mute/Unmute AI Voice Button */}
          <button
            type="button"
            onClick={() => {
              const nextMute = !isMuted;
              setIsMuted(nextMute);
              if (!nextMute) stopSpeaking();
            }}
            className={`p-3 rounded-full border transition-all ${
              isMuted
                ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                : "bg-black/50 border-white/15 text-slate-300 hover:text-white"
            }`}
            title={isMuted ? "Unmute AI Voice" : "Mute AI Voice"}
          >
            {isMuted ? "🔇" : "🔊"}
          </button>

          {/* MAIN PUSH-TO-TALK MIC BUTTON (HOLD TO TALK) */}
          <button
            type="button"
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            disabled={isAnalyzing}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-2xl transition-all duration-200 select-none ${
              isHoldingMic
                ? "bg-emerald-500 scale-110 shadow-emerald-500/50 ring-4 ring-emerald-300"
                : isAnalyzing
                ? "bg-slate-700 opacity-60 scale-95"
                : "bg-gradient-to-tr from-teal-600 to-emerald-500 hover:scale-105 active:scale-95 shadow-teal-500/30"
            }`}
            title="Press and Hold to Speak"
          >
            {isHoldingMic ? "🔴" : isAnalyzing ? "⏳" : "🎙️"}
          </button>

          {/* Toggle HUD Solution Drawer */}
          <button
            type="button"
            onClick={() => setHudMode(hudMode === "expanded" ? "compact" : "expanded")}
            className={`p-3 rounded-full border transition-all ${
              hudMode === "expanded"
                ? "bg-teal-500/20 border-teal-500/40 text-teal-300"
                : "bg-black/50 border-white/15 text-slate-300 hover:text-white"
            }`}
            title="Toggle Solution Notes Drawer"
          >
            💬
          </button>
        </div>
      </div>
    </div>
  );
}

export default LiveVideoCallModal;
