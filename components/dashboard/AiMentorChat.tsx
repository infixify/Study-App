// components/dashboard/AiMentorChat.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
  ttsAudio?: string;
  ttsText?: string;
  language?: string;
}

interface AiMentorChatProps {
  userId: string;
  onClose: () => void;
  targetExam?: string;
  studentContext?: any;
}

const TTS_CACHE_PREFIX = "pw_mentor_tts_";
const CHAT_CACHE_PREFIX = "pw_mentor_chat_";
const TTS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// 24-HOUR TTS AUDIO CACHE (server-TTS blobs cached by text hash; zero API
// requests on replay — same approach as Live Doubt)
// ============================================================================
function ttsHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + "_" + text.length;
}

function base64ToBlob(base64: string, type: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

function getCachedTtsAudio(text: string): { base64: string; type: string } | null {
  try {
    const key = TTS_CACHE_PREFIX + ttsHash(text);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.base64) {
      localStorage.removeItem(key);
      return null;
    }
    if (parsed.timestamp && Date.now() - parsed.timestamp > TTS_CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return { base64: parsed.base64, type: parsed.type || "audio/wav" };
  } catch (_) {
    return null;
  }
}

function evictOldestCachedTtsAudio() {
  try {
    let oldestKey: string | null = null;
    let oldestTs = Infinity;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(TTS_CACHE_PREFIX)) {
        try {
          const ts = JSON.parse(localStorage.getItem(key) || "{}").timestamp || 0;
          if (ts < oldestTs) {
            oldestTs = ts;
            oldestKey = key;
          }
        } catch (_) {
          if (key) localStorage.removeItem(key);
        }
      }
    }
    if (oldestKey) localStorage.removeItem(oldestKey);
  } catch (_) {}
}

function cacheTtsAudioBlob(text: string, blob: Blob) {
  try {
    blob.arrayBuffer().then((buf) => {
      try {
        const bytes = new Uint8Array(buf);
        let bin = "";
        const step = 0x8000;
        for (let i = 0; i < bytes.length; i += step) {
          bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + step)) as any);
        }
        const base64 = btoa(bin);
        if (base64.length > 4 * 1024 * 1024) return;
        const key = TTS_CACHE_PREFIX + ttsHash(text);
        const payload = JSON.stringify({ timestamp: Date.now(), type: blob.type, base64 });
        try {
          localStorage.setItem(key, payload);
        } catch (_) {
          evictOldestCachedTtsAudio();
          try {
            localStorage.setItem(key, payload);
          } catch (_) {}
        }
      } catch (_) {}
    }).catch(() => {});
  } catch (_) {}
}

// ============================================================================
// NATIVE VOICE LANGUAGE RESOLVER
// "auto" is NOT a valid BCP-47 tag — passing it straight to
// SpeechSynthesisUtterance made speechSynthesis fail with
// SpeechSynthesisErrorEvent on mobile browsers.
// ============================================================================
function resolveNativeLang(text: string, lang?: string): string {
  const l = (lang || "").trim();
  if (l && l !== "auto") {
    const map: Record<string, string> = {
      en: "en-IN",
      hi: "hi-IN",
      "hi-IN": "hi-IN",
      mr: "hi-IN",
      bn: "bn-IN",
      ta: "ta-IN",
      te: "te-IN",
      gu: "gu-IN",
      pa: "pa-IN",
      ml: "ml-IN",
      kn: "kn-IN",
      or: "or-IN",
    };
    return map[l] || l;
  }
  // Auto: detect from the text's script, else the browser language
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN";
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa-IN";
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN";
  if (/[\u0B00-\u0B7F]/.test(text)) return "or-IN";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN";
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN";
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml-IN";
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
  return navigator.language || "en-IN";
}

