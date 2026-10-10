"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

// ============================================================================
// CLEAN INLINE SVG ICONS (Accurate Symbols & Zero Glitches)
// ============================================================================
const CloseIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CameraSwitchIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// 1. Flashlight ON: Filled vibrant glowing bulb, NO cut line
const TorchOnIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm-2 17h4v1c0 .55-.45 1-1 1h-2c-.55 0-1-.45-1-1v-1z" />
  </svg>
);

// 2. Flashlight OFF: Outlined bulb with a clean diagonal cut line
const TorchOffIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18h6m-5 3h4m-7.2-7.5A6.5 6.5 0 0112 3.5c1.8 0 3.4.7 4.6 1.9M8 12.5C7.4 11.5 7 10.3 7 9c0-.6.1-1.2.2-1.7M17 12.5c.3-.7.5-1.5.5-2.5 0-1.2-.4-2.3-1-3.2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
  </svg>
);

// 3. Mic ACTIVE (Unmuted) Icon
const MicActiveIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

// 4. Mic MUTED (Disabled/Mute) Icon with clean diagonal cut
const MicMutedIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-1.2 3.9M12 18a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5c0-.4.1-.8.2-1.2M9.4 4.3A3 3 0 0115 5v5.2M3 3l18 18" />
  </svg>
);

const TrashIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ChatBubbleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const CopyCheckIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const CopyDefaultIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const StopSquareIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const PlayTriangleIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
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

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================
interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  // Native-script speech text (API tts_text); UI always shows text.
  ttsText?: string;
  time: string;
  timestamp?: number;
}

interface LiveVideoCallModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  studentContext?: {
    weakChapters?: string[];
    classLevel?: string;
    targetExam?: string;
  } | any;
}

const CACHE_KEY_MESSAGES = "prepwise_live_session_messages_v1";
const AUDIO_CACHE_PREFIX = "prepwise_live_tts_";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // Strict 24 Hours Retention Limit

// ============================================================================
// 24-HOUR AUTO STORAGE PURGE (Guarantees zero storage bloat & low Supabase usage)
// ============================================================================
function purgeExpiredSessionData() {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const keysToRemove: string[] = [];

    // 1. Purge messages older than 24h
    const stored = localStorage.getItem(CACHE_KEY_MESSAGES);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.timestamp && now - parsed.timestamp > CACHE_EXPIRY_MS) {
          keysToRemove.push(CACHE_KEY_MESSAGES);
        }
      } catch (_) {
        keysToRemove.push(CACHE_KEY_MESSAGES);
      }
    }

    // 2. Purge cached TTS blobs
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(AUDIO_CACHE_PREFIX)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const parsed = JSON.parse(item);
            if (parsed.timestamp && now - parsed.timestamp > CACHE_EXPIRY_MS) {
              keysToRemove.push(key);
            }
          }
        } catch (_) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (_) {}
}

// ============================================================================
// 24-HOUR TTS AUDIO CACHE (Zero API requests on "Listen Again" replays)
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

function getCacheAudio(chunk: string): { base64: string; type: string } | null {
  try {
    const key = AUDIO_CACHE_PREFIX + ttsHash(chunk);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.base64) {
      localStorage.removeItem(key);
      return null;
    }
    if (parsed.timestamp && Date.now() - parsed.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return { base64: parsed.base64, type: parsed.type || "audio/wav" };
  } catch (_) {
    return null;
  }
}

function evictOldestCachedAudio() {
  try {
    let oldestKey: string | null = null;
    let oldestTs = Infinity;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(AUDIO_CACHE_PREFIX)) {
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

function cacheAudioBlob(chunk: string, blob: Blob) {
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
        const key = AUDIO_CACHE_PREFIX + ttsHash(chunk);
        const payload = JSON.stringify({ timestamp: Date.now(), type: blob.type, base64 });
        try {
          localStorage.setItem(key, payload);
        } catch (_) {
          evictOldestCachedAudio();
          try {
            localStorage.setItem(key, payload);
          } catch (_) {}
        }
      } catch (_) {}
    }).catch(() => {});
  } catch (_) {}
}

