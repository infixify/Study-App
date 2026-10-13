// components/dashboard/AiMentorChat.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

// ============================================================================
// CLEAN INLINE SVG ICONS (Live Doubt style)
// ============================================================================
const CloseIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChatBubbleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const ChevronDownIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUpIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const MicActiveIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const MicMutedIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-1.2 3.9M12 18a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5c0-.4.1-.8.2-1.2M9.4 4.3A3 3 0 0115 5v5.2M3 3l18 18" />
  </svg>
);

const PlayTriangleIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const StopSquareIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const ExpandIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
  </svg>
);

const CollapseIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" />
  </svg>
);

const SendIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const TrashIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const MentorCapIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 11.6v4c0 1 2.9 2.4 6.5 2.4s6.5-1.4 6.5-2.4v-4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 9v5" />
  </svg>
);

const SparkleIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
  </svg>
);

const SpeakerIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
  </svg>
);

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================
interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
  ttsAudio?: string;
  ttsText?: string;
  language?: string;
}

interface LiveReply {
  id: string;
  text: string;
  ttsText: string;
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
const EQ_BAR_COUNT = 26;

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

// ============================================================================
// MAIN COMPONENT: AiMentorChat (mentor style — infinity orb with live voice-reactive frequencies + session drawer)
// ============================================================================
export default function AiMentorChat({
  userId,
  onClose,
  targetExam = "JEE",
  studentContext,
}: AiMentorChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mic (tap-to-fill chat box) and Hold-to-Speak are INDEPENDENT systems
  const [isMicActive, setIsMicActive] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [holdTranscript, setHoldTranscript] = useState("");
  const [hudMode, setHudMode] = useState<"compact" | "expanded">("compact");
  const [liveReply, setLiveReply] = useState<LiveReply | null>(null);
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);

