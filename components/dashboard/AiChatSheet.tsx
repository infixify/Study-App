"use client";

import React, { useState, useRef, useEffect } from "react";

export interface StudentContextData {
  studentName?: string;
  targetExam?: string;
  daysToExam?: number;
  weakSubjects?: string[];
  diagnosticSummary?: string;
}

export interface AiChatSheetProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  studentContext?: StudentContextData;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  images?: string[];
  provider?: string;
  model?: string;
  debugTrace?: string[];
  timestamp: string;
}

const STORAGE_KEY = "pw_doubt_chat_session_v3";

// ─── SVG ICONS ───
function SvgX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SvgAirplane({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function SvgMagic({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 3v3m0 12v3M3 12h3m12 0h3m-3.5-6.5l-2 2m-7 7l-2 2m0-11l2 2m7 7l2 2" />
    </svg>
  );
}

function SvgCamera({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SvgGallery({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function SvgMic({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}

function SvgTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

// ─── CLIENT-SIDE CANVAS IMAGE COMPRESSOR (1080px JPEG 0.75) ───
function compressImage(file: File, maxWidth = 1080, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

// ─── PURE REACT RICH TEXT FORMATTER ───
function RenderFormattedMessage({ text }: { text: string }) {
  const lines = text.split("\n");

  const formatInline = (str: string) => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <span key={index} className="font-semibold text-teal-300 mx-0.5">
            {part.slice(2, -2)}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-100">
      {lines.map((line, idx) => {
        const clean = line.trim();
        if (!clean) return <div key={idx} className="h-1.5" />;

        if (
          (clean.startsWith("**") && clean.endsWith("**") && clean.length < 65) ||
          clean.startsWith("### ") ||
          clean.startsWith("## ")
        ) {
          const title = clean.replace(/^###\s*|^##\s*|\*\*/g, "");
          return (
            <div key={idx} className="pt-2 pb-1 border-b border-teal-500/20">
              <h4 className="text-teal-400 font-bold text-base flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block"></span>
                {title}
              </h4>
            </div>
          );
        }

        if (/^Step\s*\d+[:.-]/i.test(clean)) {
          return (
            <div key={idx} className="bg-teal-950/40 border-l-2 border-teal-400 px-3 py-1.5 rounded-r-lg my-1">
              <span className="font-medium text-emerald-300">
                {formatInline(clean)}
              </span>
            </div>
          );
        }

        if (/^(Formula|Important|Note|Sutra)[:.-]/i.test(clean)) {
          return (
            <div key={idx} className="bg-amber-950/30 border-l-2 border-amber-400 px-3 py-1.5 rounded-r-lg text-amber-200 my-1">
              {formatInline(clean)}
            </div>
          );
        }

        if (clean.startsWith("- ") || clean.startsWith("• ") || clean.startsWith("* ")) {
          const bullet = clean.replace(/^[-•*]\s*/, "");
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-teal-400 mt-1 font-bold text-xs">◆</span>
              <span className="text-slate-200 flex-1">{formatInline(bullet)}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-slate-200">
            {formatInline(line)}
          </p>
        );
      })}
    </div>
  );
}

export function AiChatSheet({ open, isOpen, onClose, studentContext }: AiChatSheetProps) {
  const visible = open !== undefined ? open : !!isOpen;

  const defaultGreeting = studentContext?.studentName
    ? `Namaste ${studentContext.studentName}! Aapke ${studentContext.targetExam || "exam"} ki taiyari ke liye main hazir hoon. Kisi bhi concept ka sawal likhiye ya photo bhejiye.`
    : "Namaste! Main aapka PrepWise Academic Mentor hoon. Kisi bhi Physics, Chemistry, Maths ya Biology question ka text likhiye ya photo upload kijiye.";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [doubtCount, setDoubtCount] = useState(1);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setSessionRestored(true);
          return;
        }
      }
    } catch {}

    setMessages([
      {
        id: "welcome",
        sender: "ai",
        text: defaultGreeting,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [defaultGreeting]);

  useEffect(() => {
    if (messages.length > 0) {
      try {
        const lightweight = messages.slice(-15).map((m) => ({
          ...m,
          images: undefined,
        }));
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
      } catch {}
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  if (!visible) return null;

  const handleClearHistory = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    setSessionRestored(false);
    setMessages([
      {
        id: "welcome_new",
        sender: "ai",
        text: defaultGreeting,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  // Image Selection with Canvas Downscale Compression
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files).slice(0, 2);
    for (const file of fileList) {
      try {
        const compressedBase64 = await compressImage(file, 1080, 0.75);
        if (compressedBase64) {
          setSelectedImages((prev) => [...prev, compressedBase64].slice(0, 2));
        }
      } catch (_) {}
    }
    e.target.value = "";
  };

  // Toggle Voice-to-Text Microphone
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Aapke browser mein Speech-to-Text supported nahi hai. Kripya type karein.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN"; // English & Indian Hinglish speech support
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}`.trim() : transcript));
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (_) {
      setIsListening(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && selectedImages.length === 0) return;
    if (loading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: input.trim(),
      images: selectedImages.length > 0 ? [...selectedImages] : undefined,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const sentImages = [...selectedImages];
    setSelectedImages([]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-doubt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.text,
          images: sentImages,
          studentContext,
        }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: data.reply || "Takneeki dikkat aayi, kripya dobara puchiye.",
          provider: data.provider,
          model: data.model,
          debugTrace: data.debugTrace,
          timestamp: new Date().toISOString(),
        },
      ]);
      setDoubtCount((c) => Math.min(10, c + 1));
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: "Server se connect nahi ho paya. Kripya internet connection check karein.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4">
      <div className="flex flex-col w-full max-w-xl h-[92vh] sm:h-[86vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shadow-md">
              <SvgMagic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">PrepWise AI Mentor</h3>
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/30">
                  {studentContext?.targetExam || "JEE/NEET"} 24×7
                </span>
              </div>
              <p className="text-xs text-slate-400">NCERT · Formulas · Fast Step-by-Step Solutions</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {messages.length > 1 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                title="Clear Chat History"
              >
                <SvgTrash className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close"
            >
              <SvgX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Student Context Diagnostic Pill */}
        {studentContext && (
          <div className="px-4 py-1.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-teal-400 font-semibold">🎯 {studentContext.targetExam || "Target Exam"}</span>
              {studentContext.daysToExam !== undefined && (
                <span className="text-slate-500">· {studentContext.daysToExam} days left</span>
              )}
            </div>
            {studentContext.weakSubjects && studentContext.weakSubjects.length > 0 && (
              <div className="text-[10px] text-amber-400/90 font-medium truncate ml-2">
                Priority: {studentContext.weakSubjects.join(", ")}
              </div>
            )}
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {sessionRestored && (
            <div className="text-center my-1">
              <span className="text-[10px] bg-slate-800/80 text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-700/60">
                ↺ Continuing previous session
              </span>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-3.5 shadow-sm ${
                  msg.sender === "user"
                    ? "bg-teal-600 text-white rounded-br-xs"
                    : "bg-slate-800/90 border border-slate-700/60 text-slate-100 rounded-bl-xs"
                }`}
              >
                {/* Images in User Bubble */}
                {msg.images && msg.images.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {msg.images.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt="Question attachment"
                        className="w-28 h-28 object-cover rounded-xl border border-white/20"
                      />
                    ))}
                  </div>
                )}

                {msg.sender === "ai" ? (
                  <RenderFormattedMessage text={msg.text} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                )}
              </div>

              {/* AI Metadata Footer */}
              {msg.sender === "ai" && (msg.provider || msg.model) && (
                <div className="flex items-center gap-2 mt-1 px-1 text-[9.5px] text-slate-500 font-mono">
                  <span>⚡ {msg.provider || "AI Engine"}</span>
                  {msg.model && <span>· {msg.model}</span>}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-2 px-3 bg-slate-800/40 rounded-2xl w-fit border border-slate-700/40">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              <span>NCERT concept analyze kar rahe hain...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Selected Images Preview */}
        {selectedImages.length > 0 && (
          <div className="flex gap-2 px-4 py-2 bg-slate-950 border-t border-slate-800">
            {selectedImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img}
                  alt="Thumbnail"
                  className="w-16 h-16 object-cover rounded-lg border border-teal-500/40"
                />
                <button
                  type="button"
                  onClick={() => setSelectedImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Bar with Camera, Gallery & Mic */}
        <form
          onSubmit={handleSend}
          className="flex items-center gap-1.5 sm:gap-2 p-3 bg-slate-950 border-t border-slate-800"
        >
          {/* Hidden Direct Camera Capture Input */}
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          {/* Hidden Gallery / File Picker Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
            multiple
          />

          {/* 1. Camera Button (Left) */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="p-2.5 rounded-xl text-slate-400 hover:text-teal-400 hover:bg-slate-800/80 transition"
            title="Snap Photo with Camera"
          >
            <SvgCamera className="w-5 h-5" />
          </button>

          {/* 2. Gallery Button (Center) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl text-slate-400 hover:text-teal-400 hover:bg-slate-800/80 transition"
            title="Choose from Gallery"
          >
            <SvgGallery className="w-5 h-5" />
          </button>

          {/* 3. Mic Voice-to-Text Button (Right of Gallery) */}
          <button
            type="button"
            onClick={toggleListening}
            className={`p-2.5 rounded-xl transition ${
              isListening
                ? "text-rose-400 bg-rose-500/20 ring-2 ring-rose-500 animate-pulse"
                : "text-slate-400 hover:text-teal-400 hover:bg-slate-800/80"
            }`}
            title={isListening ? "Listening... (Tap to stop)" : "Speech to Text (Mic)"}
          >
            <SvgMic className="w-5 h-5" />
          </button>

          {/* 4. Text Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Bolte rahiye, text yahan aayega..." : "Sawal likhein ya photo lein..."}
            className="flex-1 bg-slate-900 border border-slate-700 focus:border-teal-500 focus:outline-none text-white text-sm px-3.5 py-2.5 rounded-xl transition placeholder:text-slate-500"
          />

          {/* 5. Submit Button */}
          <button
            type="submit"
            disabled={loading || (!input.trim() && selectedImages.length === 0)}
            className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-medium transition shadow-md shrink-0"
          >
            <SvgAirplane className="w-5 h-5" />
          </button>
        </form>

      </div>
    </div>
  );
}

export default AiChatSheet;
