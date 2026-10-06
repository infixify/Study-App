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
  email?: string;
  name?: string;
  targetExam?: string;
  classLevel?: string;
  daysToExam?: number | null;
  examLabel?: string | null;
  weakSubjects?: string[];
  weaknesses?: string[];
  pendingBacklogCount?: number;
  dailyDoubtLimit?: number;
}

interface AiChatSheetProps {
  open: boolean;
  onClose: () => void;
  studentContext?: StudentContext;
}

const SESSION_KEY = "pw_doubt_chat_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function getTodayLimitKey(): string {
  const today = new Date().toISOString().split("T")[0];
  return `pw_doubt_daily_quota_${today}`;
}

// ─── 1. UNIVERSAL TEXTBOOK MATH NORMALIZER (Converts LaTeX to clean NCERT style) ───
function normalizeMathToTextbook(raw: string): string {
  if (!raw) return "";
  let s = raw;

  // 1. Remove LaTeX brackets & implies
  s = s.replace(/\\left\(/g, "(")
       .replace(/\\right\)/g, ")")
       .replace(/\\left\[/g, "[")
       .replace(/\\right\]/g, "]")
       .replace(/\\implies/g, " ⇒ ")
       .replace(/\\iff/g, " ⇔ ")
       .replace(/\\to/g, " → ");

  // 2. Fractions: \frac{a}{b} -> a/b
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)");

  // 3. Greek Letters to True Unicode
  s = s.replace(/\\mu/g, "μ")
       .replace(/\\phi/g, "Φ")
       .replace(/\\theta/g, "θ")
       .replace(/\\lambda/g, "λ")
       .replace(/\\alpha/g, "α")
       .replace(/\\beta/g, "β")
       .replace(/\\Delta/g, "Δ")
       .replace(/\\omega/g, "ω")
       .replace(/\\pi/g, "π")
       .replace(/\\sigma/g, "σ");

  // 4. Subscripts & Superscripts
  s = s.replace(/_\{1\}|_1/g, "₁")
       .replace(/_\{2\}|_2/g, "₂")
       .replace(/_\{3\}|_3/g, "₃")
       .replace(/_\{0\}|_0/g, "₀")
       .replace(/\^\{2\}|\^2/g, "²")
       .replace(/\^\{3\}|\^3/g, "³")
       .replace(/_\{([^}]+)\}/g, "_$1"); // \mu_{rel} -> μ_rel

  // 5. Operators & Vectors
  s = s.replace(/\\cdot/g, " • ")
       .replace(/\\times/g, " × ")
       .replace(/\\vec\{([^}]+)\}/g, "$1⃗")
       .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
       .replace(/\\approx/g, " ≈ ")
       .replace(/\\neq/g, " ≠ ")
       .replace(/\\pm/g, " ± ")
       .replace(/\\infty/g, " ∞ ")
       .replace(/\\degree/g, "°");

  // 6. Clean stray dollar signs and backslashes
  s = s.replace(/\$\$/g, "")
       .replace(/\$/g, "")
       .replace(/\\text\{([^}]+)\}/g, "$1")
       .replace(/\\/g, "");

  return s;
}