export default function AiMentorChat({
  userId,
  onClose,
  targetExam = "JEE",
  studentContext,
}: AiMentorChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [language, setLanguage] = useState<string>("auto");
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechSessionRef = useRef(0);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load cached chat history
  useEffect(() => {
    const cached = localStorage.getItem(`${CHAT_CACHE_PREFIX}${userId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        // Revive timestamps: JSON.parse turns Date into an ISO string, which would crash formatTime()
        const recentMessages = parsed
          .filter(
            (msg: Message) => now - new Date(msg.timestamp).getTime() < TTS_CACHE_TTL
          )
          .map((msg: Message) => ({ ...msg, timestamp: new Date(msg.timestamp) }));
        if (recentMessages.length > 0) {
          setMessages(recentMessages);
        }
      } catch (e) {
        console.error("Failed to load cached chat:", e);
      }
    }
  }, [userId]);

  // Save chat to cache
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(`${CHAT_CACHE_PREFIX}${userId}`, JSON.stringify(messages));
      } catch (e) {
        console.error("Failed to save chat cache:", e);
      }
    }
  }, [messages, userId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      speechSessionRef.current++;
      if (speakTimeoutRef.current) {
        clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = null;
      }
      try {
        audioRef.current?.pause();
      } catch (_) {}
      audioRef.current = null;
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  // Auto-detect language from browser
  useEffect(() => {
    const browserLang = navigator.language || "en";
    const lang = browserLang.startsWith("hi") ? "hi" : 
                browserLang.startsWith("en") ? "en" : "auto";
    setLanguage(lang);
  }, []);

  const getGenZTone = useCallback((gender?: string): string => {
    if (gender === "female") return "behen";
    return "bro";
  }, []);

  // Real-time speech to text using Web Speech API
  const stopRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.onstart = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecognition = useCallback(() => {
    if (isRecording) return;
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("Speech recognition not supported in your browser");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = language === "auto" ? navigator.language : language;

      baseTextRef.current = inputText;

      recognition.onstart = () => {
        setIsRecording(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        transcript = transcript.trim();
        if (!transcript) return;
        const base = baseTextRef.current.trim();
        setInputText(base ? base + " " + transcript : transcript);
      };

      recognition.onerror = (event: any) => {
        const err = event && event.error;
        if (err === "not-allowed" || err === "service-not-allowed") {
          setError("Microphone permission denied. Please allow mic access.");
        } else if (err === "no-speech" || err === "aborted" || err === "network") {
          // Nothing to show: user stopped or no speech was detected
        } else {
          setError("Speech recognition error. Please try again.");
        }
        console.error("Speech recognition error:", err);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error("Speech recognition start error:", e);
      setIsRecording(false);
    }
  }, [isRecording, inputText, language]);

  // Tap mic: toggle real-time speech to text
  const startSpeechToText = useCallback(() => {
    if (isRecording) {
      stopRecognition();
    } else {
      startRecognition();
    }
  }, [isRecording, startRecognition, stopRecognition]);

  // Hold to speak: start recognition immediately on press
  const startHoldToSpeak = useCallback(() => {
    if (isRecording) return;
    startRecognition();
  }, [isRecording, startRecognition]);

  // Release hold: stop recognition
  const stopHoldToSpeak = useCallback(() => {
    stopRecognition();
  }, [stopRecognition]);

  // Native browser voice (last-resort fallback when server TTS is unavailable)
  const speakNative = useCallback((text: string, lang?: string) => {
    if (!("speechSynthesis" in window)) {
      setError("Text-to-speech not supported in your browser");
      setIsSpeaking(false);
      return;
    }
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = resolveNativeLang(text, lang);
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      setIsSpeaking(false);
      console.error("TTS error:", event);
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  // Text to speech: server-side 3-tier TTS (natural voice — same pipeline as
  // Live Doubt: HuggingFace -> Sarvam -> native) with a 24h audio cache;
  // falls back to the browser's native voice if the TTS API fails.
  const speakText = useCallback(
    async (text: string, lang?: string) => {
      const speechText = (text || "").trim();
      if (!speechText) return;

      // New speech session: invalidates any in-flight playback/fetch
      const session = ++speechSessionRef.current;
      try {
        audioRef.current?.pause();
      } catch (_) {}
      audioRef.current = null;
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
      setIsSpeaking(true);
      const alive = () => session === speechSessionRef.current;

      const playBlob = (blob: Blob): Promise<boolean> => {
        return new Promise((resolve) => {
          if (!alive()) {
            resolve(false);
            return;
          }
          try {
            const audio = new Audio(URL.createObjectURL(blob));
            audioRef.current = audio;
            let settled = false;
            const done = (ok: boolean) => {
              if (settled) return;
              settled = true;
              if (audioRef.current === audio) audioRef.current = null;
              try {
                URL.revokeObjectURL(audio.src);
              } catch (_) {}
              if (alive()) setIsSpeaking(false);
              resolve(ok);
            };
            audio.onended = () => done(true);
            audio.onerror = () => done(false);
            audio.play().catch(() => done(false));
          } catch (_) {
            resolve(false);
          }
        });
      };

      // 1. CACHE HIT: replay cached server-TTS audio with zero API requests
      const cached = getCachedTtsAudio(speechText);
      if (cached) {
        const ok = await playBlob(base64ToBlob(cached.base64, cached.type));
        if (ok || !alive()) return;
        try {
          localStorage.removeItem(TTS_CACHE_PREFIX + ttsHash(speechText));
        } catch (_) {}
      }

      // 2. Server TTS (Tier 1: HuggingFace natural voice -> Tier 2: Sarvam ->
      //    Tier 3: native-voice JSON handled below)
      try {
        const res = await fetch("/api/ai-doubt/live/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: speechText }),
        });
        if (!alive()) return;
        if (res.ok) {
          const blob = await res.blob();
          if (!alive()) return;
          if (blob.type && blob.type !== "application/json" && blob.size > 0) {
            cacheTtsAudioBlob(speechText, blob);
            const ok = await playBlob(blob);
            if (ok || !alive()) return;
          } else if (blob.type === "application/json") {
            // Tier 3: server says speak natively with this language
            try {
              const info = JSON.parse(await blob.text());
              if (info && info.type === "native") {
                if (alive()) speakNative(String(info.text || speechText), info.lang);
                return;
              }
            } catch (_) {}
          }
        }
      } catch (e) {
        console.error("Mentor TTS API error:", e);
      }

      // 3. Final fallback: browser native voice
      if (alive()) speakNative(speechText, lang);
    },
    [speakNative]
  );

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    speechSessionRef.current++;
    try {
      audioRef.current?.pause();
    } catch (_) {}
    audioRef.current = null;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
    setIsSpeaking(false);
  }, []);

  // Send message to AI mentor
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      text: text.trim(),
      sender: "user",
      timestamp: new Date(),
      language,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);
    setError(null);

    try {
      const requestBody = {
        userId,
        message: text,
        studentContext: {
          ...studentContext,
          targetExam,
          language,
          tone: getGenZTone(studentContext?.gender),
        },
        timestamp: new Date().toISOString(),
      };

      const response = await fetch("/api/ai-mentor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`AI Mentor error: ${response.statusText}`);
      }

      const data = await response.json();

      const aiText = data.reply || "I'm here to help you with your studies!";
      const aiTtsText = data.tts_text || aiText;

      const aiMessage: Message = {
        id: `msg_${Date.now()}_ai`,
        text: aiText,
        ttsText: aiTtsText,
        sender: "ai",
        timestamp: new Date(),
        language: data.language || language,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Auto-speak the response (server 3-tier TTS, native fallback)
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = setTimeout(() => {
        speakTimeoutRef.current = null;
        speakText(aiTtsText, data.language || language);
      }, 500);

    } catch (err) {
      setError("Failed to get response from AI Mentor. Please try again.");
      console.error("AI Mentor API error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, language, studentContext, targetExam, getGenZTone, speakText]);

  // Handle send on Enter
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && inputText.trim()) {
      e.preventDefault();
      sendMessage(inputText);
    }
  }, [inputText, sendMessage]);

  // Replay TTS for a message
  const replayTTS = useCallback((message: Message) => {
    if (message.sender === "ai" && message.text) {
      speakText(message.ttsText || message.text, message.language);
    }
  }, [speakText]);

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center text-sm shadow-md font-bold">
              👨‍🏫
            </span>
            <div>
              <h3 className="text-sm font-black tracking-tight text-white">
                AI Mentor Chat
              </h3>
              <p className="text-[10px] text-white/80 font-medium">
                {getGenZTone(studentContext?.gender)} mode 🤤🤤
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 text-sm font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">💬</span>
              </div>
              <p className="text-slate-500 text-sm font-medium">
                Start a conversation with your AI Mentor
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Type or use voice input below
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} gap-2`}
              >
                {msg.sender === "ai" && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm shrink-0">
                    👨‍🏫
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.sender === "user"
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-white border border-slate-200 rounded-bl-sm"
                  }`}
                >
                  <p className="text-sm font-medium whitespace-pre-wrap">{msg.text}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-slate-500">{formatTime(msg.timestamp)}</span>
                    {msg.sender === "ai" && (
                      <button
                        onClick={() => replayTTS(msg)}
                        className="text-[12px] text-indigo-600 hover:text-indigo-800 transition-colors"
                        title="Replay"
                      >
                        🔁
                      </button>
                    )}
                  </div>
                </div>
                {msg.sender === "user" && (
                  <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center text-sm shrink-0">
                    👤
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm shrink-0">
                👨‍🏫
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-2.5">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 pb-2">
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[11px] font-medium text-center">
              {error}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-slate-200 bg-white">
          {/* Hold to Speak Button (Big, Live Doubt style) */}
          <div className="mb-3">
            <button
              type="button"
              onMouseDown={startHoldToSpeak}
              onMouseUp={stopHoldToSpeak}
              onMouseLeave={stopHoldToSpeak}
              onTouchStart={startHoldToSpeak}
              onTouchEnd={stopHoldToSpeak}
              className={`w-full py-4 px-4 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                isRecording
                  ? "bg-rose-600 ring-4 ring-rose-200 animate-pulse"
                  : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
              }`}
            >
              <span className="text-lg">🎢</span>
              <span>{isRecording ? "Recording... Release to Send" : "HOLD TO SPEAK"}</span>
              <span className="text-lg">🎢</span>
            </button>
            <p className="text-[10px] text-slate-500 text-center mt-1">
              Speak your doubt, release to get instant answer
            </p>
          </div>

          {/* Chat Input + Mic */}
          <div className="flex gap-2 items-end">
            <button
              type="button"
              onClick={startSpeechToText}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md transition-all shrink-0 ${
                isRecording
                  ? "bg-rose-500 hover:bg-rose-600"
                  : "bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700"
              }`}
              title={isRecording ? "Stop listening" : "Speech to Text"}
            >
              🎤
            </button>
            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isSpeaking ? "Listening..." : "Type your message or use voice input..."}
                rows={1}
                className="w-full p-3 pr-10 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
                disabled={isLoading || isSpeaking}
              />
              {inputText && !isLoading && !isSpeaking && (
                <button
                  onClick={() => sendMessage(inputText)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors"
                >
                  🛒
                </button>
              )}
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 transition-colors"
                >
                  🔽
                </button>
              )}
            </div>
          </div>

          {/* Language Selector */}
          <div className="flex justify-end mt-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-[11px] px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="auto">Auto Detect</option>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="hi-IN">Hinglish</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
