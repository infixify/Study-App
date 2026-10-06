"use client";

import React, { useState, useRef, useEffect } from "react";

export interface AiChatSheetProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  studentContext?: any;
}

interface MessageItem {
  id: string;
  sender: "user" | "ai";
  text: string;
  images?: string[];
  provider?: string;
  timestamp: Date;
}

function CloseSvg({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SendSvg({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function SparklesSvg({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.286L13 21l-2.286-6.857L5 12l5.714-2.286L13 3z" />
    </svg>
  );
}

function ImageSvg({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function FormattedAnswer({ text }: { text: string }) {
  const lines = text.split("\n");

  const parseInline = (str: string) => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <span key={idx} className="font-bold text-teal-300 mx-0.5">
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
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;

        // Headings: **Heading** or ### Heading
        if (
          (trimmed.startsWith("**") && trimmed.endsWith("**") && trimmed.length < 60) ||
          trimmed.startsWith("### ") ||
          trimmed.startsWith("## ")
        ) {
          const title = trimmed.replace(/^###\s*|^##\s*|\*\*/g, "");
          return (
            <div key={idx} className="pt-2 pb-1 border-b border-teal-500/20">
              <h4 className="text-teal-400 font-bold text-base flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block"></span>
                {title}
              </h4>
            </div>
          );
        }

        // Steps
        if (/^Step\s*\d+[:.-]/i.test(trimmed)) {
          return (
            <div key={idx} className="bg-teal-950/40 border-l-2 border-teal-400 px-3 py-1.5 rounded-r-lg my-1">
              <span className="font-semibold text-emerald-300">
                {parseInline(trimmed)}
              </span>
            </div>
          );
        }

        // Formula / Notes
        if (/^(Formula|Important|Note|Sutra)[:.-]/i.test(trimmed)) {
          return (
            <div key={idx} className="bg-amber-950/30 border-l-2 border-amber-400 px-3 py-1.5 rounded-r-lg text-amber-200 my-1">
              {parseInline(trimmed)}
            </div>
          );
        }

        // Bullets
        if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
          const content = trimmed.replace(/^[-•*]\s*/, "");
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-teal-400 mt-1 font-bold text-xs">◆</span>
              <span className="text-slate-200 flex-1">{parseInline(content)}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-slate-200">
            {parseInline(line)}
          </p>
        );
      })}
    </div>
  );
}

export function AiChatSheet({ open, isOpen, onClose, studentContext }: AiChatSheetProps) {
  const visible = open !== undefined ? open : !!isOpen;

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "Namaste! Main aapka PrepWise Academic Mentor hoon. Kisi bhi Physics, Chemistry, Maths ya Biology concept ka sawal likhiye ya photo upload kijiye — step-by-step colored notes ke sath solution milega.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [doubtCount, setDoubtCount] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!visible) return null;

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

    const userMsg: MessageItem = {
      id: Date.now().toString(),
      sender: "user",
      text: input.trim(),
      images: selectedImages.length > 0 ? [...selectedImages] : undefined,
      timestamp: new Date(),
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
          timestamp: new Date(),
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
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
      <div className="relative flex flex-col w-full max-w-2xl h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <SparklesSvg className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                AI Doubt Faculty
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  24x7 Academic Mentor
                </span>
              </h3>
              <p className="text-xs text-slate-400">JEE, NEET & Boards Preparation</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {doubtCount} / 10 Doubts
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <CloseSvg className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Container */}
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
                      alt="Uploaded Doubt"
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
                  <FormattedAnswer text={msg.text} />
                )}
              </div>

              {msg.provider && (
                <span className="text-[10px] text-slate-500 mt-1 px-1">
                  Answered via {msg.provider.toUpperCase()}
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

        {/* Preview Selected Images */}
        {selectedImages.length > 0 && (
          <div className="flex gap-2 px-4 py-2 bg-slate-950 border-t border-slate-800">
            {selectedImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img}
                  alt="Preview"
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
            title="Attach Question Photo"
          >
            <ImageSvg className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Sawal, concept ya question likhein..."
            className="flex-1 bg-slate-900 border border-slate-700 focus:border-teal-500 focus:outline-none text-white text-sm px-4 py-2.5 rounded-xl transition placeholder:text-slate-500"
          />

          <button
            type="submit"
            disabled={loading || (!input.trim() && selectedImages.length === 0)}
            className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-medium transition shadow-md"
          >
            <SendSvg className="w-5 h-5" />
          </button>
        </form>

      </div>
    </div>
  );
}

// Support both Named and Default imports for complete compatibility
export default AiChatSheet;
