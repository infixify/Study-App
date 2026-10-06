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
  timestamp: string;
}

const STORAGE_KEY = "pw_doubt_chat_session_v2";

// Lightweight, custom inline SVGs (Zero package dependencies)
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

function SvgPaperclip({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4a3 3 0 014 0l4 4m-2-2l2-2a3 3 0 014 0l2 2m-16 4h18" />
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

// Colored Markdown Renderer without raw asterisks
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

        // Headings: **Heading** or ### Heading
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

        // Steps
        if (/^Step\s*\d+[:.-]/i.test(clean)) {
          return (
            <div key={idx} className="bg-teal-950/40 border-l-2 border-teal-400 px-3 py-1.5 rounded-r-lg my-1">
              <span className="font-medium text-emerald-300">
                {formatInline(clean)}
              </span>
            </div>
          );
        }

        // Formula / Notes
        if (/^(Formula|Important|Note|Sutra)[:.-]/i.test(clean)) {
          return (
            <div key={idx} className="bg-amber-950/30 border-l-2 border-amber-400 px-3 py-1.5 rounded-r-lg text-amber-200 my-1">
              {formatInline(clean)}
            </div>
          );
        }

        // Bullets
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
    ? `Namaste ${studentContext.studentName}! Aapke ${studentContext.targetExam || "exam"} ki taiyari ke liye main hazir hoon. Kisi bhi concept ya numerical ka sawal likhiye ya photo bhejiye.`
    : "Namaste! Main aapka PrepWise Academic Mentor hoon. Kisi bhi Physics, Chemistry, Maths ya Biology concept ka sawal likhiye ya photo upload kijiye.";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [doubtCount, setDoubtCount] = useState(1);
  const [sessionRestored, setSessionRestored] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Restore 24hr Session Memory
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
    } catch {
      // Session storage unavailable
    }

    setMessages([
      {
        id: "welcome",
        sender: "ai",
        text: defaultGreeting,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [defaultGreeting]);

  // Persist Messages (Images stripped to prevent quota overflow)
  useEffect(() => {
    if (messages.length > 0) {
      try {
        const lightweight = messages.slice(-15).map((m) => ({
          ...m,
          images: undefined, // Strip large base64
        }));
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
      } catch {
        // Storage quota safeguard
      }
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).slice(0, 2).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        if (base64) {
          setSelectedImages((prev) => [...prev, base64].slice(0, 2));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && selectedImages.length === 0) return;
    if (loading) return;

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
          text: "Server se connect nahi ho paya. Kripya connection check karein.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4">
      <div className="relative flex flex-col w-full max-w-2xl h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <SvgMagic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                AI Doubt Faculty
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {studentContext?.targetExam || "JEE / NEET"}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {studentContext?.daysToExam ? `${studentContext.daysToExam} Days Remaining` : "24x7 Academic Mentor"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {doubtCount} / 10 Doubts
            </span>
            <button
              onClick={handleClearHistory}
              title="Clear Chat History"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
            >
              <SvgTrash className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <SvgX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Restored Session Banner */}
        {sessionRestored && (
          <div className="bg-teal-950/40 border-b border-teal-800/40 px-4 py-1.5 flex items-center justify-between text-xs text-teal-300">
            <span>Pichli chat restore kar li gayi hai.</span>
            <button onClick={handleClearHistory} className="underline text-teal-400 hover:text-teal-200">
              Nayi Chat Shuru Karein
            </button>
          </div>
        )}

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
            >
              {msg.images && msg.images.length > 0 && (
                <div className="flex gap-2 mb-2">
                  {msg.images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt="Question Attachment"
                      className="w-28 h-28 object-cover rounded-xl border border-slate-700"
                    />
                  ))}
                </div>
              )}

              <div
                className={`max-w-[88%] p-3.5 rounded-2xl ${
                  msg.sender === "user"
                    ? "bg-teal-600 text-white rounded-br-none shadow-md"
                    : "bg-slate-950/70 border border-slate-800 text-slate-100 rounded-bl-none shadow-lg"
                }`}
              >
                {msg.sender === "user" ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <RenderFormattedMessage text={msg.text} />
                )}
              </div>

              {msg.provider && (
                <span className="text-[10px] text-slate-500 mt-1 px-1">
                  Solved via {msg.provider.toUpperCase()}
                </span>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-2xl w-fit">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse delay-150"></span>
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse delay-300"></span>
              <span className="text-xs text-teal-300 ml-1">AI Teacher step-by-step solution likh raha hai...</span>
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

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 p-3 bg-slate-950 border-t border-slate-800"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
            multiple
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl text-slate-400 hover:text-teal-400 hover:bg-slate-800/80 transition"
            title="Attach Image"
          >
            <SvgPaperclip className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Sawal, concept ya numerical likhein..."
            className="flex-1 bg-slate-900 border border-slate-700 focus:border-teal-500 focus:outline-none text-white text-sm px-4 py-2.5 rounded-xl transition placeholder:text-slate-500"
          />

          <button
            type="submit"
            disabled={loading || (!input.trim() && selectedImages.length === 0)}
            className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-medium transition shadow-md"
          >
            <SvgAirplane className="w-5 h-5" />
          </button>
        </form>

      </div>
    </div>
  );
}

export default AiChatSheet;