// ─── 2. SMART SPEECH FILTER (Removes emojis, code & speaks naturally) ───
function cleanTextForSpeech(raw: string): string {
  if (!raw) return "";
  let s = raw;

  // Remove emojis
  s = s.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");

  // Spoken math words
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

  s = s.replace(/\$\$/g, " ")
       .replace(/\$/g, " ")
       .replace(/[*_#`~=\-]/g, " ")
       .replace(/\\/g, " ")
       .replace(/\s+/g, " ")
       .trim();

  return s.slice(0, 450);
}

// ─── 3. TEXTBOOK VISUAL COMPONENT ───
function FormattedSolution({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-ink/90 font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Display Equation Card Block
        if (
          trimmed.startsWith("$$") ||
          trimmed.includes("\\frac") ||
          (trimmed.includes("=") && trimmed.includes("\\"))
        ) {
          const cleanEq = normalizeMathToTextbook(trimmed);
          return (
            <div
              key={idx}
              className="my-2 p-2.5 bg-teal/5 border border-teal/20 rounded-xl text-center font-mono font-bold text-teal text-[13px] tracking-wide overflow-x-auto shadow-xs"
            >
              {cleanEq}
            </div>
          );
        }

        // Section Headings ###
        if (trimmed.startsWith("###")) {
          return (
            <h4
              key={idx}
              className="font-black text-ink text-[12.5px] mt-2.5 mb-1 border-b border-ink/8 pb-0.5"
            >
              {normalizeMathToTextbook(trimmed.replace(/^###\s*/, ""))}
            </h4>
          );
        }

        // Normal Line with clean math symbols
        const cleanLine = normalizeMathToTextbook(trimmed);

        return (
          <p
            key={idx}
            className={
              trimmed.startsWith("**") || trimmed.startsWith("* **")
                ? "font-bold text-ink"
                : "text-ink/85"
            }
          >
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

  // VIP Dynamic Quota (sarthaksinghyadav1@gmail.com gets 999 doubts)
  const isOwner = studentContext?.email === "sarthaksinghyadav1@gmail.com";
  const dailyLimit = isOwner ? 999 : (studentContext?.dailyDoubtLimit || 10);
  const [remainingQuota, setRemainingQuota] = useState(dailyLimit);

  // Audio Speech state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const keepAliveTimerRef = useRef<any>(null);

  // ── TRUE CONTINUOUS LIVE VIDEO CALL STATE ──
  const [liveCallOpen, setLiveCallOpen] = useState(false);
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [liveSolution, setLiveSolution] = useState<string | null>(null);
  const [isSolutionExpanded, setIsSolutionExpanded] = useState(true);
  const [liveSessionItems, setLiveSessionItems] = useState<{ query: string; reply: string }[]>([]);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const getRemainingQuotaVal = useCallback((): number => {
    try {
      const raw = localStorage.getItem(getTodayLimitKey());
      if (raw !== null) {
        const used = parseInt(raw) || 0;
        return Math.max(0, dailyLimit - used);
      }
    } catch (_) {}
    return dailyLimit;
  }, [dailyLimit]);

  const decrementQuotaVal = useCallback((): number => {
    try {
      const current = getRemainingQuotaVal();
      const used = dailyLimit - current + 1;
      localStorage.setItem(getTodayLimitKey(), used.toString());
      return Math.max(0, dailyLimit - used);
    } catch (_) {
      return dailyLimit - 1;
    }
  }, [dailyLimit, getRemainingQuotaVal]);

  useEffect(() => {
    if (!open) {
      stopLiveCall();
      stopSpeaking();
      return;
    }
    setRemainingQuota(getRemainingQuotaVal());

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

    setMessages([
      {
        role: "assistant",
        content: `Namaste ${name}! Main aapka AI Doubt Faculty hoon. Koi bhi sawaal bol kar puchein, photo attach karein ya **Live Call (🎥)** se direct uninterrupted video call karein! ✍️`,
      },
    ]);
  }, [open, getRemainingQuotaVal]);

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

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // ─── 4. NATURAL HD VOICE ENGINE (Anti-Freeze 15-second heartbeat) ───
  const speakNaturalVoice = useCallback(
    (text: string) => {
      if (audioMuted || typeof window === "undefined" || !("speechSynthesis" in window)) return;

      try {
        window.speechSynthesis.cancel();
        if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);

        const cleanSpokenText = cleanTextForSpeech(text);
        if (!cleanSpokenText) return;

        const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const hdVoice =
          voices.find(
            (v) =>
              v.name.includes("Google") &&
              (v.lang.includes("en-IN") || v.lang.includes("hi-IN") || v.lang.includes("hi_IN"))
          ) ||
          voices.find((v) => v.lang.includes("en-IN") || v.lang.includes("hi-IN"));

        if (hdVoice) {
          utterance.voice = hdVoice;
          utterance.lang = hdVoice.lang;
        } else {
          utterance.lang = "en-IN";
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
          keepAliveTimerRef.current = setInterval(() => {
            if (window.speechSynthesis.speaking) {
              window.speechSynthesis.pause();
              window.speechSynthesis.resume();
            } else {
              clearInterval(keepAliveTimerRef.current);
            }
          }, 8000);
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
        };

        utterance.onerror = () => {
          setIsSpeaking(false);
          if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
        };

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
    if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
    setIsSpeaking(false);
  };

  // ─── 5. TRUE CONTINUOUS LIVE VIDEO CALL CONTROLS ───
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

  const stopLiveCall = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    stopSpeaking();

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
    const updatedQuota = decrementQuotaVal();
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
        const speakText = data.spoken || replyText;
        setLiveSolution(replyText);
        setIsSolutionExpanded(true);
        setLiveSessionItems((prev) => [...prev, { query: promptText, reply: replyText }]);
        speakNaturalVoice(speakText);
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
          content: `⚠️ Aaj ke **${dailyLimit} free doubts** khatam ho chuke hain! Raat 12 baje reset ho jayega.`,
        },
      ]);
      return;
    }

    const userMsg: Message = { role: "user", content: promptText, image: imgData || undefined };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    const updatedQuota = decrementQuotaVal();
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
        const speakText = data.spoken || replyText;
        setMessages((prev) => [...prev, { role: "assistant", content: replyText }]);
        speakNaturalVoice(speakText);
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

        {/* ── 1. TRUE FULLSCREEN CONTINUOUS LIVE VIDEO CALL OVERLAY ── */}
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

            {/* Continuous Video Feed */}
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

            {/* Floating Expandable Solution Card */}
            {liveSolution && (
              <div className="mx-3.5 z-20 transition-all duration-300">
                <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 overflow-hidden flex flex-col">
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

                  {isSolutionExpanded && (
                    <div className="p-3 max-h-48 overflow-y-auto">
                      <FormattedSolution text={liveSolution} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Call Controls & Glowing Orb */}
            <div className="p-4 pb-6 flex flex-col items-center gap-3 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                    isSpeaking
                      ? "bg-teal animate-ping scale-125"
                      : isLiveListening
                      ? "bg-rose-500 animate-pulse"
                      : "bg-white/40"
                  }`}
                />
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
                <span>
                  {isLiveListening ? "Listening... Speak now!" : "Tap to Speak Doubt (Live Video)"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── 2. NORMAL CHAT HEADER ── */}
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
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                remainingQuota > 2
                  ? "bg-teal/10 border-teal/20 text-teal"
                  : "bg-rose-50 border-rose-200 text-rose-600"
              }`}
            >
              {remainingQuota} / {dailyLimit} Doubts
            </span>

            <button
              type="button"
              onClick={() => {
                if (isSpeaking) stopSpeaking();
                setAudioMuted(!audioMuted);
              }}
              title={audioMuted ? "Unmute Voice" : "Mute Voice"}
              className={`p-1.5 rounded-lg border text-xs font-bold transition-all ${
                audioMuted
                  ? "bg-slate-100 text-slate-400 border-slate-200"
                  : "bg-teal/15 text-teal border-teal/30"
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

        {/* ── CHAT MESSAGES WITH TEXTBOOK MATH ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-ink text-paper rounded-br-xs"
                    : "bg-paper/80 border border-ink/8 text-ink rounded-bl-xs shadow-xs"
                }`}
              >
                {m.image && (
                  <img
                    src={m.image}
                    alt="Question"
                    className="max-h-48 rounded-lg mb-2 object-contain bg-black/5"
                  />
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
              <img
                src={selectedImage}
                alt="Preview"
                className="w-10 h-10 object-cover rounded-lg"
              />
              <span className="text-[11px] font-bold text-ink">Photo attached</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="text-xs text-rose-500 font-bold hover:underline"
            >
              Remove
            </button>
          </div>
        )}

        {/* ── INPUT BAR WITH START LIVE CALL ── */}
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
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageSelect}
              className="hidden"
            />
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