// ============================================================================
// NATURAL SPOKEN SCRIPT FILTER & ACADEMIC PRONUNCIATION NORMALIZER
// ============================================================================
function cleanTextForSpeech(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // 1. Remove Markdown syntax & asterisks
  text = text.replace(/[*#`_~\[\](){}]/g, " ");
  text = text.replace(/Step \d+:\s*/gi, "");

  // 2. Normalizing pauses: Multiple commas, ellipses, and semicolons to continuous speech
  text = text.replace(/\.{2,}/g, " ");
  text = text.replace(/,{2,}/g, " ");
  text = text.replace(/[:;-]{2,}/g, " ");
  text = text.replace(/[:;]/g, " ");

  // 3. Indian Faculty Academic Pronunciation Dictionaries
  text = text.replace(/\bapprox\b/gi, "lagbhag");
  text = text.replace(/\beqn\b|\beq\b/gi, "equation");
  text = text.replace(/\bw\.r\.t\b/gi, "with respect to");
  text = text.replace(/\bi\.e\b/gi, "yaani ki");
  text = text.replace(/\be\.g\b/gi, "for example");
  text = text.replace(/\bfig\b/gi, "figure");
  text = text.replace(/\bconst\b/gi, "constant");
  text = text.replace(/\bmag\b/gi, "magnification");
  text = text.replace(/\bdiff\b/gi, "differentiation");
  text = text.replace(/\bint\b/gi, "integration");

  // 4. Common Optics & Physics Subscripts (Compound Microscope & Mechanics)
  text = text.replace(/\bvo\b/gi, "v objective");
  text = text.replace(/\buo\b/gi, "u objective");
  text = text.replace(/\bfo\b/gi, "f objective");
  text = text.replace(/\bfe\b/gi, "f eyepiece");
  text = text.replace(/\bMo\b/gi, "M objective");
  text = text.replace(/\bMe\b/gi, "M eyepiece");

  // 5. Mathematical Operators to Spoken Words
  text = text.replace(/\+/g, " plus ");
  text = text.replace(/\s-\s/g, " minus ");
  text = text.replace(/\s\*\s|\s×\s/g, " into ");
  text = text.replace(/\s\/\s|\s÷\s/g, " divided by ");
  text = text.replace(/\s=\s/g, " equals ");
  text = text.replace(/\s≈\s/g, " approximately equals ");

  // 6. Aggressively strip mid-sentence commas & hinge pauses so speech flows seamlessly
  text = text.replace(/,\s*(hai|ki|toh|aur|se|mein|ka|ke|ko|par|jab|tab|isliye|kyuki|lekin)\b/gi, " $1");
  text = text.replace(/([a-zA-Z0-9]+),\s*([a-zA-Z0-9]+)/g, "$1 $2");
  text = text.replace(/,/g, " ");

  text = text.replace(/\s+/g, " ").trim();
  return text;
}

// ============================================================================
// TEXTBOOK MATH FORMATTER (Converts raw LaTeX into readable textbook format)
// ============================================================================
function normalizeMathToTextbook(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // Fractions: \frac{a}{b} -> (a / b)
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)");

  // Square roots: \sqrt{x} -> √(x)
  text = text.replace(/\\sqrt\{([^}]+)\}/g, "√($1)");

  // Common Greek symbols
  text = text.replace(/\\mu/g, "μ");
  text = text.replace(/\\theta/g, "θ");
  text = text.replace(/\\lambda/g, "λ");
  text = text.replace(/\\omega/g, "ω");
  text = text.replace(/\\alpha/g, "α");
  text = text.replace(/\\beta/g, "β");
  text = text.replace(/\\gamma/g, "γ");
  text = text.replace(/\\delta|\\Delta/g, "Δ");
  text = text.replace(/\\pi/g, "π");

  // Subscripts & Superscripts
  text = text.replace(/_\{([^}]+)\}/g, "_$1");
  text = text.replace(/\^\{2\}/g, "²");
  text = text.replace(/\^\{3\}/g, "³");
  text = text.replace(/\^\{([^}]+)\}/g, "^$1");

  // Clean remaining LaTeX slashes
  text = text.replace(/\\times/g, "×");
  text = text.replace(/\\div/g, "÷");
  text = text.replace(/\\pm/g, "±");
  text = text.replace(/\\approx/g, "≈");
  text = text.replace(/\\le|\\leq/g, "≤");
  text = text.replace(/\\ge|\\geq/g, "≥");
  text = text.replace(/\\infty/g, "∞");
  text = text.replace(/\\to|\\rightarrow/g, "→");
  text = text.replace(/\\implies/g, "⇒");
  text = text.replace(/\\left|\\right/g, "");
  text = text.replace(/\\text\{([^}]+)\}/g, "$1");
  text = text.replace(/\\mathrm\{([^}]+)\}/g, "$1");
  text = text.replace(/\\mathbf\{([^}]+)\}/g, "$1");
  text = text.replace(/\\/g, "");

  return text;
}

