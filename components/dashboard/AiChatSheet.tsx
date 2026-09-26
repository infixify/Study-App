"use client";

import { useState } from "react";

interface Message {
  id: string;
  from: "ai" | "user";
  text: string;
}

interface AiChatSheetProps {
  open: boolean;
  onClose: () => void;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "seed-1",
    from: "ai",
    text: "You've got 2 backlog items from Mock Test #14 sitting for 3 days — want me to break the wrong questions into a 20-minute revision block?",
  },
];

export default function AiChatSheet({ open, onClose }: AiChatSheetProps) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");

  function send() {
    if (!input.trim()) return;
    const userMsg: Message = { id: crypto.randomUUID(), from: "user", text: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    // Mock AI response — replace with a real call to your Gemini-backed edge function,
    // passing the user's tasks/scores/streak as context for a proactive suggestion.
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          from: "ai",
          text: "Got it — I'll pull those questions into your Focus Mode queue for tonight.",
        },
      ]);
    }, 700);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      {/* Backdrop */}
      <button
        aria-label="Close chat"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-white rounded-t-2xl flex flex-col max-h-[80vh] animate-[slideUp_0.25s_ease-out]">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-ink/8">
          <div>
            <p className="font-medium text-sm">Study mentor</p>
            <p className="text-xs text-slate">Knows your tasks, scores, and streak</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate hover:bg-ink/5"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-snug ${
                m.from === "ai"
                  ? "bg-ink/5 text-ink self-start rounded-bl-sm"
                  : "bg-marigold text-ink self-end rounded-br-sm"
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-ink/8">
          <button
            aria-label="Attach image"
            className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-slate hover:bg-ink/5"
          >
            📎
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask about a topic, or your progress…"
            className="flex-1 bg-ink/5 rounded-full px-4 py-2.5 text-sm outline-none"
          />
          <button
            onClick={send}
            aria-label="Send"
            className="w-9 h-9 flex-shrink-0 rounded-full bg-ink text-paper flex items-center justify-center"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