  const drawerBottomRef = useRef<HTMLDivElement>(null);
  const micRecognitionRef = useRef<any>(null);
  const holdRecognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>("");
  const holdFinalRef = useRef<string>("");
  const holdTranscriptRef = useRef<string>("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechSessionRef = useRef(0);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Web Audio: unlocks autoplay on the first user gesture and powers the
  // orb frequency bars with REAL voice data (mic while listening, TTS while
  // the AI speaks) — no more artificial rhythm.
  const audioCtxRef = useRef<any>(null);
  const aiGraphRef = useRef<{ source: any; analyser: AnalyserNode } | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const eqBarRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const orbStateRef = useRef<"idle" | "user" | "ai">("idle");

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

  // Save chat to cache (also clears storage when chat is emptied)
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(`${CHAT_CACHE_PREFIX}${userId}`, JSON.stringify(messages));
      } else {
        localStorage.removeItem(`${CHAT_CACHE_PREFIX}${userId}`);
      }
    } catch (e) {
      console.error("Failed to save chat cache:", e);
    }
  }, [messages, userId]);

  // Scroll drawer to bottom on new messages (when expanded)
  useEffect(() => {
    if (hudMode === "expanded") {
      drawerBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, hudMode]);

  // ==========================================================================
  // WEB AUDIO — unlocks autoplay on the first user gesture and powers the
  // orb frequency bars with real voice data (no more artificial rhythm).
  // ==========================================================================
  const ensureAudioCtx = useCallback((): any => {
    try {
      if (typeof window === "undefined") return null;
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch (_) {
      return null;
    }
  }, []);

  // Mic analyser: live frequency data of the user voice while listening.
  // The analyser is NEVER connected to the output — mic must not feed back.
  const startMicAnalyser = useCallback(() => {
    if (micAnalyserRef.current) return;
    const ctx = ensureAudioCtx();
    if (!ctx || !navigator.mediaDevices?.getUserMedia) return;
    try {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const c = audioCtxRef.current;
          if (!c) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          micStreamRef.current = stream;
          const src = c.createMediaStreamSource(stream);
          const analyser = c.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.7;
          analyser.minDecibels = -85;
          analyser.maxDecibels = -25;
          src.connect(analyser);
          micAnalyserRef.current = analyser;
        })
        .catch(() => {});
    } catch (_) {}
  }, [ensureAudioCtx]);

  const stopMicAnalyser = useCallback(() => {
    micAnalyserRef.current = null;
    try {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch (_) {}
    micStreamRef.current = null;
  }, []);

  // Mic analyser follows the listening state (mic button OR hold-to-speak)
  useEffect(() => {
    if (isMicActive || isHolding) startMicAnalyser();
    else stopMicAnalyser();
  }, [isMicActive, isHolding, startMicAnalyser, stopMicAnalyser]);

  // Cleanup audio + recognitions on unmount
  useEffect(() => {
    return () => {
      speechSessionRef.current++;
      if (speakTimeoutRef.current) {
        clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = null;
      }
      const stopRec = (rec: any) => {
        if (rec) {
          try {
            rec.onstart = null;
            rec.onresult = null;
            rec.onerror = null;
            rec.onend = null;
            rec.stop();
          } catch (_) {}
        }
      };
      stopRec(micRecognitionRef.current);
      stopRec(holdRecognitionRef.current);
      micRecognitionRef.current = null;
      holdRecognitionRef.current = null;
      try {
        audioRef.current?.pause();
      } catch (_) {}
      audioRef.current = null;
      try {
        if (aiGraphRef.current) {
          try { aiGraphRef.current.source.stop(); } catch (_) {}
          aiGraphRef.current = null;
        }
      } catch (_) {}
      stopMicAnalyser();
      try {
        audioCtxRef.current?.close();
      } catch (_) {}
      audioCtxRef.current = null;
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    };
  }, []);

  const getGenZTone = useCallback((gender?: string): string => {
    if (gender === "female") return "behen";
    return "bro";
  }, []);

  // ==========================================================================
  // SPEECH RECOGNITION FACTORY (Web Speech API) — used by BOTH mic & hold,
  // each with its own instance so the two buttons never interfere.
  // ==========================================================================
  const createRecognition = useCallback(
    (opts: {
      continuous: boolean;
      onResult: (event: any) => void;
      onError: (err: string) => void;
      onEnd: () => void;
    }) => {
      if (typeof window === "undefined") return null;
      const SR =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return null;
      const recognition = new SR();
      recognition.continuous = opts.continuous;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = navigator.language || "en-IN";
      recognition.onresult = opts.onResult;
      recognition.onerror = (e: any) => opts.onError(e?.error);
      recognition.onend = opts.onEnd;
      return recognition;
    },
    []
  );

  // ==========================================================================
  // TEXT TO SPEECH (server 3-tier natural voice + native fallback)
  // ==========================================================================
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
    // Chrome drops utterances queued synchronously right after cancel() —
    // speak on the next tick and nudge the synth out of its paused state.
    setTimeout(() => {
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } catch (_) {}
    }, 60);
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
      // Unlock the AudioContext while we may still be inside a user gesture,
      // so the automatic playback below is never blocked by autoplay policy.
      ensureAudioCtx();
      try {
        audioRef.current?.pause();
      } catch (_) {}
      audioRef.current = null;
      try {
        if (aiGraphRef.current) {
          try { aiGraphRef.current.source.stop(); } catch (_) {}
          aiGraphRef.current = null;
        }
      } catch (_) {}
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
          const finish = (ok: boolean) => {
            if (aiGraphRef.current) {
              try { aiGraphRef.current.source.disconnect(); } catch (_) {}
              try { aiGraphRef.current.analyser.disconnect(); } catch (_) {}
              aiGraphRef.current = null;
            }
            if (alive()) setIsSpeaking(false);
            resolve(ok);
          };
          // Preferred path: play through Web Audio. The gesture-unlocked
          // AudioContext makes automatic playback reliable on every browser,
          // and the analyser feeds the orb frequency bars with the REAL
          // voice spectrum.
          const ctx = ensureAudioCtx();
          if (ctx && blob.type && blob.type !== "application/json" && blob.size > 0) {
            blob
              .arrayBuffer()
              .then((buf) => {
                if (!alive()) {
                  resolve(false);
                  return;
                }
                ctx.decodeAudioData(
                  buf,
                  (audioBuf: AudioBuffer) => {
                    if (!alive()) {
                      resolve(false);
                      return;
                    }
                    try {
                      const source = ctx.createBufferSource();
                      source.buffer = audioBuf;
                      const analyser = ctx.createAnalyser();
                      analyser.fftSize = 64;
                      analyser.smoothingTimeConstant = 0.78;
                      analyser.minDecibels = -85;
                      analyser.maxDecibels = -25;
                      source.connect(analyser);
                      analyser.connect(ctx.destination);
                      aiGraphRef.current = { source, analyser };
                      source.onended = () => finish(true);
                      source.start(0);
                    } catch (_) {
                      finish(false);
                    }
                  },
                  () => playViaElement()
                );
              })
              .catch(() => playViaElement());
            return;
          }
          playViaElement();

          // Fallback: plain audio element (no analyser data on this path)
          function playViaElement() {
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
              audio.play().catch(() => {
                // Autoplay policy hit: resume the unlocked context, retry once
                try {
                  const c = ensureAudioCtx();
                  if (c && c.state === "suspended") {
                    c.resume()
                      .then(() => audio.play())
                      .catch(() => done(false));
                  } else {
                    done(false);
                  }
                } catch (_) {
                  done(false);
                }
              });
            } catch (_) {
              resolve(false);
            }
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
    [speakNative, ensureAudioCtx]
  );

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    speechSessionRef.current++;
    try {
      audioRef.current?.pause();
    } catch (_) {}
    audioRef.current = null;
    try {
      if (aiGraphRef.current) {
        try { aiGraphRef.current.source.stop(); } catch (_) {}
        try { aiGraphRef.current.source.disconnect(); } catch (_) {}
        try { aiGraphRef.current.analyser.disconnect(); } catch (_) {}
      }
    } catch (_) {}
    aiGraphRef.current = null;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
    setIsSpeaking(false);
  }, []);

  // ==========================================================================
  // SEND MESSAGE (shared by typed chat & hold-to-speak)
  // ==========================================================================
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      // Gesture unlock: the automatic TTS a few seconds later must never be
      // blocked by the browser autoplay policy.
      ensureAudioCtx();

      const userText = text.trim();
      const userMessage: Message = {
        id: `msg_${Date.now()}_user`,
        text: userText,
        sender: "user",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputText("");
      setIsLoading(true);
      setError(null);
      setLiveReply(null);
      setPendingUserText(userText);

      try {
        const requestBody = {
          userId,
          message: userText,
          studentContext: {
            ...studentContext,
            targetExam,
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
        const aiLang = data.language || undefined;

        const aiMessage: Message = {
          id: `msg_${Date.now()}_ai`,
          text: aiText,
          ttsText: aiTtsText,
          sender: "ai",
          timestamp: new Date(),
          language: aiLang,
        };

        setMessages((prev) => [...prev, aiMessage]);
        // Live output in the overlay (AI Live Doubt style)
        setLiveReply({ id: aiMessage.id, text: aiText, ttsText: aiTtsText, language: aiLang });
        setPendingUserText(null);

        // Auto-speak the response (server 3-tier TTS, native fallback)
        if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = setTimeout(() => {
          speakTimeoutRef.current = null;
          speakText(aiTtsText, aiLang);
        }, 500);
      } catch (err) {
        setError("Failed to get response from AI Mentor. Please try again.");
        console.error("AI Mentor API error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [userId, studentContext, targetExam, getGenZTone, speakText, ensureAudioCtx]
  );

  // ==========================================================================
  // MIC BUTTON (tap toggle) — fills the chat input box with live text.
  // Independent from Hold-to-Speak.
  // ==========================================================================
  const stopMicRecognition = useCallback(() => {
    const rec = micRecognitionRef.current;
    if (rec) {
      try {
        rec.onstart = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch (_) {}
      micRecognitionRef.current = null;
    }
    setIsMicActive(false);
  }, []);

  const startMicRecognition = useCallback(() => {
    if (isMicActive) return;
    ensureAudioCtx(); // gesture unlock + mic analyser context
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("Speech recognition not supported in your browser");
      return;
    }
    try {
      const recognition = createRecognition({
        continuous: false,
        onResult: (event: any) => {
          let transcript = "";
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          transcript = transcript.trim();
          if (!transcript) return;
          const base = baseTextRef.current.trim();
          setInputText(base ? base + " " + transcript : transcript);
        },
        onError: (err) => {
          if (err === "not-allowed" || err === "service-not-allowed") {
            setError("Microphone permission denied. Please allow mic access.");
          } else if (err !== "no-speech" && err !== "aborted" && err !== "network") {
            setError("Speech recognition error. Please try again.");
          }
          setIsMicActive(false);
        },
        onEnd: () => {
          if (micRecognitionRef.current === recognition) {
            micRecognitionRef.current = null;
          }
          setIsMicActive(false);
        },
      });
      if (!recognition) return;
      baseTextRef.current = inputText;
      micRecognitionRef.current = recognition;
      recognition.start();
      setIsMicActive(true);
      setError(null);
    } catch (e) {
      console.error("Mic recognition start error:", e);
      setIsMicActive(false);
    }
  }, [isMicActive, inputText, createRecognition, ensureAudioCtx]);

  const toggleMic = useCallback(() => {
    if (isMicActive) {
      stopMicRecognition();
    } else {
      startMicRecognition();
    }
  }, [isMicActive, startMicRecognition, stopMicRecognition]);

  // ==========================================================================
  // HOLD TO SPEAK (top button) — live transcript in overlay, release to send.
  // Independent from the mic button.
  // ==========================================================================
  const startHoldRecognition = useCallback(() => {
    if (isHolding || isLoading) return;
    ensureAudioCtx(); // gesture unlock + mic analyser context
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("Speech recognition not supported in your browser");
      return;
    }
    // New hold session clears the live reply overlay
    setLiveReply(null);
    setHoldTranscript("");
    holdFinalRef.current = "";
    holdTranscriptRef.current = "";
    try {
      const recognition = createRecognition({
        continuous: true,
        onResult: (event: any) => {
          // Guarded final-commit (same approach as Live Doubt): Android engines
          // can resend whole utterances as finals — naive append duplicates text.
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res.isFinal) {
              const t = res[0].transcript.trim();
              if (!t) continue;
              const committed = holdFinalRef.current.trim();
              if (!committed) {
                holdFinalRef.current = t + " ";
              } else if (committed.toLowerCase().includes(t.toLowerCase())) {
                // duplicate final, skip
              } else if (t.toLowerCase().includes(committed.toLowerCase())) {
                holdFinalRef.current = t + " ";
              } else {
                holdFinalRef.current += t + " ";
              }
            } else {
              interim += res[0].transcript;
            }
          }
          let interimOnly = "";
          for (let i = 0; i < event.results.length; ++i) {
            if (!event.results[i].isFinal) interimOnly += event.results[i][0].transcript;
          }
          holdTranscriptRef.current = (holdFinalRef.current + " " + interimOnly).trim();
          setHoldTranscript(holdTranscriptRef.current);
        },
        onError: (err) => {
          if (err === "not-allowed" || err === "service-not-allowed") {
            setError("Microphone permission denied. Please allow mic access.");
          }
          setIsHolding(false);
        },
        onEnd: () => {
          if (holdRecognitionRef.current === recognition) {
            holdRecognitionRef.current = null;
          }
          setIsHolding(false);
        },
      });
      if (!recognition) return;
      holdRecognitionRef.current = recognition;
      recognition.start();
      setIsHolding(true);
      setError(null);
    } catch (e) {
      console.error("Hold recognition start error:", e);
      setIsHolding(false);
    }
  }, [isHolding, isLoading, createRecognition, ensureAudioCtx]);

  const endHoldAndSend = useCallback(async () => {
    if (!isHolding) return;
    try {
      holdRecognitionRef.current?.stop();
    } catch (_) {}
    holdRecognitionRef.current = null;
    setIsHolding(false);

    // GRACE PERIOD: recognition ke final onresult buffer ko catch karne ke liye
    await new Promise((resolve) => setTimeout(resolve, 250));

    const text = holdTranscriptRef.current.trim();
    holdFinalRef.current = "";
    holdTranscriptRef.current = "";
    setHoldTranscript("");
    if (!text) return;
    sendMessage(text);
  }, [isHolding, sendMessage]);

  // Replay TTS for a message
  const replayTTS = useCallback(
    (message: Message) => {
      if (message.sender === "ai" && message.text) {
        speakText(message.ttsText || message.text, message.language);
      }
    },
    [speakText]
  );

  // Clear chat (drawer)
  const clearChat = useCallback(() => {
    setMessages([]);
    setLiveReply(null);
    setPendingUserText(null);
    try {
      localStorage.removeItem(`${CHAT_CACHE_PREFIX}${userId}`);
    } catch (_) {}
  }, [userId]);

  // Handle send on Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && inputText.trim()) {
        e.preventDefault();
        sendMessage(inputText);
      }
    },
    [inputText, sendMessage]
  );

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // ==========================================================================
  // INFINITY ORB STATE — glows + frequencies when user speaks (teal) and
  // changes colour when the AI speaks back (fuchsia)
  // ==========================================================================
  const orbState: "idle" | "user" | "ai" = isSpeaking
    ? "ai"
    : isHolding || isMicActive
    ? "user"
    : "idle";
  const orbActive = orbState !== "idle";
  const orbText =
    orbState === "user"
      ? "text-teal-300"
      : orbState === "ai"
      ? "text-fuchsia-300"
      : "text-indigo-300";
  const orbGlow =
    orbState === "user"
      ? "bg-teal-400/40"
      : orbState === "ai"
      ? "bg-fuchsia-500/40"
      : "bg-indigo-500/25";
  const orbCaption =
    orbState === "user"
      ? "Listening... bolte rahiye"
      : orbState === "ai"
      ? "Mentor bol raha hai..."
      : "Hold to Speak ya neeche type karke puchiye";

  // Mirror orbState into a ref for the animation loop below
  useEffect(() => {
    orbStateRef.current = orbState;
  }, [orbState]);

  // Drive the frequency bars from the REAL voice: mic analyser while the
  // user speaks, TTS analyser while the AI speaks. Falls back to a gentle
  // synthetic wave when no analyser is live (e.g. native fallback voice) so
  // the bars always move during an active session.
  useEffect(() => {
    if (orbState === "idle") return;
    // Best-effort: make sure the audio context is running for live data
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
    const bars = eqBarRefs.current;
    const freq = new Uint8Array(32);
    const levels = new Array(EQ_BAR_COUNT).fill(0.2);
    let raf = 0;
    const loop = () => {
      const analyser =
        orbStateRef.current === "ai"
          ? aiGraphRef.current?.analyser
          : micAnalyserRef.current;
      const ctxRunning =
        !!audioCtxRef.current && audioCtxRef.current.state === "running";
      if (analyser && ctxRunning) {
        try {
          analyser.getByteFrequencyData(freq);
        } catch (_) {}
      }
      const useAnalyser = !!(analyser && ctxRunning);
      const t = performance.now() / 1000;
      for (let i = 0; i < EQ_BAR_COUNT; i++) {
        // Voice energy lives in the lower bins — bias the mapping downwards
        const bin = Math.min(
          31,
          Math.floor(Math.pow(i / (EQ_BAR_COUNT - 1), 1.8) * 16)
        );
        let target: number;
        if (useAnalyser) {
          // Real voice spectrum; keep a visible floor so silence during an
          // active session still shows living bars
          target = Math.max(0.22, (freq[bin] || 0) / 255);
        } else {
          target = 0.35 + 0.3 * Math.sin(t * 5.5 + i * 0.55);
        }
        levels[i] += (target - levels[i]) * 0.45;
        const bar = bars[i];
        if (bar) {
          bar.style.animation = "none";
          bar.style.transform = `scaleY(${(0.15 + levels[i] * 0.85).toFixed(3)})`;
          bar.style.opacity = "0.95";
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      bars.forEach((b) => {
        if (b) {
          b.style.animation = "";
          b.style.transform = "";
          b.style.opacity = "";
        }
      });
    };
  }, [orbState]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <style>{`
        @keyframes mentorEq {
          0%, 100% { transform: scaleY(0.18); }
          50% { transform: scaleY(1); }
        }
        .mentor-eq-bar {
          transform-origin: bottom;
          animation: mentorEq 1.7s ease-in-out infinite;
        }
      `}</style>
      <div className="bg-slate-950 rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-800 overflow-y-auto">

        {/* ── Header: title + expand/collapse + close (no language dropdown) ── */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center shadow-md">
              <MentorCapIcon className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-black tracking-tight text-white">
                AI Mentor Chat
              </h3>
              <p className="text-[10px] text-white/80 font-medium">
                Aapka personal study mentor
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setHudMode((prev) => (prev === "expanded" ? "compact" : "expanded"))}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
              title={hudMode === "expanded" ? "Collapse chat" : "Expand chat"}
            >
              {hudMode === "expanded" ? <CollapseIcon /> : <ExpandIcon />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
              title="Close"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── HOLD TO SPEAK (top button) ── */}
        <div className="p-4 pb-2 shrink-0">
          <button
            type="button"
            onMouseDown={startHoldRecognition}
            onMouseUp={endHoldAndSend}
            onMouseLeave={endHoldAndSend}
            onTouchStart={(e) => {
              e.preventDefault();
              startHoldRecognition();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              endHoldAndSend();
            }}
            onContextMenu={(e) => e.preventDefault()}
            style={{ touchAction: "none" }}
            disabled={isLoading}
            className={`w-full py-4 px-4 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all select-none ${
              isHolding
                ? "bg-rose-600 ring-4 ring-rose-500/30 animate-pulse"
                : isLoading
                ? "bg-slate-700 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
            }`}
          >
            <MicActiveIcon className="w-5 h-5" />
            <span className="tracking-wider uppercase">
              {isHolding
                ? "Listening... chhodne pe bhejega"
                : isLoading
                ? "Mentor Soch Raha Hai..."
                : "Hold To Speak"}
            </span>
          </button>
          <p className="text-[10px] text-slate-500 text-center mt-1">
            Speak your doubt, release to get instant answer
          </p>
        </div>

        {/* ── Infinity Orb (default screen) + status card + live frequency bars ── */}
        <div className="flex-1 relative flex flex-col items-center justify-center gap-3 min-h-[210px] px-4">

          {/* Orb region — status overlays cover ONLY this area so the
              frequency bars below stay visible while listening / replying */}
          <div className="relative flex-1 w-full min-h-[120px] flex items-center justify-center">

            {/* Overlay: Listening (while holding) — live transcript */}
            {isHolding && (
              <div className="absolute inset-0 z-10 flex items-center justify-center p-2">
                <div className="w-full max-w-sm bg-slate-900/95 border border-teal-500/50 backdrop-blur-md rounded-3xl shadow-2xl p-4 animate-in fade-in zoom-in duration-200">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
                    <span className="text-[11px] font-black text-teal-300 uppercase tracking-wider">
                      Listening...
                    </span>
                  </div>
                  <p className="text-sm font-medium text-teal-100 italic min-h-[1.5rem]">
                    {holdTranscript || "Boliye... speak your doubt"}
                  </p>
                </div>
              </div>
            )}

            {/* Overlay: Thinking (AI is generating the reply) */}
            {!isHolding && isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center p-2 bg-slate-950/40 backdrop-blur-[2px]">
                <div className="w-full max-w-sm bg-slate-900/95 border border-indigo-500/40 rounded-3xl shadow-2xl p-4 flex items-center gap-3 animate-in fade-in zoom-in duration-200">
                  <span className="w-9 h-9 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">AI Mentor soch raha hai...</p>
                    {pendingUserText && (
                      <p className="text-[11px] text-slate-400 italic mt-0.5 truncate">
                        &quot;{pendingUserText}&quot;
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Overlay: Live AI reply output */}
            {!isHolding && !isLoading && liveReply && (
              <div className="absolute inset-0 z-10 flex items-center justify-center p-2">
                <div className="w-full max-w-sm max-h-full overflow-y-auto bg-slate-900/95 border border-violet-500/40 backdrop-blur-md rounded-3xl shadow-2xl p-4 animate-in fade-in zoom-in duration-200">
                  <div className="flex items-center gap-2 mb-2">
                    <MentorCapIcon className="w-4 h-4 text-violet-300" />
                    <span className="text-[11px] font-black text-violet-300 uppercase tracking-wider">
                      AI Mentor
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      {isSpeaking && (
                        <button
                          type="button"
                          onClick={stopSpeaking}
                          className="p-1.5 rounded-full bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 transition-colors"
                          title="Stop voice"
                        >
                          <StopSquareIcon />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          speakText(liveReply.ttsText || liveReply.text, liveReply.language)
                        }
                        className="p-1.5 rounded-full bg-teal-500/20 text-teal-300 hover:bg-teal-500/40 transition-colors"
                        title="Listen again"
                      >
                        <PlayTriangleIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLiveReply(null)}
                        className="p-1.5 rounded-full bg-slate-700/60 text-slate-300 hover:bg-slate-600 transition-colors"
                        title="Close"
                      >
                        <CloseIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
                    {liveReply.text}
                  </p>
                </div>
              </div>
            )}

            {/* Infinity symbol — glows on user speech (teal), colour change
                when the AI speaks (fuchsia) */}
            <div
              className={`relative flex items-center justify-center transition-transform duration-500 ${
                orbActive ? "scale-110" : "scale-100"
              }`}
            >
              <div
                className={`absolute w-44 h-44 rounded-full blur-3xl ${orbGlow} ${
                  orbActive ? "animate-pulse" : "opacity-70"
                }`}
              />
              <span
                className={`relative text-9xl font-black ${orbText} drop-shadow-2xl select-none leading-none`}
              >
                ∞
              </span>
            </div>
          </div>

          {/* Frequency bars — always-visible strip.
              Idle: static dots. Active: driven by the REAL voice (mic / TTS). */}
          {orbState === "idle" ? (
            <div
              className="flex items-center justify-center gap-[4px] h-2 shrink-0"
              aria-hidden="true"
            >
              {Array.from({ length: EQ_BAR_COUNT }, (_, i) => (
                <span
                  key={i}
                  className={`w-[4px] h-[5px] rounded-full opacity-40 ${orbText}`}
                />
              ))}
            </div>
          ) : (
            <div
              className={`flex items-end justify-center gap-[4px] h-12 shrink-0 ${orbText}`}
              aria-hidden="true"
            >
              {Array.from({ length: EQ_BAR_COUNT }, (_, i) => (
                <span
                  key={i}
                  ref={(el) => {
                    eqBarRefs.current[i] = el;
                  }}
                  className="mentor-eq-bar w-[4px] h-full rounded-full bg-current"
                  style={{
                    animationDelay: `${-(i * 0.09).toFixed(2)}s`,
                    animationDuration: "0.5s",
                    opacity: 0.95,
                  }}
                />
              ))}
            </div>
          )}

          <p className="text-[11px] text-slate-500 font-medium shrink-0">{orbCaption}</p>
        </div>

        {/* ── Mentor Session drawer — mentorship-log style (expand/collapse) ── */}
        <div
          className={`relative shrink-0 bg-slate-950 border-t border-indigo-900/40 transition-all duration-300 flex flex-col overflow-hidden ${
            hudMode === "expanded" ? "h-[42vh]" : "h-14"
          }`}
        >
          {/* grip handle */}
          <span className="absolute top-1 left-1/2 -translate-x-1/2 w-9 h-1 rounded-full bg-slate-700/70 pointer-events-none" />
          <div
            onClick={() => setHudMode((prev) => (prev === "expanded" ? "compact" : "expanded"))}
            className="w-full px-4 pt-2.5 pb-1.5 flex items-center justify-between cursor-pointer hover:bg-indigo-950/20 shrink-0"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                <SparkleIcon className="w-3.5 h-3.5 text-indigo-300" />
              </span>
              <span className="text-xs font-bold text-slate-100">Mentor Session</span>
              {messages.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-semibold">
                  {messages.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {messages.length > 0 && hudMode === "expanded" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearChat();
                  }}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
                  title="Clear session"
                >
                  <TrashIcon />
                  <span>Clear</span>
                </button>
              )}
              <span className="text-slate-400">
                {hudMode === "expanded" ? <ChevronDownIcon /> : <ChevronUpIcon />}
              </span>
            </div>
          </div>

          {hudMode === "expanded" ? (
            <div className="flex-1 overflow-y-auto px-4 pb-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <SparkleIcon className="w-8 h-8 mb-2 text-indigo-400/50" />
                  <p className="text-xs font-semibold text-slate-300">Session abhi khaali hai</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Hold to Speak dabakar ya type karke apna doubt puchiye.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* timeline rail */}
                  <div className="absolute left-[4px] top-4 bottom-4 w-px bg-gradient-to-b from-indigo-500/40 via-violet-500/20 to-transparent" />
                  <div className="space-y-4">
                    {messages.map((m) => (
                      <div key={m.id} className="relative pl-5">
                        <span
                          className={`absolute left-0 top-4 w-[9px] h-[9px] rounded-full ring-4 ring-slate-950 ${
                            m.sender === "user" ? "bg-indigo-400" : "bg-violet-400"
                          }`}
                        />
                        <div
                          className={`rounded-2xl rounded-tl-md border p-3 ${
                            m.sender === "user"
                              ? "ml-6 bg-indigo-950/40 border-indigo-500/25"
                              : "bg-violet-950/30 border-violet-500/25"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                                m.sender === "user"
                                  ? "bg-indigo-500/20 text-indigo-200"
                                  : "bg-violet-500/20 text-violet-200"
                              }`}
                            >
                              {m.sender === "user" ? "Y" : "M"}
                            </span>
                            <span
                              className={`text-[11px] font-bold ${
                                m.sender === "user" ? "text-indigo-300" : "text-violet-300"
                              }`}
                            >
                              {m.sender === "user" ? "You" : "Mentor"}
                            </span>
                            <span className="ml-auto text-[10px] text-slate-500">
                              {formatTime(m.timestamp)}
                            </span>
                          </div>
                          <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-200">
                            {m.text}
                          </div>
                          {m.sender === "ai" && (
                            <div className="mt-2 pt-2 border-t border-violet-500/15 flex justify-end">
                              <button
                                type="button"
                                onClick={() => replayTTS(m)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/35 hover:bg-violet-500/20 transition-colors"
                              >
                                <SpeakerIcon />
                                <span>Listen</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div ref={drawerBottomRef} />
            </div>
          ) : (
            <div className="flex-1 px-4 flex items-center overflow-hidden">
              {messages.length > 0 ? (
                <span className="truncate text-[11px] text-slate-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shrink-0" />
                  <span
                    className={`font-bold ${
                      messages[messages.length - 1].sender === "ai"
                        ? "text-violet-300"
                        : "text-indigo-300"
                    }`}
                  >
                    {messages[messages.length - 1].sender === "ai" ? "Mentor:" : "You:"}
                  </span>
                  {messages[messages.length - 1].text.slice(0, 90)}
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 italic">
                  Apni mentorship session yahan dikhegi...
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="px-4 pb-2 shrink-0">
            <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-[11px] font-medium text-center">
              {error}
            </div>
          </div>
        )}

        {/* ── Input row: mic fills text, chat button sends ── */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={toggleMic}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md transition-all shrink-0 ${
                isMicActive
                  ? "bg-rose-500 hover:bg-rose-600"
                  : "bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700"
              }`}
              title={isMicActive ? "Stop listening" : "Speech to Text (fills chat box)"}
            >
              {isMicActive ? (
                <MicMutedIcon className="w-5 h-5" />
              ) : (
                <MicActiveIcon className="w-5 h-5" />
              )}
            </button>
            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isSpeaking ? "Mentor bol raha hai..." : "Type your message..."}
                rows={1}
                className="w-full p-3 pr-10 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                disabled={isLoading}
              />
              {isSpeaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 transition-colors"
                  title="Stop speaking"
                >
                  <StopSquareIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isLoading}
              className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0 hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send chat"
            >
              <SendIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
