"use client";

import React, { useState, useRef, useEffect } from "react";

interface Message {
  role: "assistant" | "user";
  content: string;
  image?: string;
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

function buildWelcomeMessage(ctx?: StudentContext): string {
  const name = ctx?.name || "Champion";
  const exam = ctx?.targetExam || "JEE/NEET";
  const days = ctx?.daysToExam;
  const weak = ctx?.weakSubjects?.join(", ");

  let msg = `Namaste ${name}! Main aapka AI Doubt Solver hoon. `;

  if (days && days > 0) {
    msg += `${exam} mein sirf **${days} din** bacha hai — `;
  }

  if (weak) {
    msg += `${weak} pe focus karo aaj. `;
  }

  msg += `Koi bhi question, formula ya concept mein doubt ho toh type karein ya direct photo upload karein! ✍️`;
  return msg;
}

export default function AiChatSheet({ open, onClose, studentContext }: AiChatSheetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Reset messages with personalized welcome when sheet opens
  useEffect(() => {
    if (open) {
      setMessages([
        {
          role: "assistant",
          content: buildWelcomeMessage(studentContext),
        },
      ]);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  if (!open) return null;

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
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, w, h);
        setSelectedImage(canvas.toDataURL("image/jpeg", 0.75));
      };
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || loading) return;

    const userMsg: Message = {
      role: "user",
      content: input.trim(),
      image: selectedImage || undefined,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setSelectedImage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-doubt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          targetExam: studentContext?.targetExam || "JEE",
          studentContext,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply || "Solution complete." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, doubt solve karne mein thodi dikkat aayi. Please dobara try karein!" },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network issue. Please check connection and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in">
      <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl shadow-2xl flex flex-col h-[82vh] border-t border-ink/10 relative">
        {/* Header */}
        <div className="p-4 border-b border-ink/8 flex items-center justify-between bg-paper/50 rounded-t-3xl">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-teal text-white flex items-center justify-center text-sm font-bold shadow-xs">
              ✨
            </span>
            <div>
              <h3 className="text-sm font-black text-ink">AI Doubt & Question Solver</h3>
              <p className="text-[10.5px] text-slate">
                Step-by-step solutions for {studentContext?.targetExam || "JEE/NEET"}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate hover:bg-ink/10">
            ✕
          </button>
        </div>

        {/* Chat History */}
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
              <span className="animate-spin">⏳</span> Solving question with step-by-step explanation…
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Image Preview */}
        {selectedImage && (
          <div className="px-4 py-2 bg-paper/60 border-t border-ink/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={selectedImage} alt="Preview" className="w-10 h-10 object-cover rounded-lg" />
              <span className="text-[11px] font-bold text-ink">Image attached</span>
            </div>
            <button type="button" onClick={() => setSelectedImage(null)} className="text-xs text-rose-500 font-bold hover:underline">
              Remove
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 border-t border-ink/10 bg-white">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl border border-ink/12 text-slate hover:text-ink active:scale-95 transition-all text-sm flex-shrink-0" title="Upload question photo">
              📷
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask formula, question or concept…"
              className="flex-1 text-xs font-semibold p-2.5 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
            />
            <button type="submit" disabled={loading || (!input.trim() && !selectedImage)} className="px-4 py-2.5 rounded-xl bg-teal text-white text-xs font-bold shadow-xs hover:bg-teal/90 disabled:opacity-40 transition-all flex-shrink-0">
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
