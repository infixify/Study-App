// components/dashboard/AiChatSheet.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "assistant" | "user";
  content: string;
  image?: string;
  isLiveSession?: boolean;
}

interface StudentContext {
  name?: string;
  targetExam?: string;
  classLevel?: string;
  daysToExam?: number | null;
  examLabel?: string | null;
  weakSubjects?: string[];
  weaknesses?: string[];
  pendingBacklogCount?: number;
}

interface AiChatSheetProps {
  open: boolean;
  onClose: () => void;
  studentContext?: StudentContext;
}

const SESSION_KEY = "pw_doubt_chat_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const DAILY_LIMIT = 10;

function getTodayLimitKey(): string {
  const today = new Date().toISOString().split("T")[0];
  return `pw_doubt_daily_quota_${today}`;
}

function getRemainingQuota(): number {
  try {
    const raw = localStorage.getItem(getTodayLimitKey());
    if (raw !== null) {
      const used = parseInt(raw) || 0;
      return Math.max(0, DAILY_LIMIT - used);
    }
  } catch (_) {}
  return DAILY_LIMIT;
}

function decrementQuota(): number {
  try {
    const current = getRemainingQuota();
    const used = DAILY_LIMIT - current + 1;
    localStorage.setItem(getTodayLimitKey(), used.toString());
    return Math.max(0, DAILY_LIMIT - used);
  } catch (_) {
    return DAILY_LIMIT - 1;
  }
}

// ─── 1. SMART SPEECH FILTER (Removes emojis, symbols & makes formulas natural) ───
function cleanTextForSpeech(raw: string): string {
  if (!raw) return "";
  let s = raw;

  // 1. Remove all emojis
  s = s.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");

  // 2. Pronounce math symbols naturally
  s = s.replace(/\\phi/gi, " Phi ")
       .replace(/\\theta/gi, " Theta ")
       .replace(/\\vec\{([^}]+)\}/gi, " vector $1 ")
       .replace(/\\cdot/gi, " dot ")
       .replace(/\\times/gi, " multiplied by ")
       .replace(/\\cos/gi, " cos ")
       .replace(/\\sin/gi, " sin ")
       .replace(/\\tan/gi, " tan ")
       .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/gi, " $1 divided by $2 ")
       .replace(/\\Delta/gi, " Delta ");

  // 3. Remove Markdown & LaTeX syntax markers
  s = s.replace(/\$\$/g, " ")
       .replace(/\$/g, " ")
       .replace(/[*_#`~=\-]/g, " ")
       .replace(/\\/g, " ")
       .replace(/\s+/g, " ")
       .trim();

  return s.slice(0, 480);
}

// ─── 2. MATH & MARKDOWN VISUAL FORMATTER ───
function FormattedSolution({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-ink/90 font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Display Equation Block $$ ... $$
        if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) {
          const eq = trimmed.slice(2, -2).trim();
          return (
            <div key={idx} className="my-2 p-2.5 bg-teal/5 border border-teal/20 rounded-xl text-center font-mono font-bold text-teal text-sm tracking-wide overflow-x-auto">
              {eq.replace(/\\vec\{([^}]+)\}/g, "$1⃗")
                 .replace(/\\cdot/g, " • ")
                 .replace(/\\phi/g, "Φ")
                 .replace(/\\theta/g, "θ")
                 .replace(/\\cos/g, "cos")
                 .replace(/\\sin/g, "sin")
                 .replace(/\\times/g, "×")}
            </div>
          );
        }

        // Section Heading ###
        if (trimmed.startsWith("###")) {
          return (
            <h4 key={idx} className="font-black text-ink text-[12.5px] mt-2 mb-0.5 border-b border-ink/8 pb-0.5">
              {trimmed.replace(/^###\s*/, "")}
            </h4>
          );
        }

        // Clean inline math & bold
        const cleanLine = trimmed
          .replace(/\$\$(.*?)\$\$/g, " $1 ")
          .replace(/\$(.*?)\$/g, " $1 ")
          .replace(/\\phi/g, "Φ")
          .replace(/\\vec\{([^}]+)\}/g, "$1⃗")
          .replace(/\\cdot/g, "•")
          .replace(/\\theta/g, "θ");

        return (
          <p key={idx} className={trimmed.startsWith("**") ? "font-bold text-ink" : "text-ink/80"}>
            {cleanLine}
          </p>
        );
      })}
    </div>
  );
}

