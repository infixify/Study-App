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
  // Strip stray LaTeX delimiters and markdown symbols cleanly
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  return lines.map((line, idx) => {
    let clean = line
      .replace(/\$\$|\$/g, "")
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 / $2")
      .replace(/\\left|\\right/g, "")
      .trim();

    // Check if it's a heading
    const isHeading = clean.startsWith("#") || clean.startsWith("**") && clean.endsWith("**");
    clean = clean.replace(/[*#]/g, "").trim();

    // Check if it's a bullet point
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
  
  // Voice Gender Selector: "female" (Swara/Neerja) vs "male" (Prabhat/Madhur)
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");

  // Floating HUD Modes: "compact" | "expanded"
  const [hudMode, setHudMode] = useState<"compact" | "expanded">("compact");
  
  // Speech & UI State
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
  
  // High-Speed Continuous Speech Queue Refs
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingQueueRef = useRef<boolean>(false);
  const ttsHeartbeatRef = useRef<any>(null);

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

  // 3. Camera Stream (audio: false guarantees mic is 100% free for user speech)
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

  // 5. Cancel Speech (Barge-in on tap/mic hold)
  const stopSpeaking = () => {
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
    // Active, energetic Kota/Delhi faculty speaking speed (No dragging!)
    utterance.rate = 1.15;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();

    // Pick top Indian teacher voice based on selected gender
    const preferredVoice =
      voiceGender === "female"
        ? voices.find((v) => {
            const n = (v.name || "").toLowerCase();
            const l = (v.lang || "").toLowerCase();
            return (n.includes("neerja") || n.includes("swara") || n.includes("female") || n.includes("google")) &&
              (l.startsWith("en-in") || l.startsWith("hi"));
          }) ||
          voices.find((v) => (v.lang || "").toLowerCase().startsWith("en-in"))
        : voices.find((v) => {
            const n = (v.name || "").toLowerCase();
            const l = (v.lang || "").toLowerCase();
            return (n.includes("prabhat") || n.includes("madhur") || n.includes("male") || n.includes("google")) &&
              (l.startsWith("en-in") || l.startsWith("hi"));
          }) ||
          voices.find((v) => (v.lang || "").toLowerCase().startsWith("en-in"));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    } else {
      utterance.lang = "en-IN";
    }

    // Zero-Delay Continuous Speech Transition: as soon as sentence ends, speak next immediately!
    utterance.onend = () => {
      speakNextSentence();
    };

    utterance.onerror = () => {
      speakNextSentence();
    };

    // Heartbeat to prevent Android Chrome silent cutoff
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

  const speakResponse = (rawText: string) => {
    if (!rawText || isMuted) return;
    stopSpeaking();

    const cleaned = cleanTextForNaturalSpeech(rawText);
    if (!cleaned) return;

    // Split into sentences (by period, question mark, exclamation)
    const sentences = cleaned
      .split(/(?<=[.!?])\s+/)
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

    holdStartTimeRef.current = Date.now();
    setIsHoldingMic(true);
    setTranscript("");
    transcriptRef.current = "";

    stopSpeaking();

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
        recognition.lang = "en-IN"; // Clean English text ("Explain this", "Solve this derivation")
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

      {/* TOP HEADER: Status, Timer, Voice Switcher & Camera Switch */}
      <div className="relative z-20 flex items-center justify-between p-4 pt-6">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-md">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-black text-white tracking-wide">LIVE AI FACULTY</span>
          <span className="text-[11px] font-mono font-bold text-slate-300">· {formatTime(callDuration)}</span>
        </div>

        {/* Center: Live Voice Gender Switcher */}
        <button
          type="button"
          onClick={() => setVoiceGender(voiceGender === "female" ? "male" : "female")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-xs font-bold text-white shadow-md active:scale-95 transition"
          title="Switch Faculty Voice (Female / Male)"
        >
          <span>{voiceGender === "female" ? "👩‍🏫" : "👨‍🏫"}</span>
          <span className="text-[10.5px] font-semibold">
            {voiceGender === "female" ? "Mam" : "Sir"}
          </span>
        </button>

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
        /* While Holding Mic: Live English Words Preview */
        <div className="relative z-30 mx-auto max-w-xs px-4 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-emerald-500/40 text-center shadow-lg">
          <p className="text-[11.5px] font-semibold text-emerald-300 truncate">
            🎙️ "{transcript}"
          </p>
        </div>
      ) : isAiSpeaking ? (
        /* While Speaking: Animated Voice Pill */
        <div className="relative z-30 mx-auto max-w-xs px-3.5 py-1.5 rounded-full bg-emerald-950/85 backdrop-blur-md border border-emerald-500/40 text-center shadow-lg flex items-center justify-center gap-2 animate-pulse">
          <span className="text-xs">🔊</span>
          <p className="text-[11px] font-bold text-emerald-300">
            Faculty Explaining... (Tap to pause)
          </p>
        </div>
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
                className="text-slate-300 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-white/10 font-bold"
              >
                Minimize ▾
              </button>
            </div>

            {/* Scrollable Message History with Clean Whiteboard Study Cards */}
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
                    {/* Render Clean Text without ugly symbols */}
                    <div>{formatSolutionText(m.text)}</div>
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
