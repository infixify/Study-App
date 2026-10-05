// components/dashboard/AiChatSheet.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "assistant" | "user";
  content: string;
  image?: string;
  isVoiceSpoken?: boolean;
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
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
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

export default function AiChatSheet({ open, onClose, studentContext }: AiChatSheetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [remainingQuota, setRemainingQuota] = useState(DAILY_LIMIT);

  // Audio Speech state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);

  // Live Camera Scan state (Tarika B)
  const [liveCamOpen, setLiveCamOpen] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      stopCamera();
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
    const days = studentContext?.daysToExam;
    const weak = studentContext?.weakSubjects?.join(", ");

    let welcome = `Namaste ${name}! Main aapka AI Doubt Faculty hoon. `;
    if (days && days > 0) welcome += `${exam} mein sirf **${days} din** bache hain — `;
    if (weak) welcome += `${weak} pe focus bana ke rakho. `;
    welcome += `Koi bhi sawaal type karein, photo attach karein ya **Live Cam & Speak (🎥)** se direct book dikha kar puchein! ✍️`;

    setMessages([{ role: "assistant", content: welcome }]);
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

  // ─── TEXT-TO-SPEECH (AI BOLEGA BHI) ───
  const speakSolution = useCallback((text: string) => {
    if (audioMuted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      // Strip markdown symbols for clean natural audio speaking
      const cleanText = text
        .replace(/[*_#`~]/g, "")
        .replace(/⚡/g, "Exam Shortcut: ")
        .slice(0, 450); // Speaks the most essential solution part smoothly

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.lang = "en-IN"; // Natural Indian English / Hinglish voice

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch (_) {
      setIsSpeaking(false);
    }
  }, [audioMuted]);

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // ─── LIVE CAMERA & TARIKA B (SPEAK & AUTO-SNAP) ───
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setLiveCamOpen(true);
    } catch (e) {
      alert("Camera permission access nahi mili. Kripya camera allow karein.");
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setLiveCamOpen(false);
    setIsRecordingVoice(false);
  };

  const captureFrameFromVideo = (): string | null => {
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

  // TARIKA B: Start voice recording, snap frame immediately when voice finishes
  const startVoiceCaptureAndSnap = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Fallback: direct snapshot if speech recognition not on browser
      const snap = captureFrameFromVideo();
      if (snap) {
        stopCamera();
        handleExecuteDoubt(snap, "Solve this question step-by-step.");
      }
      return;
    }

    setSpeechTranscript("");
    setIsRecordingVoice(true);

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const spoken = event.results[0][0]?.transcript || "";
        setSpeechTranscript(spoken);
        const snap = captureFrameFromVideo();
        stopCamera();
        handleExecuteDoubt(snap, spoken || "Explain this question step-by-step.");
      };

      recognition.onerror = () => {
        setIsRecordingVoice(false);
        const snap = captureFrameFromVideo();
        stopCamera();
        handleExecuteDoubt(snap, "Explain this question step-by-step.");
      };

      recognition.onend = () => {
        setIsRecordingVoice(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (_) {
      setIsRecordingVoice(false);
      const snap = captureFrameFromVideo();
      stopCamera();
      handleExecuteDoubt(snap, "Explain this question step-by-step.");
    }
  };

  const stopVoiceCaptureNow = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
  };

  const handleExecuteDoubt = async (imgData: string | null, promptText: string) => {
    if (remainingQuota <= 0) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Aaj ke **${DAILY_LIMIT} free doubts** khatam ho chuke hain! Yeh quota raat 12:00 baje automatically 10 par reset ho jayega. Tab tak pichle notes aur tests revise karein! 📚`,
        },
      ]);
      return;
    }

    const userMsg: Message = {
      role: "user",
      content: promptText,
      image: imgData || undefined,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);
    const updatedQuota = decrementQuota();
    setRemainingQuota(updatedQuota);

    try {
      const res = await fetch("/api/ai-doubt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          query: promptText,
          image: imgData,
          targetExam: studentContext?.targetExam || "JEE",
          studentContext,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const replyText = data.reply || "Solution complete.";
        setMessages((prev) => [...prev, { role: "assistant", content: replyText }]);
        speakSolution(replyText); // 🔊 AI Speaks out loud!
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sawal samajhne mein thodi dikkat aayi. Kripya dubara photo lein ya sawal type karein!" },
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

        {/* ── LIVE CAMERA SCANNER OVERLAY (TARIKA B) ── */}
        {liveCamOpen && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col justify-between p-4 animate-in fade-in">
            {/* Top controls */}
            <div className="flex items-center justify-between text-white z-10">
              <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full backdrop-blur-md">
                🎥 Live Point & Speak
              </span>
              <button
                type="button"
                onClick={stopCamera}
                className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Video Viewfinder */}
            <div className="relative flex-1 flex items-center justify-center my-2 overflow-hidden rounded-2xl border border-white/20">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Question Focus Frame */}
              <div className="absolute inset-6 border-2 border-teal rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                <span className="text-[10px] font-bold text-teal bg-black/60 px-2 py-0.5 rounded-md w-fit">
                  Align Question inside box
                </span>
                <span className="text-[10px] font-semibold text-white/80 bg-black/60 px-2 py-0.5 rounded-md self-center text-center">
                  {isRecordingVoice ? "🎙️ Sun raha hoon... bolo!" : "Neeche mic daba kar sawal pucho"}
                </span>
              </div>
            </div>

            {/* Bottom: TARIKA B Big Speak & Snap Button */}
            <div className="flex flex-col items-center gap-2 pb-2 z-10">
              {isRecordingVoice ? (
                <button
                  type="button"
                  onClick={stopVoiceCaptureNow}
                  className="w-full py-3.5 bg-rose-600 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg animate-pulse"
                >
                  <span>⏹</span> Click to Snap Now!
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startVoiceCaptureAndSnap}
                  className="w-full py-3.5 bg-gradient-to-r from-teal to-emerald-500 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <span className="text-lg">🎙️</span> Hold/Tap to Speak & Auto-Snap
                </button>
              )}
              <p className="text-[10.5px] text-white/70">
                Bolte hi camera automatic us second ki photo lekar AI ko bhej dega!
              </p>
            </div>
          </div>
        )}

        {/* ── REGULAR CHAT HEADER ── */}
        <div className="p-3.5 border-b border-ink/8 flex items-center justify-between bg-paper/50 rounded-t-3xl">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-teal text-white flex items-center justify-center text-sm font-bold shadow-xs">
              ✨
            </span>
            <div>
              <h3 className="text-sm font-black text-ink">AI Doubt Solver</h3>
              <p className="text-[10px] text-slate font-medium">
                {studentContext?.targetExam || "JEE/NEET"} Mentor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Daily Quota Badge */}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              remainingQuota > 2
                ? "bg-teal/10 border-teal/20 text-teal"
                : "bg-rose-50 border-rose-200 text-rose-600"
            }`}>
              {remainingQuota} / {DAILY_LIMIT} Doubts
            </span>

            {/* Mute/Unmute Speech Toggle */}
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

        {/* ── CHAT MESSAGES ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-ink text-paper rounded-br-xs"
                  : "bg-paper/80 border border-ink/8 text-ink rounded-bl-xs"
              }`}>
                {m.image && (
                  <img src={m.image} alt="Question" className="max-h-48 rounded-lg mb-2 object-contain bg-black/5" />
                )}
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate bg-paper/60 p-2.5 rounded-xl w-fit">
              <span className="animate-spin">⏳</span> Solving & preparing audio voice explanation…
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Image Preview if chosen from Gallery */}
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

        {/* ── INPUT BAR WITH LIVE SCAN BUTTON ── */}
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
            {/* Live Camera Scanner Trigger */}
            <button
              type="button"
              onClick={startCamera}
              className="p-2.5 rounded-xl bg-teal/10 hover:bg-teal/20 border border-teal/25 text-teal active:scale-95 transition-all text-xs font-bold flex items-center gap-1 shrink-0"
              title="Open Live Camera & Speak"
            >
              <span>🎥</span>
              <span className="text-[10px] hidden sm:inline">Live</span>
            </button>

            {/* Gallery Upload */}
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl border border-ink/12 text-slate hover:text-ink active:scale-95 transition-all text-sm shrink-0"
              title="Choose from Gallery"
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