export default function AiChatSheet({ open, onClose, studentContext }: AiChatSheetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [remainingQuota, setRemainingQuota] = useState(DAILY_LIMIT);

  // Audio Speech state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);

  // ── TRUE CONTINUOUS LIVE VIDEO CALL STATE ──
  const [liveCallOpen, setLiveCallOpen] = useState(false);
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [liveSolution, setLiveSolution] = useState<string | null>(null);
  const [isSolutionExpanded, setIsSolutionExpanded] = useState(true);
  const [liveSessionItems, setLiveSessionItems] = useState<{ query: string; reply: string }[]>([]);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // Pure Voice in Chat
  const [isChatVoiceRecording, setIsChatVoiceRecording] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      stopLiveCall();
      stopSpeaking();
      return;
    }
    setRemainingQuota(getRemainingQuota());

    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.savedAt < SESSION_TTL_MS && parsed.messages?.length > 1) {
          setMessages(parsed.messages);
          return;
        }
      }
    } catch (_) {}

    const name = studentContext?.name || "Champion";
    const exam = studentContext?.targetExam || "JEE/NEET";

    setMessages([
      {
        role: "assistant",
        content: `Namaste ${name}! Main aapka AI Doubt Faculty hoon. Koi bhi sawaal bol kar puchein (🎙️), photo attach karein ya **Start Live Call (🎥)** se direct uninterrupted video call karein! ✍️`,
      },
    ]);
  }, [open]);

  useEffect(() => {
    if (open) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (messages.length > 1) {
      try {
        const stripped = messages.map((m) => ({ ...m, image: undefined }));
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ messages: stripped, savedAt: Date.now() }));
      } catch (_) {}
    }
  }, [messages]);

  // ─── NATURAL GOOGLE VOICE (Web Speech API with neural accent) ───
  const speakNaturalVoice = useCallback(
    (text: string) => {
      if (audioMuted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      try {
        window.speechSynthesis.cancel();
        const cleanSpokenText = cleanTextForSpeech(text);
        if (!cleanSpokenText) return;

        const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Find Natural Google Indian English / Hindi voice
        const voices = window.speechSynthesis.getVoices();
        const bestVoice = voices.find(
          (v) =>
            v.lang.includes("hi-IN") ||
            v.lang.includes("en-IN") ||
            v.name.includes("Google हिन्दी") ||
            v.name.includes("India")
        );
        if (bestVoice) utterance.voice = bestVoice;
        else utterance.lang = "en-IN";

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
      } catch (_) {
        setIsSpeaking(false);
      }
    },
    [audioMuted]
  );

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // ─── TRUE CONTINUOUS LIVE VIDEO CALL CONTROLS ───
  const startLiveCall = async (mode: "environment" | "user" = facingMode) => {
    setLiveCallOpen(true);
    setLiveSolution(null);
    setIsSolutionExpanded(true);
    setLiveSessionItems([]);

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      alert("Camera permission allow karein live video call ke liye.");
      setLiveCallOpen(false);
    }
  };

  const flipLiveCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startLiveCall(next);
  };

  // END LIVE CALL: Camera closes & all live doubts are dumped into Chat!
  const stopLiveCall = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    stopSpeaking();

    // Append all resolved doubts from this live call to the main Chat!
    if (liveSessionItems.length > 0) {
      const newChatMessages: Message[] = [];
      liveSessionItems.forEach((item) => {
        newChatMessages.push({ role: "user", content: `🎥 [Live Call Doubt]: ${item.query}` });
        newChatMessages.push({ role: "assistant", content: item.reply, isLiveSession: true });
      });
      setMessages((prev) => [...prev, ...newChatMessages]);
    }

    setLiveCallOpen(false);
    setIsLiveListening(false);
  };

  const captureLiveVideoFrame = (): string | null => {
    if (!videoRef.current) return null;
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.75);
  };

  // Speak inside Live Video Call (Camera stays open!)
  const triggerLiveSpeechQuery = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const snap = captureLiveVideoFrame();
      handleLiveExecution(snap, "Explain the question shown in the camera step-by-step.");
      return;
    }

    setIsLiveListening(true);
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const spoken = event.results[0][0]?.transcript || "";
        setIsLiveListening(false);
        const snap = captureLiveVideoFrame();
        handleLiveExecution(snap, spoken || "Explain this question");
      };

      recognition.onerror = () => {
        setIsLiveListening(false);
        const snap = captureLiveVideoFrame();
        handleLiveExecution(snap, "Explain this question");
      };

      recognition.onend = () => setIsLiveListening(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch (_) {
      setIsLiveListening(false);
    }
  };

  const handleLiveExecution = async (imgData: string | null, promptText: string) => {
    if (remainingQuota <= 0) {
      setLiveSolution("⚠️ Aaj ka free doubt quota khatam ho chuka hai! Kal naya quota milega.");
      return;
    }

    setLoading(true);
    const updatedQuota = decrementQuota();
    setRemainingQuota(updatedQuota);

    try {
      const res = await fetch("/api/ai-doubt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: promptText,
          image: imgData,
          isLive: true,
          targetExam: studentContext?.targetExam || "JEE",
          studentContext,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const replyText = data.reply || "Solution complete.";
        setLiveSolution(replyText);
        setIsSolutionExpanded(true);
        setLiveSessionItems((prev) => [...prev, { query: promptText, reply: replyText }]);
        speakNaturalVoice(replyText); // 🔊 Speaks in clean natural voice!
      } else {
        setLiveSolution("Sawal samajhne mein dikkat aayi. Kripya dobara mic daba kar puchein!");
      }
    } catch {
      setLiveSolution("Network error. Internet check karein!");
    } finally {
      setLoading(false);
    }
  };

  // ─── CHAT MODE EXECUTION ───
  const handleExecuteDoubt = async (imgData: string | null, promptText: string) => {
    if (remainingQuota <= 0) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Aaj ke **${DAILY_LIMIT} free doubts** khatam ho chuke hain! Raat 12 baje reset ho jayega.`,
        },
      ]);
      return;
    }

    const userMsg: Message = { role: "user", content: promptText, image: imgData || undefined };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    const updatedQuota = decrementQuota();
    setRemainingQuota(updatedQuota);

    try {
      const res = await fetch("/api/ai-doubt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: promptText,
          image: imgData,
          isLive: false,
          targetExam: studentContext?.targetExam || "JEE",
          studentContext,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const replyText = data.reply || "Solution complete.";
        setMessages((prev) => [...prev, { role: "assistant", content: replyText }]);
        speakNaturalVoice(replyText);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sawal samajhne mein dikkat aayi. Dobara try karein!" },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error. Please check your internet connection." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const img = new Image();
      img.src = uploadEvent.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1000;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, w, h);
        setSelectedImage(canvas.toDataURL("image/jpeg", 0.75));
      };
    };
    reader.readAsDataURL(file);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in">
      <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl shadow-2xl flex flex-col h-[85vh] border-t border-ink/10 relative overflow-hidden">

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* ── 1. TRUE FULLSCREEN CONTINUOUS LIVE VIDEO CALL OVERLAY ── */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {liveCallOpen && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col justify-between animate-in fade-in">
            {/* Top Bar */}
            <div className="p-3.5 flex items-center justify-between text-white z-20 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-black tracking-wide bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-md">
                  Gemini Live Call
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={flipLiveCamera}
                  className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-xs backdrop-blur-md active:scale-95"
                  title="Flip Camera"
                >
                  🔄
                </button>
                <button
                  type="button"
                  onClick={stopLiveCall}
                  className="px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1 shadow-lg active:scale-95"
                >
                  <span>End Call</span> ✕
                </button>
              </div>
            </div>

            {/* Continuous Video Feed (Camera NEVER closes) */}
            <div className="absolute inset-0 z-0 bg-black flex items-center justify-center">
              <video
                ref={(el) => {
                  videoRef.current = el;
                  if (el && mediaStreamRef.current && el.srcObject !== mediaStreamRef.current) {
                    el.srcObject = mediaStreamRef.current;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            {/* ── FLOATING EXPANDABLE / COLLAPSIBLE SOLUTION CARD ── */}
            {liveSolution && (
              <div className="mx-3.5 z-20 transition-all duration-300">
                <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 overflow-hidden flex flex-col">
                  {/* Floating Header with Toggle */}
                  <div
                    onClick={() => setIsSolutionExpanded(!isSolutionExpanded)}
                    className="p-2.5 px-3.5 bg-ink text-white flex items-center justify-between cursor-pointer select-none"
                  >
                    <span className="text-xs font-black flex items-center gap-1.5 text-teal">
                      <span>✨</span> Solution Step-by-Step
                    </span>
                    <button type="button" className="text-xs font-bold text-white/80 hover:text-white">
                      {isSolutionExpanded ? "Collapse ▾" : "Expand ▴"}
                    </button>
                  </div>

                  {/* Expandable Body */}
                  {isSolutionExpanded && (
                    <div className="p-3 max-h-48 overflow-y-auto">
                      <FormattedSolution text={liveSolution} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Call Controls & Glowing AI Orb */}
            <div className="p-4 pb-6 flex flex-col items-center gap-3 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
              {/* Glowing Pulse Ring during Voice */}
              <div className="flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                  isSpeaking ? "bg-teal animate-ping scale-125" : isLiveListening ? "bg-rose-500 animate-pulse" : "bg-white/40"
                }`} />
                <span className="text-[11px] font-semibold text-white/90">
                  {loading
                    ? "Thinking & Solving…"
                    : isSpeaking
                    ? "AI is Speaking Solution (🔊)"
                    : isLiveListening
                    ? "Listening to your doubt…"
                    : "Tap mic & ask question from book"}
                </span>
              </div>

              {/* Tap to Speak in Live Call */}
              <button
                type="button"
                onClick={triggerLiveSpeechQuery}
                disabled={loading}
                className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-2xl transition-all active:scale-95 ${
                  isLiveListening
                    ? "bg-rose-600 text-white animate-pulse"
                    : "bg-gradient-to-r from-teal to-emerald-500 text-white"
                }`}
              >
                <span className="text-lg">🎙️</span>
                <span>{isLiveListening ? "Listening... Speak now!" : "Tap to Speak Doubt (Live Video)"}</span>
              </button>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* ── 2. NORMAL CHAT MODE HEADER ── */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <div className="p-3.5 border-b border-ink/8 flex items-center justify-between bg-paper/50 rounded-t-3xl">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-teal text-white flex items-center justify-center text-sm font-bold shadow-xs">
              ✨
            </span>
            <div>
              <h3 className="text-sm font-black text-ink">AI Doubt Faculty</h3>
              <p className="text-[10px] text-slate font-medium">
                {studentContext?.targetExam || "JEE/NEET"} 24x7 Mentor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              remainingQuota > 2 ? "bg-teal/10 border-teal/20 text-teal" : "bg-rose-50 border-rose-200 text-rose-600"
            }`}>
              {remainingQuota} / {DAILY_LIMIT} Doubts
            </span>

            <button
              type="button"
              onClick={() => {
                if (isSpeaking) stopSpeaking();
                setAudioMuted(!audioMuted);
              }}
              title={audioMuted ? "Unmute Voice" : "Mute Voice"}
              className={`p-1.5 rounded-lg border text-xs font-bold transition-all ${
                audioMuted ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-teal/15 text-teal border-teal/30"
              }`}
            >
              {audioMuted ? "🔇" : isSpeaking ? "🔊" : "🔈"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate hover:bg-ink/10"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── CHAT MESSAGES WITH BEAUTIFUL MATH FORMATTER ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                m.role === "user"
                  ? "bg-ink text-paper rounded-br-xs"
                  : "bg-paper/80 border border-ink/8 text-ink rounded-bl-xs shadow-xs"
              }`}>
                {m.image && (
                  <img src={m.image} alt="Question" className="max-h-48 rounded-lg mb-2 object-contain bg-black/5" />
                )}
                {m.isLiveSession && (
                  <span className="block text-[9.5px] font-bold text-teal mb-1">
                    🎥 Resolved during Live Call:
                  </span>
                )}
                {m.role === "assistant" ? (
                  <FormattedSolution text={m.content} />
                ) : (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate bg-paper/60 p-2.5 rounded-xl w-fit">
              <span className="animate-spin">⏳</span> Solving step-by-step…
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Image Preview if Gallery Chosen */}
        {selectedImage && (
          <div className="px-4 py-2 bg-paper/60 border-t border-ink/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={selectedImage} alt="Preview" className="w-10 h-10 object-cover rounded-lg" />
              <span className="text-[11px] font-bold text-ink">Photo attached</span>
            </div>
            <button type="button" onClick={() => setSelectedImage(null)} className="text-xs text-rose-500 font-bold hover:underline">
              Remove
            </button>
          </div>
        )}

        {/* ── INPUT BAR WITH START LIVE CALL & PURE VOICE ── */}
        <div className="p-3 border-t border-ink/10 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim() || selectedImage) {
                handleExecuteDoubt(selectedImage, input.trim());
                setInput("");
                setSelectedImage(null);
              }
            }}
            className="flex items-center gap-2"
          >
            {/* START TRUE LIVE VIDEO CALL */}
            <button
              type="button"
              onClick={() => startLiveCall()}
              className="px-2.5 py-2.5 rounded-xl bg-gradient-to-r from-teal to-emerald-500 text-white active:scale-95 transition-all text-xs font-black flex items-center gap-1 shrink-0 shadow-xs"
              title="Start Live Video Call"
            >
              <span>🎥</span>
              <span className="text-[11px]">Live Call</span>
            </button>

            {/* Gallery Upload */}
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl border border-ink/12 text-slate hover:text-ink active:scale-95 transition-all text-sm shrink-0"
              title="Attach Photo"
            >
              📷
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask doubt, formula or concept…"
              className="flex-1 text-xs font-semibold p-2.5 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
            />

            <button
              type="submit"
              disabled={loading || (!input.trim() && !selectedImage)}
              className="px-4 py-2.5 rounded-xl bg-teal text-white text-xs font-bold shadow-xs hover:bg-teal/90 disabled:opacity-40 transition-all shrink-0"
            >
              Send
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