// ============================================================================
// MAIN COMPONENT: LiveVideoCallModal
// ============================================================================
export default function LiveVideoCallModal({
  isOpen,
  open,
  onClose,
  studentContext,
}: LiveVideoCallModalProps) {
  const modalOpen = open !== undefined ? open : (isOpen ?? false);
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(modalOpen);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isHoldingMic, setIsHoldingMic] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hudMode, setHudMode] = useState<"compact" | "expanded">("compact");
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [activeSpeechMessageId, setActiveSpeechMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [flashTrigger, setFlashTrigger] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isAudioQueuePlayingRef = useRef(false);
  const speechInterruptRef = useRef(false);
  const transcriptRef = useRef("");
  // Committed (isFinal) speech text only — survives interim-result overwrites
  const finalTranscriptRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Sync Open state
  useEffect(() => {
    setIsModalOpen(modalOpen);
  }, [modalOpen]);

  // 1. Initial 24h Data Storage & Load
  useEffect(() => {
    if (isModalOpen) {
      purgeExpiredSessionData();
      try {
        const stored = localStorage.getItem(CACHE_KEY_MESSAGES);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.items && Array.isArray(parsed.items)) {
            setMessages(parsed.items);
          }
        }
      } catch (_) {}
    }
  }, [isModalOpen]);

  // Save messages to 24h local storage
  const saveMessagesToStorage = useCallback((msgs: Message[]) => {
    try {
      localStorage.setItem(
        CACHE_KEY_MESSAGES,
        JSON.stringify({ timestamp: Date.now(), items: msgs.slice(-30) })
      );
    } catch (_) {}
  }, []);

  // Manual Clear Chat (Supabase + LocalStorage Saver)
  const handleManualClearChat = useCallback(() => {
    setMessages([]);
    try {
      localStorage.removeItem(CACHE_KEY_MESSAGES);
    } catch (_) {}
  }, []);

  // 2. Call Duration Timer
  useEffect(() => {
    if (isModalOpen) {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isModalOpen]);

  // Format Duration seconds -> mm:ss
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  // 3. Camera Setup & Streaming
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Check for torch track capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && typeof videoTrack.getCapabilities === "function") {
        const capabilities: any = videoTrack.getCapabilities();
        setHasTorch(Boolean(capabilities && capabilities.torch));
      } else {
        setHasTorch(false);
      }
    } catch (err) {
      console.error("[LiveVideoCallModal] Camera start error:", err);
    }
  }, [facingMode]);

  // Handle Torch Toggle
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !hasTorch) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      try {
        const nextTorch = !isTorchOn;
        await (videoTrack as any).applyConstraints({
          advanced: [{ torch: nextTorch }],
        });
        setIsTorchOn(nextTorch);
      } catch (e) {
        console.error("[LiveVideoCallModal] Torch error:", e);
      }
    }
  }, [hasTorch, isTorchOn]);

  // Switch Camera Direction (Rear <-> Front)
  const toggleCameraDirection = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  // Initialize camera when opened
  useEffect(() => {
    if (isModalOpen) {
      startCamera();
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      stopSpeaking();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isModalOpen, startCamera]);

  // 4. Capture Frame helper (Optimized JPEG snapshot for Live Vision Gemini)
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  }, []);

  // 5. Speech Recognition Setup (Web Speech API)
  const initSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return null;
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    // Dynamic language: student's selected language if provided, else English-India
    recognition.lang = studentContext?.language || "en-IN";

    // FIXED (v2): SpeechRecognition continuous mode me har event par event.results
    // me PURANE final results bhi rehte hain. Pehle hum 0 se loop karke unhe dobara
    // add kar rahe the -> "explain explain explain..." duplicates. Ab:
    // - Sirf resultIndex se aage ke NAYE results hi commit karo (no duplicates).
    // - Interim display ke liye poora scan theek hai (wo commit nahi hota).
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i];
        if (res.isFinal) {
          // CUMULATIVE-FINAL GUARD: kuch Android engines har final me pura utterance
          // dobara bhejte hain ("explain me" -> "explain me the" -> ...). Us case me
          // naive append se text quadratically duplicate ho jata hai. Guard:
          const t = res[0].transcript.trim();
          if (!t) continue;
          const committed = finalTranscriptRef.current.trim();
          if (!committed) {
            finalTranscriptRef.current = t + " ";
          } else if (committed.toLowerCase().includes(t.toLowerCase())) {
            // Ye final pehle se covered hai — duplicate, skip
          } else if (t.toLowerCase().includes(committed.toLowerCase())) {
            // Engine ne pura (extended) utterance resend kiya — replace karo
            finalTranscriptRef.current = t + " ";
          } else {
            finalTranscriptRef.current += t + " ";
          }
        } else {
          interim += res[0].transcript;
        }
      }
      // Interim display: committed finals + current interim overlay
      let interimOnly = "";
      for (let i = 0; i < event.results.length; ++i) {
        if (!event.results[i].isFinal) interimOnly += event.results[i][0].transcript;
      }
      transcriptRef.current = (finalTranscriptRef.current + " " + interimOnly).trim();
      setTranscript(transcriptRef.current);
    };

    recognition.onerror = (e: any) => {
      console.warn("[LiveVideoCallModal] Speech recognition warning:", e.error);
    };

    return recognition;
  }, [studentContext]);

  // 6. Audio Player Queue & TTS (Edge Speech API)
    // Progressive chunk sizes: early chunks small so speech starts fast,
  // later chunks large so long solutions need far fewer TTS API calls.
  const PROGRESSIVE_CHUNK_SIZES = [140, 240, 420, 650, 900];
  const splitIntoSpeechChunks = (text: string): string[] => {
    const parts = text.match(/[^.!?।॥]+[.!?।॥]*/g) || [text];
    const chunks: string[] = [];
    let current = "";
    let chunkIdx = 0;
    for (const part of parts) {
      const p = part.trim();
      if (!p) continue;
      const maxLen = PROGRESSIVE_CHUNK_SIZES[Math.min(chunkIdx, PROGRESSIVE_CHUNK_SIZES.length - 1)];
      if (current && (current + " " + p).length > maxLen) {
        chunks.push(current);
        current = p;
        chunkIdx++;
      } else {
        current = current ? current + " " + p : p;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  };

  // Prefetch: fetch + cache a chunk in the background WITHOUT playing it,
  // so the next chunk is ready by the time the current one finishes playing.
  const prefetchChunk = (chunk: string) => {
    if (getCacheAudio(chunk)) return; // already cached, no request needed
    fetch("/api/ai-doubt/live/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunk }),
    })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (blob && blob.type && blob.type !== "application/json") {
          cacheAudioBlob(chunk, blob);
        }
      })
      .catch(() => {});
  };

  // Play one chunk via server TTS, served from the 24h audio cache when available.
  // Falls back to browser speechSynthesis if the route fails.
  const playSingleChunk = (chunk: string): Promise<void> => {
    return new Promise<void>(async (resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      const playBlob = async (blob: Blob) => {
        const audio = new Audio(URL.createObjectURL(blob));
        currentAudioRef.current = audio;
        audio.onended = done;
        audio.onerror = done;
        audio.onpause = done;
        await audio.play();
      };

      // 1. CACHE HIT: replay cached audio with zero API requests
      const cached = getCacheAudio(chunk);
      if (cached) {
        try {
          await playBlob(base64ToBlob(cached.base64, cached.type));
          return;
        } catch (_) {
          try { localStorage.removeItem(AUDIO_CACHE_PREFIX + ttsHash(chunk)); } catch (_) {}
        }
      }

      // 2. CACHE MISS: fetch from server TTS and store for 24h
      try {
        const res = await fetch("/api/ai-doubt/live/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunk }),
        });
        if (res.ok) {
          const blob = await res.blob();
          if (blob.type && blob.type !== "application/json") {
            cacheAudioBlob(chunk, blob);
          }
          await playBlob(blob);
          return;
        }
      } catch (_) {}
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(chunk);
          // Detect language from script so non-Hindi fallback speech also pronounces right
          if (/[ঀ-৿]/.test(chunk)) utterance.lang = "bn-IN";
          else if (/[઀-૿]/.test(chunk)) utterance.lang = "gu-IN";
          else if (/[஀-௿]/.test(chunk)) utterance.lang = "ta-IN";
          else if (/[ఀ-౿]/.test(chunk)) utterance.lang = "te-IN";
          else if (/[ಀ-೿]/.test(chunk)) utterance.lang = "kn-IN";
          else if (/[ഀ-ൿ]/.test(chunk)) utterance.lang = "ml-IN";
          else if (/[਀-੿]/.test(chunk)) utterance.lang = "pa-IN";
          else if (/[ऀ-ॿ]/.test(chunk)) utterance.lang = "hi-IN";
          else utterance.lang = "en-IN";
          utterance.rate = 1.05;
          const heartbeat = setInterval(() => {
            try {
              if (window.speechSynthesis.speaking) {
                window.speechSynthesis.pause();
                window.speechSynthesis.resume();
              }
            } catch (_) {}
          }, 8000);
          const finish = () => {
            clearInterval(heartbeat);
            done();
          };
          utterance.onend = finish;
          utterance.onerror = finish;
          window.speechSynthesis.speak(utterance);
          return;
        }
      } catch (_) {}
      done();
    });
  };

  const playAudioChunk = useCallback(
    async (textToSpeak: string, msgId: string) => {
      if (isMuted) return;
      const cleanedSpeech = cleanTextForSpeech(textToSpeak);
      if (!cleanedSpeech) return;

      // Stop any in-flight speech session before starting a new one
      try {
        if (currentAudioRef.current) currentAudioRef.current.pause();
      } catch (_) {}
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch (_) {}
      currentAudioRef.current = null;
      speechInterruptRef.current = false;
      setIsAiSpeaking(true);
      setActiveSpeechMessageId(msgId);

      // Queue and play chunks sequentially (progressive sizes, no URL length limits)
      const chunks = splitIntoSpeechChunks(cleanedSpeech);
      audioQueueRef.current = chunks;
      isAudioQueuePlayingRef.current = true;
      // While a chunk plays, prefetch the next one in the background
      if (chunks[1]) prefetchChunk(chunks[1]);
      for (let i = 0; i < chunks.length; i++) {
        if (speechInterruptRef.current) break;
        if (chunks[i + 1]) prefetchChunk(chunks[i + 1]);
        await playSingleChunk(chunks[i]);
      }
      isAudioQueuePlayingRef.current = false;
      audioQueueRef.current = [];
      setIsAiSpeaking(false);
      setActiveSpeechMessageId(null);
    },
    [isMuted]
  );

