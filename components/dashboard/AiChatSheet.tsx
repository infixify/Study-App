// components/dashboard/AiChatSheet.tsx
"use client";

import React, { useState, useRef, useEffect, ChangeEvent } from "react";

function IconClose({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconSend({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function IconCamera({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconImage({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconSparkles({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function IconSpinner({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  timestamp: string;
}

interface AiChatSheetProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  userEmail?: string;
  studentContext?: any;
}

// Client-side canvas compression: 10MB photo -> 120KB JPEG
async function compressImage(file: File, maxWidth = 1280, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Image failed to load"));
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function formatTextbookNotes(text: string): string {
  if (!text) return "";
  let clean = text;

  clean = clean.replace(/```(?:markdown|latex|text)?\n([\s\S]*?)\n```/g, "$1");

  clean = clean
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)")
    .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±")
    .replace(/\\approx/g, "≈")
    .replace(/\\neq/g, "≠")
    .replace(/\\le/g, "≤")
    .replace(/\\ge/g, "≥")
    .replace(/\\to/g, "→")
    .replace(/\\implies/g, "⇒")
    .replace(/\\theta/g, "θ")
    .replace(/\\pi/g, "π")
    .replace(/\\alpha/g, "α")
    .replace(/\\beta/g, "β")
    .replace(/\\lambda/g, "λ")
    .replace(/\\mu/g, "μ")
    .replace(/\\omega/g, "ω")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\circ/g, "°");

  // Powers
  clean = clean
    .replace(/\^2\b/g, "²")
    .replace(/\^3\b/g, "³")
    .replace(/\^0\b/g, "⁰")
    .replace(/\^1\b/g, "¹")
    .replace(/\^4\b/g, "⁴")
    .replace(/\^5\b/g, "⁵")
    .replace(/\^-1\b/g, "⁻¹")
    .replace(/\^-2\b/g, "⁻²");

  // Subscripts
  clean = clean
    .replace(/_0\b/g, "₀")
    .replace(/_1\b/g, "₁")
    .replace(/_2\b/g, "₂")
    .replace(/_3\b/g, "₃")
    .replace(/_f\b/g, "ᶠ")
    .replace(/_i\b/g, "ⁱ");

  clean = clean.replace(/\$\$?/g, "");

  return clean;
}

export default function AiChatSheet({
  open,
  isOpen,
  onClose,
  userEmail,
  studentContext,
}: AiChatSheetProps) {
  const isSheetOpen = open ?? isOpen ?? false;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "Namaste! Main aapka PrepWise Academic Faculty hoon. Kisi bhi Physics, Chemistry, Maths ya Biology sawal ka text likhiye ya photo upload kijiye — main step-by-step solution deta hoon.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);

  const isOwner = userEmail === "sarthaksinghyadav1@gmail.com";
  const dailyLimit = isOwner ? 999 : 10;
  const [usedDoubts, setUsedDoubts] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSheetOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isSheetOpen]);

  if (!isSheetOpen) return null;

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (selectedImages.length >= 2) {
      alert("Aap ek baar mein maximum 2 photos attach kar sakte hain.");
      return;
    }

    setCompressing(true);
    try {
      const remainingSlots = 2 - selectedImages.length;
      const filesToProcess = Array.from(files).slice(0, remainingSlots);

      const compressedList: string[] = [];
      for (const f of filesToProcess) {
        const compressed = await compressImage(f, 1280, 0.75);
        compressedList.push(compressed);
      }
      setSelectedImages((prev) => [...prev, ...compressedList]);
    } catch (err) {
      console.error("Compression error:", err);
    } finally {
      setCompressing(false);
      if (e.target) e.target.value = "";
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text && selectedImages.length === 0) return;
    if (loading || compressing) return;

    if (usedDoubts >= dailyLimit) {
      alert(`Aapka daily quota (${dailyLimit} doubts) poora ho chuka hai.`);
      return;
    }

    const userMsg: Message = {
      id: "u-" + Date.now(),
      role: "user",
      content: text || "Please explain this question photo",
      images: selectedImages.length > 0 ? [...selectedImages] : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const imagesToSend = [...selectedImages];
    setSelectedImages([]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-doubt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          prompt: text,
          question: text,
          doubt: text,
          query: text,
          text: text,
          images: imagesToSend,
          image: imagesToSend[0] || "",
          mode: "chat",
          studentContext,
        }),
      });

      const data = await res.json();
      const replyText = data?.reply || "Sawal samajhne mein dikkat aayi. Kripya dobara puchiye.";

      const aiMsg: Message = {
        id: "ai-" + Date.now(),
        role: "assistant",
        content: formatTextbookNotes(replyText),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setUsedDoubts((prev) => prev + 1);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          role: "assistant",
          content: "Network issue. Kripya apna internet connection check karke dobara try karein.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="relative w-full max-w-2xl h-[92vh] sm:h-[85vh] bg-[#0f172a] text-slate-100 rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl border border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="px-4 py-3 bg-[#1e293b] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
              <IconSparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide">AI Doubt Faculty</h2>
              <p className="text-[11px] text-slate-400">JEE & NEET 24x7 Academic Mentor</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 text-teal-300 font-medium border border-slate-700">
              {usedDoubts} / {dailyLimit} Doubts
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <IconClose className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-teal-600 text-white rounded-tr-xs"
                    : "bg-[#1e293b] text-slate-200 border border-slate-700/80 rounded-tl-xs shadow-md font-sans"
                }`}
              >
                {/* User Images */}
                {m.images && m.images.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {m.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt="Question"
                        className="max-h-48 max-w-full rounded-lg object-contain border border-slate-700 bg-black/40"
                      />
                    ))}
                  </div>
                )}

                {/* Message Body with Textbook Layout */}
                <div className="whitespace-pre-wrap font-normal selection:bg-teal-500 selection:text-white">
                  {m.content}
                </div>
              </div>

              <span className="text-[10px] text-slate-500 mt-1 px-1">
                {m.timestamp}
              </span>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2">
              <div className="bg-[#1e293b] border border-slate-700 rounded-2xl rounded-tl-xs p-3 text-xs text-slate-400 flex items-center gap-2">
                <IconSpinner className="w-3.5 h-3.5 text-teal-400" />
                <span>Faculty solution calculate kar rahe hain...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Selected Images Preview Bar */}
        {selectedImages.length > 0 && (
          <div className="px-4 py-2 bg-[#1e293b]/80 border-t border-slate-800 flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Attached ({selectedImages.length}/2):</span>
            {selectedImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img}
                  alt="Thumbnail"
                  className="w-12 h-12 object-cover rounded-md border border-teal-500/50"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-0.5 shadow-md"
                >
                  <IconClose className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 bg-[#1e293b] border-t border-slate-800">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageSelect}
            />

            {/* Camera Button */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={selectedImages.length >= 2 || compressing}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-40"
              title="Camera Se Photo Lein"
            >
              <IconCamera className="w-4 h-4" />
            </button>

            {/* Gallery Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={selectedImages.length >= 2 || compressing}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-40"
              title="Gallery Se Photo Chunein"
            >
              <IconImage className="w-4 h-4" />
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                compressing
                  ? "Photo compress ho rahi hai..."
                  : "Sawal, concept ya question likhein..."
              }
              disabled={loading || compressing}
              className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:border-teal-500 transition-colors"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={loading || compressing || (!input.trim() && selectedImages.length === 0)}
              className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium transition-colors disabled:opacity-40 disabled:hover:bg-teal-600"
            >
              <IconSend className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