const stopSpeaking = useCallback(() => {
      speechInterruptRef.current = true;
      try {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current.currentTime = 0;
        }
      } catch (_) {}
      currentAudioRef.current = null;
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch (_) {}
      setIsAiSpeaking(false);
      setActiveSpeechMessageId(null);
    }, []);

  // 7. Push-To-Talk Handlers (Hold To Talk)
  const handleHoldStart = useCallback(() => {
    if (isAnalyzing) return;
    stopSpeaking();
    setIsHoldingMic(true);
    setTranscript("");
    transcriptRef.current = "";
    finalTranscriptRef.current = "";

    try {
      if (!recognitionRef.current) {
        recognitionRef.current = initSpeechRecognition();
      }
      recognitionRef.current?.start();
    } catch (_) {}
  }, [isAnalyzing, stopSpeaking, initSpeechRecognition]);

  const handleHoldEnd = useCallback(async () => {
    if (!isHoldingMic) return;
    setIsHoldingMic(false);

    try {
      recognitionRef.current?.stop();
    } catch (_) {}

    // GRACE PERIOD: recognition ke final onresult buffer ko catch karne ke liye
    // thoda wait karo warna last spoken words miss ho jate hain
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Duplicate consecutive-word collapse (engine kabhi-kabhi same final do baar deta hai)
    const collapsed = transcriptRef.current
      .trim()
      .split(/\s+/)
      .filter((w, i, arr) => i === 0 || w.toLowerCase() !== arr[i - 1].toLowerCase())
      .join(" ");
    const queryText = collapsed;
    // Trigger visual shutter flash
    setFlashTrigger(true);
    setTimeout(() => setFlashTrigger(false), 300);

    const frame = captureFrame();

    // Add user message to UI
    const userMsgId = `user_${Date.now()}`;
    const newMessages: Message[] = [
      ...messages,
      {
        id: userMsgId,
        sender: "user",
        text: queryText || "Camera frame question",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        timestamp: Date.now(),
      },
    ];

    setMessages(newMessages);
    saveMessagesToStorage(newMessages);
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/ai-doubt/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frame,
          message: queryText,
          studentContext: studentContext?.language
            ? { ...studentContext, language: studentContext.language }
            : studentContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Live API returned ${response.status}`);
      }

      const data = await response.json();
      const aiReply = data.reply || "Main is question ko analyze nahi kar paya. Kripya dobara clear frame dikhayein.";

      const aiMsgId = `ai_${Date.now()}`;
      const updatedWithAi: Message[] = [
        ...newMessages,
        {
          id: aiMsgId,
          sender: "ai",
          text: aiReply,
          ttsText: data.tts_text || aiReply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          timestamp: Date.now(),
        },
      ];

      setMessages(updatedWithAi);
      saveMessagesToStorage(updatedWithAi);

      // Play Voice Output automatically
      if (!isMuted) {
        playAudioChunk(data.tts_text || aiReply, aiMsgId);
      }
    } catch (e: any) {
      console.error("[LiveVideoCallModal] Request error:", e);
      const errMsgId = `ai_err_${Date.now()}`;
      const updatedWithError: Message[] = [
        ...newMessages,
        {
          id: errMsgId,
          sender: "ai",
          text: "Server traffic high hai. Kripya 2 second baad fir se button dabakar puchiye.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          timestamp: Date.now(),
        },
      ];
      setMessages(updatedWithError);
      saveMessagesToStorage(updatedWithError);
    } finally {
      setIsAnalyzing(false);
      setTranscript("");
      transcriptRef.current = "";
      finalTranscriptRef.current = "";
    }
  }, [
    isHoldingMic,
    captureFrame,
    messages,
    saveMessagesToStorage,
    studentContext,
    isMuted,
    playAudioChunk,
  ]);

  // 8. Copy to clipboard
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Scroll to bottom of drawer
  useEffect(() => {
    if (hudMode === "expanded") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, hudMode]);

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-between overflow-hidden select-none">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Shutter Flash Animation Effect */}
      {flashTrigger && (
        <div className="absolute inset-0 bg-white/70 z-50 pointer-events-none animate-out fade-out duration-300" />
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. HEADER BAR: CALL DURATION, TORCH, SWITCH CAM, CLOSE
          ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 z-40 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 flex items-center justify-between">
        {/* Call Status & Timer Badge */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur border border-slate-700/80 text-xs font-semibold text-teal-400">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>AI Faculty Live</span>
            <span className="text-slate-400 font-mono ml-1">{formatTime(callDuration)}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Torch / Flashlight Button */}
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`p-2.5 rounded-full transition-all border ${
                isTorchOn
                  ? "bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/40"
                  : "bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800"
              }`}
              title="Toggle Flashlight"
            >
              {isTorchOn ? <TorchOnIcon /> : <TorchOffIcon />}
            </button>
          )}

          {/* Flip Camera */}
          <button
            type="button"
            onClick={toggleCameraDirection}
            className="p-2.5 rounded-full bg-slate-900/80 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-all"
            title="Flip Camera"
          >
            <CameraSwitchIcon />
          </button>

          {/* Close Modal */}
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full bg-rose-600/90 hover:bg-rose-600 text-white transition-all shadow-lg active:scale-95"
            title="End Call"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. FULLSCREEN VIDEO FEED (Real-time Video Surface)
          ───────────────────────────────────────────────────────────── */}
      <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${
            facingMode === "user" ? "-scale-x-100" : ""
          }`}
        />

        {/* Dynamic Aim Reticle Overlay (Helps student position textbook equations) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
          <div className="w-full max-w-sm aspect-[4/3] rounded-3xl border-2 border-dashed border-teal-400/40 relative flex items-center justify-center">
            {/* Corner Indicators */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-teal-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-teal-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-teal-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-teal-400 rounded-br-lg" />

            {/* Instruction tooltip */}
            <span className="text-[11px] font-medium text-teal-200/80 bg-slate-950/70 px-3 py-1 rounded-full border border-teal-500/20 backdrop-blur">
              Point camera at question, notes, or diagram
            </span>
          </div>
        </div>

        {/* LIVE AUDIO WAVE / SPEAKING PULSE BADGE */}
        {isAiSpeaking && (
          <div className="absolute top-20 z-30 flex items-center space-x-2 bg-teal-950/80 border border-teal-500/40 px-3.5 py-1.5 rounded-full backdrop-blur shadow-xl animate-bounce">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
            <span className="text-xs font-semibold text-teal-200">AI Faculty Speaking...</span>
            <button
              type="button"
              onClick={stopSpeaking}
              className="ml-2 p-1 rounded-full bg-rose-500/30 hover:bg-rose-500/50 text-rose-300"
              title="Stop audio"
            >
              <StopSquareIcon />
            </button>
          </div>
        )}

        {/* ANALYZING LOADER OVERLAY */}
        {isAnalyzing && (
          <div className="absolute inset-0 z-30 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center mb-4 animate-pulse">
              <span className="w-8 h-8 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Kota AI Faculty Solving...</h3>
            <p className="text-xs text-teal-200/80 max-w-xs">
              Handwritten steps & diagram analyze ho rahe hain...
            </p>
          </div>
        )}

        {/* LIVE REAL-TIME TRANSCRIPT BADGE (While holding mic) */}
        {isHoldingMic && (
          <div className="absolute bottom-28 z-30 inset-x-6 flex justify-center pointer-events-none">
            <div className="bg-slate-900/90 border border-teal-500/50 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl max-w-md w-full text-center">
              <p className="text-xs text-slate-400 mb-0.5">Suno aur bolo...</p>
              <p className="text-sm font-semibold text-teal-300 italic">
                {transcript || "Speak your doubt now..."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. SOLUTION STEPS DRAWER (HUD DRAWER - COMPACT / EXPANDED)
          ───────────────────────────────────────────────────────────── */}
      <div
        className={`absolute inset-x-0 bottom-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 transition-all duration-300 flex flex-col ${
          hudMode === "expanded" ? "h-[70vh]" : "h-24"
        }`}
      >
        {/* Drawer Drag Bar & Header */}
        <div
          onClick={() => setHudMode((prev) => (prev === "compact" ? "expanded" : "compact"))}
          className="w-full py-2.5 px-4 flex items-center justify-between cursor-pointer border-b border-slate-800/60 hover:bg-slate-900/40"
        >
          <div className="flex items-center space-x-2">
            <ChatBubbleIcon className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold text-slate-200">
              Solution Steps & Notes
            </span>
            {messages.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-semibold">
                {messages.length}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {messages.length > 0 && hudMode === "expanded" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleManualClearChat();
                }}
                className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
                title="Clear Notes"
              >
                <TrashIcon />
                <span>Clear</span>
              </button>
            )}
            <div className="text-slate-400">
              {hudMode === "expanded" ? <ChevronDownIcon /> : <ChevronUpIcon />}
            </div>
          </div>
        </div>

        {/* EXPANDED CONTENT: SCROLLABLE CHAT & SOLUTION STEPS */}
        {hudMode === "expanded" ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <ChatBubbleIcon className="w-8 h-8 mb-2 opacity-40 text-teal-400" />
                <p className="text-xs">Abhi koi solution notes nahi hain.</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Hold to Ask dabakar sawal boliye ya type karein.
                </p>
              </div>
            ) : (
              messages.map((m: Message) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-2xl text-xs ${
                    m.sender === "user"
                      ? "bg-teal-950/70 border border-teal-500/30 text-teal-100 ml-4 text-right"
                      : "bg-slate-800/90 border border-slate-700/60 text-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-[11px] text-teal-400">
                      {m.sender === "user" ? "You" : "Kota AI Faculty"}
                    </span>
                    <span className="text-[10px] text-slate-400">{m.time}</span>
                  </div>

                  {/* Formatted Solution Text */}
                  <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-200">
                    {normalizeMathToTextbook(m.text)}
                  </div>

                  {/* Solution Card Actions */}
                  {m.sender === "ai" && (
                    <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {/* Play / Stop Audio Button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (activeSpeechMessageId === m.id && isAiSpeaking) {
                              stopSpeaking();
                            } else {
                              playAudioChunk(m.ttsText || m.text, m.id);
                            }
                          }}
                          className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                            activeSpeechMessageId === m.id && isAiSpeaking
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : "bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-500/30"
                          }`}
                        >
                          {activeSpeechMessageId === m.id && isAiSpeaking ? (
                            <>
                              <StopSquareIcon />
                              <span>Stop Voice</span>
                            </>
                          ) : (
                            <>
                              <PlayTriangleIcon />
                              <span>Listen Again</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Copy Solution */}
                      <button
                        type="button"
                        onClick={() => handleCopy(m.text, m.id)}
                        className="flex items-center space-x-1 text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded-md bg-slate-900/60 border border-slate-700/60"
                        title="Copy solution text"
                      >
                        {copiedId === m.id ? (
                          <>
                            <CopyCheckIcon className="text-teal-400" />
                            <span className="text-teal-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <CopyDefaultIcon />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={chatBottomRef} />
          </div>
        ) : (
          /* COMPACT LATEST MESSAGE PREVIEW (1-line ticker) */
          <div className="px-4 py-1 flex items-center justify-between text-xs text-slate-300 truncate">
            {messages.length > 0 ? (
              <span className="truncate text-[11px] text-slate-300">
                <span className="text-teal-400 font-bold mr-1">Latest:</span>
                {messages[messages.length - 1].text.slice(0, 90)}...
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 italic">
                Hold to Ask dabakar doubt puchiye...
              </span>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            4. BOTTOM CONTROLS BAR: MUTE, HOLD TO TALK, DRAWER TOGGLE, END
            ───────────────────────────────────────────────────────────── */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-around">
          {/* 1. Mute / Unmute Speaker Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextMute = !isMuted;
              setIsMuted(nextMute);
              if (nextMute) stopSpeaking();
            }}
            className={`p-3.5 rounded-full transition-all active:scale-95 shadow-xl ${
              isMuted
                ? "bg-rose-900/80 text-rose-300 border border-rose-600 ring-2 ring-rose-500/30"
                : "bg-slate-800/90 text-slate-200 border border-slate-700 hover:bg-slate-700"
            }`}
            title={isMuted ? "Unmute Voice" : "Mute Voice"}
          >
            {isMuted ? <MicMutedIcon className="w-5 h-5 text-rose-400" /> : <MicActiveIcon className="w-5 h-5" />}
          </button>

          {/* 2. HOLD TO ASK (MAIN ACTION BUTTON) */}
          <button
            type="button"
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onTouchStart={(e) => { e.preventDefault(); handleHoldStart(); }}
            onTouchEnd={(e) => { e.preventDefault(); handleHoldEnd(); }}
            onContextMenu={(e) => e.preventDefault()}
            style={{ touchAction: "none" }}
            disabled={isAnalyzing}
            className={`px-8 py-3.5 rounded-full flex items-center space-x-2.5 font-bold transition-all shadow-2xl select-none active:scale-95 ${
              isHoldingMic
                ? "bg-rose-600 text-white shadow-rose-600/50 scale-105 ring-4 ring-rose-500/30"
                : isAnalyzing
                ? "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700"
                : "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white shadow-teal-500/30"
            }`}
          >
            <MicActiveIcon className="w-5 h-5" />
            <div className="flex items-center space-x-1.5">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  isHoldingMic
                    ? "bg-white animate-ping"
                    : "bg-teal-200 animate-pulse"
                }`}
              />
              <span className="tracking-wider uppercase font-black text-xs">
                {isHoldingMic ? "Listening..." : isAnalyzing ? "Solving..." : "Hold To Ask"}
              </span>
            </div>
          </button>

          {/* 3. Messages / Solutions Drawer Toggle */}
          <button
            type="button"
            onClick={() =>
              setHudMode((prev: "compact" | "expanded") => (prev === "compact" ? "expanded" : "compact"))
            }
            className={`p-3.5 rounded-full transition-all active:scale-95 shadow-xl ${
              hudMode === "expanded"
                ? "bg-teal-600 text-white border border-teal-400 ring-2 ring-teal-400/40"
                : "bg-slate-800/90 text-slate-300 border border-slate-700 hover:bg-slate-700"
            }`}
            title="Toggle Solution Steps & Chat"
          >
            <ChatBubbleIcon className="w-5 h-5" />
          </button>

          {/* 4. End Call Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-3.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl active:scale-95 transition-all border border-rose-500"
            title="End Video Call"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
