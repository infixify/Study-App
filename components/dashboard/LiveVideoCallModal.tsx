import React, { useState, useRef, useEffect, useCallback } from "react";

// ============================================================================
// CLEAN INLINE SVG ICONS (Accurate Symbols & Zero Unicode Glitches)
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

// FLASHLIGHT ON: Bulb with glowing amber color, no diagonal cut
const FlashlightOnIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path
      fill="#F59E0B"
      stroke="#F59E0B"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
);

// FLASHLIGHT OFF: Simple bulb outline WITH a clean diagonal cut line across it
const FlashlightOffIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
    <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
  </svg>
);

// MIC ON (Unmuted)
const MicActiveIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

// MIC OFF (Muted with diagonal slash)
const MicMutedIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-1.22 3.93M12 18a6.97 6.97 0 01-5-2.07M12 18v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V7m6 0a3 3 0 00-5.12-2.12" />
    <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
  </svg>
);

const ChatBubbleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const TrashIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

// ============================================================================
// DATA MODELS & CONSTANTS
// ============================================================================
export interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  time: string;
  isStreaming?: boolean;
  modelUsed?: string;
  provider?: string;
}

export interface LiveVideoCallModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  studentContext?: {
    classLevel?: string;
    targetExam?: string;
    preferredLanguage?: string;
  };
}

const CACHE_KEY_MESSAGES = "prepwise_live_call_messages_v3";
const AUDIO_CACHE_PREFIX = "prepwise_tts_v3_";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 Hours Auto Cleanup

// ============================================================================
// 24-HOUR AUTO STORAGE PURGE (Saves Supabase Storage & Browser Cache)
// ============================================================================
function purgeExpiredSessionData() {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const keysToRemove: string[] = [];

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

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(AUDIO_CACHE_PREFIX)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const data = JSON.parse(item);
            if (data.timestamp && now - data.timestamp > CACHE_EXPIRY_MS) {
              keysToRemove.push(key);
            }
          }
        } catch (_) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn("Storage cleanup notice:", err);
  }
}

// ============================================================================
// NATURAL PHONETICS & SMOOTH SPEECH CLEANER
// Eliminates awkward comma pauses, mathematical mispronunciations & robotic stutters
// ============================================================================
function cleanTextForNaturalSpeech(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // 1. Remove markdown symbols & latex tags
  text = text.replace(/[*#`_~]/g, " ");
  text = text.replace(/\$\$|\$/g, " ");
  text = text.replace(/Step \d+:\s*/gi, "");
  text = text.replace(/\\\[|\\\]|\\\(|\\\)/g, "");

  // 2. Fix awkward multiple punctuations causing huge gaps
  text = text.replace(/\.{2,}/g, ".");
  text = text.replace(/,{2,}/g, ",");
  text = text.replace(/[:;-]{2,}/g, " ");
  text = text.replace(/[:;]/g, ",");

  // Remove commas before small conjunctions/prepositions that cause weird pauses
  text = text.replace(/,\s*(hai|ki|toh|aur|se|mein|ka|ke|ko|par)\b/gi, " $1");

  // 3. Indian Academic / Kota Faculty Spoken Pronunciations
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 by $2");
  text = text.replace(/\\sqrt\{([^}]+)\}/g, "under root $1");
  text = text.replace(/\u221A/g, "under root ");

  text = text.replace(/(\w+)\^2\b/g, "$1 square");
  text = text.replace(/(\w+)\^3\b/g, "$1 cube");
  text = text.replace(/x\u00B2/g, "x square");
  text = text.replace(/y\u00B2/g, "y square");
  text = text.replace(/r\u00B2/g, "r square");
  text = text.replace(/v\u00B2/g, "v square");
  text = text.replace(/u\u00B2/g, "u square");

  // Optical physics & common exam variables
  text = text.replace(/M_o\b/gi, "M objective");
  text = text.replace(/M_e\b/gi, "M eyepiece");
  text = text.replace(/v_o\/u_o\b/gi, "v objective by u objective");
  text = text.replace(/v_o\b/gi, "v objective");
  text = text.replace(/u_o\b/gi, "u objective");
  text = text.replace(/f_o\b/gi, "f objective");
  text = text.replace(/f_e\b/gi, "f eyepiece");
  text = text.replace(/L\/f_o\b/gi, "L by f objective");
  text = text.replace(/D\/f_e\b/gi, "D by f eyepiece");
  text = text.replace(/1\s*\+\s*D\/f_e\b/gi, "1 plus D by f eyepiece");
  text = text.replace(/m\/s\u00B2/g, "meter per second square");
  text = text.replace(/m\/s/g, "meter per second");

  text = text.replace(/\bapprox\b/gi, "lagbhag");
  text = text.replace(/\beqn\b|\beq\b/gi, "equation");
  text = text.replace(/\bw\.r\.t\b/gi, "with respect to");
  text = text.replace(/\bi\.e\b/gi, "yaani ki");
  text = text.replace(/\be\.g\b/gi, "for example");
  text = text.replace(/\bconst\b/gi, "constant");
  text = text.replace(/\bmag\b/gi, "magnification");

  text = text.replace(/\u0394T/g, "delta T");
  text = text.replace(/\u0394/g, "delta ");
  text = text.replace(/\u03B8/g, "theta");
  text = text.replace(/\u03BB/g, "lambda");
  text = text.replace(/\u03A9/g, "ohm");
  text = text.replace(/\u03BC/g, "mu");
  text = text.replace(/\u03C0/g, "pi");
  text = text.replace(/\u2260/g, "not equal to");
  text = text.replace(/\u2248/g, "approximately");
  text = text.replace(/\u00B1/g, "plus minus");
  text = text.replace(/\u00B0C/g, "degree celsius");
  text = text.replace(/\u00D7/g, " into ");
  text = text.replace(/\u00F7/g, " by ");

  text = text.replace(/[\r\n]+/g, ". ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

// ============================================================================
// CLEAN UI CARD RENDERER (Turns raw text into clean study steps)
// ============================================================================
function FormattedSolutionView({ rawText }: { rawText: string }) {
  if (!rawText) return null;
  const lines = rawText.split("\n").filter((l) => l.trim().length > 0);

  return (
    <div className="space-y-1.5 text-xs text-slate-100">
      {lines.map((line, idx) => {
        let clean = line
          .replace(/\$\$|\$/g, "")
          .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 / $2")
          .replace(/\\left|\\right/g, "")
          .trim();

        const isHeading = clean.startsWith("#") || (clean.startsWith("**") && clean.endsWith("**"));
        clean = clean.replace(/[*#]/g, "").trim();
        const isBullet = line.trim().startsWith("*") || line.trim().startsWith("-");
        const isStep = /^step\s*\d+/i.test(clean);

        if (isHeading || isStep) {
          return (
            <div key={idx} className="font-bold text-teal-300 text-xs mt-2 mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              <span>{clean}</span>
            </div>
          );
        }
        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-200 my-0.5 pl-1">
              <span className="text-teal-400 font-bold shrink-0">*</span>
              <span className="leading-relaxed">{clean}</span>
            </div>
          );
        }
        return (
          <p key={idx} className="text-xs text-slate-200 my-1 leading-relaxed">
            {clean}
          </p>
        );
      })}
    </div>
  );
}

// ============================================================================
// AUDIO TONES
// ============================================================================
function playUiTone(type: "press" | "send" | "ai") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === "press") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === "send") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.09);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.start(now);
      osc.stop(now + 0.09);
    } else {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch (_) {}
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function LiveVideoCallModal({
  isOpen,
  open,
  onClose,
  studentContext,
}: LiveVideoCallModalProps) {
  const isModalOpen = Boolean(isOpen ?? open);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hudMode, setHudMode] = useState<"compact" | "expanded">("compact");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isHoldingMic, setIsHoldingMic] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [typedInput, setTypedInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [activeSpeechMessageId, setActiveSpeechMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [flashTrigger, setFlashTrigger] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});
  const [clearSuccessNotice, setClearSuccessNotice] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isAudioQueuePlayingRef = useRef(false);
  const transcriptRef = useRef("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // 24-HOUR AUTO STORAGE PURGE ON LOAD
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

  const saveMessagesToStorage = useCallback((msgs: Message[]) => {
    try {
      localStorage.setItem(
        CACHE_KEY_MESSAGES,
        JSON.stringify({ timestamp: Date.now(), items: msgs.slice(-30) })
      );
    } catch (_) {}
  }, []);

  // MANUAL CHAT CLEAR (Limits Supabase & Local Cache usage)
  const handleManualClearChat = () => {
    playUiTone("press");
    setMessages([]);
    try {
      localStorage.removeItem(CACHE_KEY_MESSAGES);
    } catch (_) {}
    setClearSuccessNotice(true);
    setTimeout(() => setClearSuccessNotice(false), 2500);
  };

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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
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
      const track = stream.getVideoTracks()[0];
      const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
      setHasTorch(Boolean(capabilities?.torch));
      setIsTorchOn(false);
    } catch (err) {
      console.warn("Camera init warning:", err);
    }
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      startCamera(facingMode);
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      stopSpeaking();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isModalOpen, facingMode, startCamera]);

  const toggleCameraSwitch = () => {
    playUiTone("press");
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // FLASHLIGHT TOGGLE WITH COLOR & CUT
  const toggleTorch = async () => {
    playUiTone("press");
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: next }],
      });
      setIsTorchOn(next);
    } catch (e) {
      console.warn("Torch failed:", e);
    }
  };

  const captureCurrentFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setFlashTrigger(true);
    setTimeout(() => setFlashTrigger(false), 200);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  };

  const stopSpeaking = () => {
    isAudioQueuePlayingRef.current = false;
    audioQueueRef.current = [];
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsAiSpeaking(false);
    setActiveSpeechMessageId(null);
  };

  // NATURAL PHONETICS & SMOOTH CONTINUOUS TTS
  const speakTextContinuously = async (fullText: string, messageId?: string) => {
    if (isMuted) return;
    stopSpeaking();
    if (messageId) setActiveSpeechMessageId(messageId);
    setIsAiSpeaking(true);

    const sentences = fullText
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);

    if (sentences.length === 0) {
      setIsAiSpeaking(false);
      return;
    }

    audioQueueRef.current = sentences;
    isAudioQueuePlayingRef.current = true;

    const getAudioUrl = async (sentence: string): Promise<string | null> => {
      const clean = cleanTextForNaturalSpeech(sentence).slice(0, 200);
      if (!clean) return null;
      if (audioCache[clean]) return audioCache[clean];

      const cacheKey = `${AUDIO_CACHE_PREFIX}${encodeURIComponent(clean.slice(0, 40))}`;
      try {
        const localCached = localStorage.getItem(cacheKey);
        if (localCached) {
          const parsed = JSON.parse(localCached);
          if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_EXPIRY_MS && parsed.dataUrl) {
            return parsed.dataUrl;
          }
        }
      } catch (_) {}

      try {
        const res = await fetch(`/api/ai-doubt/live/tts?text=${encodeURIComponent(clean)}`);
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          setAudioCache((prev) => ({ ...prev, [clean]: url }));
          return url;
        }
      } catch (_) {}
      return null;
    };

    const playNextSentence = async () => {
      if (!isAudioQueuePlayingRef.current || audioQueueRef.current.length === 0) {
        isAudioQueuePlayingRef.current = false;
        setIsAiSpeaking(false);
        setActiveSpeechMessageId(null);
        return;
      }

      const currentSentence = audioQueueRef.current.shift()!;
      const cleanSpeech = cleanTextForNaturalSpeech(currentSentence);
      if (!cleanSpeech) {
        playNextSentence();
        return;
      }

      const audioUrl = await getAudioUrl(cleanSpeech);
      if (audioUrl && isAudioQueuePlayingRef.current) {
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        audio.onended = () => {
          if (isAudioQueuePlayingRef.current) playNextSentence();
        };
        audio.onerror = () => {
          fallbackNativeSpeech(cleanSpeech, playNextSentence);
        };
        try {
          await audio.play();
        } catch (_) {
          fallbackNativeSpeech(cleanSpeech, playNextSentence);
        }
      } else if (isAudioQueuePlayingRef.current) {
        fallbackNativeSpeech(cleanSpeech, playNextSentence);
      }
    };

    const fallbackNativeSpeech = (text: string, onDone: () => void) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        onDone();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "hi-IN";
        utter.rate = 1.12;
        utter.pitch = 1.0;
        utter.onend = () => {
          if (isAudioQueuePlayingRef.current) onDone();
        };
        utter.onerror = () => {
          if (isAudioQueuePlayingRef.current) onDone();
        };
        window.speechSynthesis.speak(utter);
      } catch (_) {
        onDone();
      }
    };

    playNextSentence();
  };

  const handleHoldStart = () => {
    if (isAnalyzing) return;
    playUiTone("press");
    setIsHoldingMic(true);
    setTranscript("");
    transcriptRef.current = "";
    stopSpeaking();

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "hi-IN";
        rec.onresult = (e: any) => {
          let text = "";
          for (let i = 0; i < e.results.length; i++) {
            text += e.results[i][0].transcript + " ";
          }
          const cleaned = text.trim();
          setTranscript(cleaned);
          transcriptRef.current = cleaned;
        };
        rec.onerror = (e: any) => {
          console.warn("Speech recognition error:", e);
        };
        rec.start();
        recognitionRef.current = rec;
      } catch (err) {
        console.warn("SpeechRec start error:", err);
      }
    }
  };

  const handleHoldEnd = () => {
    if (!isHoldingMic) return;
    setIsHoldingMic(false);
    playUiTone("send");

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }

    const recordedText = transcriptRef.current.trim() || transcript.trim();
    sendLiveDoubt(recordedText);
  };

  const sendLiveDoubt = async (questionText: string) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setHudMode("compact");

    const frameBase64 = captureCurrentFrame();
    const query = questionText.trim() || "Explain this derivation step-by-step and solve this question.";

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: query,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedWithUser = [...messages, userMsg];
    setMessages(updatedWithUser);
    saveMessagesToStorage(updatedWithUser);

    try {
      const res = await fetch("/api/ai-doubt/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frame: frameBase64 ? `data:image/jpeg;base64,${frameBase64}` : null,
          message: query,
          studentContext,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const reply = data.reply || "Aapka question dekha gaya hai, par solution load nahi ho saka.";

      const aiMsg: Message = {
        id: `ai_${Date.now()}`,
        sender: "ai",
        text: reply,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        modelUsed: data.model,
        provider: data.provider,
      };

      const finalMessages = [...updatedWithUser, aiMsg];
      setMessages(finalMessages);
      saveMessagesToStorage(finalMessages);
      playUiTone("ai");

      speakTextContinuously(reply, aiMsg.id);
    } catch (err: any) {
      console.warn("Live solving error:", err);
      const errMsg: Message = {
        id: `err_${Date.now()}`,
        sender: "ai",
        text: "Kripya camera se diagram ya notes ko dobara clearly dikhayein aur puchein.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      const finalErr = [...updatedWithUser, errMsg];
      setMessages(finalErr);
      saveMessagesToStorage(finalErr);
    } finally {
      setIsAnalyzing(false);
      setTranscript("");
      transcriptRef.current = "";
      setTypedInput("");
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isModalOpen) return null;

  const latestAiMessage = [...messages].reverse().find((m) => m.sender === "ai");

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* Background Live Camera Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Screen White Flash Shutter Effect */}
      {flashTrigger && (
        <div className="absolute inset-0 bg-white/40 z-30 pointer-events-none transition-opacity duration-150 animate-pulse" />
      )}

      {/* Dark Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none" />

      {/* 1. TOP HEADER: Status, Timer, Torch & Camera Switch */}
      <div className="relative z-20 flex items-center justify-between p-4 pt-6">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-md">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-black text-white tracking-wide">LIVE CALL</span>
          <span className="text-[11px] font-mono font-bold text-slate-300">- {formatTime(callDuration)}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* FLASHLIGHT TOGGLE (Cut line on off, bright amber fill on on) */}
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`p-2.5 rounded-full backdrop-blur-md border text-xs font-bold transition active:scale-95 shadow-md flex items-center justify-center ${
                isTorchOn
                  ? "bg-amber-500/20 text-amber-400 border-amber-400 shadow-amber-500/30 ring-2 ring-amber-400/40"
                  : "bg-black/60 text-slate-300 border-white/20 hover:bg-black/80"
              }`}
              title={isTorchOn ? "Flashlight ON (Tap to Turn Off)" : "Flashlight OFF (Tap to Turn On)"}
            >
              {isTorchOn ? <FlashlightOnIcon className="w-4 h-4" /> : <FlashlightOffIcon className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={toggleCameraSwitch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 text-xs font-bold transition active:scale-95 shadow-md"
            title="Switch Camera (Back/Front)"
          >
            <CameraSwitchIcon className="w-4 h-4" />
            <span className="text-[11px] font-semibold">{facingMode === "environment" ? "Back" : "Front"}</span>
          </button>
        </div>
      </div>

      {/* 2. TOP FLOATING WAITING / SCANNER / SPEAKING TOAST BAR */}
      <div className="relative z-30 mx-auto max-w-sm px-4 w-full">
        {isAnalyzing ? (
          <div className="mx-auto w-fit px-4 py-2 rounded-full bg-slate-900/90 backdrop-blur-md border border-teal-400/60 text-center shadow-2xl flex items-center justify-center gap-2.5 animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping shrink-0" />
            <p className="text-xs font-black text-teal-200 tracking-wide">
              Analyzing notes & solving derivation...
            </p>
          </div>
        ) : isHoldingMic && transcript ? (
          <div className="mx-auto w-fit max-w-xs px-4 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-emerald-500/40 text-center shadow-lg">
            <p className="text-[11.5px] font-semibold text-emerald-300 truncate">
              "{transcript}"
            </p>
          </div>
        ) : isAiSpeaking ? (
          <button
            type="button"
            onClick={stopSpeaking}
            className="mx-auto w-fit px-3.5 py-1.5 rounded-full bg-emerald-950/85 hover:bg-emerald-900 backdrop-blur-md border border-emerald-500/40 text-center shadow-lg flex items-center justify-center gap-2 animate-pulse active:scale-95 transition"
            title="Tap to Stop Voice"
          >
            <MicActiveIcon className="w-3.5 h-3.5 text-emerald-300" />
            <p className="text-[11px] font-bold text-emerald-300">
              AI Explaining... (Tap to Stop)
            </p>
            <StopSquareIcon className="w-3 h-3 text-emerald-400 ml-1" />
          </button>
        ) : clearSuccessNotice ? (
          <div className="mx-auto w-fit px-3.5 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-center shadow-lg animate-bounce">
            <p className="text-[11px] font-bold text-emerald-300">
              ✓ Chat history cleared (Free limits protected)
            </p>
          </div>
        ) : null}
      </div>

      {/* 3. FLOATING CHAT & SOLUTION HUD (COMPACT & EXPANDED) */}
      <div className="relative z-20 max-w-sm mx-auto w-full px-4 mb-2 mt-auto">
        {hudMode === "expanded" ? (
          <div className="bg-slate-900/95 backdrop-blur-xl border border-teal-500/40 rounded-3xl p-4 shadow-2xl space-y-2.5 transition-all max-h-[58vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-400" />
                <h5 className="text-xs font-black text-teal-300 uppercase tracking-wider">
                  Live Solution Steps
                </h5>
              </div>

              <div className="flex items-center gap-1.5">
                {/* MANUAL CLEAR BUTTON & 24H RETENTION NOTICE */}
                <button
                  type="button"
                  onClick={handleManualClearChat}
                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 active:scale-95 transition"
                  title="Clear Chat & Free Supabase Storage"
                >
                  <TrashIcon className="w-3 h-3 text-rose-400" />
                  <span>Clear</span>
                </button>

                <button
                  type="button"
                  onClick={() => setHudMode("compact")}
                  className="text-slate-400 hover:text-white p-1 rounded-lg bg-white/5 active:scale-95"
                  title="Minimize Drawer"
                >
                  <ChevronDownIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 24 HOURS RETENTION NOTICE MENTION */}
            <div className="bg-slate-800/60 border border-white/5 rounded-xl px-2.5 py-1 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Auto 24h cleanup active (Saves Supabase quota)</span>
              <span className="text-teal-400 font-mono font-semibold">24h TTL</span>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {messages.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs font-bold text-white">Book ya handwritten notes camera ke aage rakhein</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Hold to Ask dabakar sawal boliye ya type karein.
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-2xl text-xs ${
                      m.sender === "user"
                        ? "bg-teal-950/70 border border-teal-500/30 text-teal-100 ml-4 text-right"
                        : "bg-slate-800/90 border border-slate-700/60 text-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mb-1 border-b border-white/5 pb-1">
                      <span>{m.sender === "user" ? "You" : "Live AI Faculty"} - {m.time}</span>
                      {m.sender === "ai" && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (isAiSpeaking && activeSpeechMessageId === m.id) {
                                stopSpeaking();
                              } else {
                                speakTextContinuously(m.text, m.id);
                              }
                            }}
                            className="flex items-center gap-1 text-teal-300 hover:text-teal-200 transition"
                            title={isAiSpeaking && activeSpeechMessageId === m.id ? "Stop Voice" : "Listen Again"}
                          >
                            {isAiSpeaking && activeSpeechMessageId === m.id ? (
                              <>
                                <StopSquareIcon className="w-3 h-3 text-rose-400" />
                                <span className="text-[9px] text-rose-300 font-bold">Stop</span>
                              </>
                            ) : (
                              <>
                                <PlayTriangleIcon className="w-3 h-3 text-teal-300" />
                                <span className="text-[9px] font-bold">Listen</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopy(m.id, m.text)}
                            className="flex items-center gap-1 text-slate-400 hover:text-white transition"
                            title="Copy Solution"
                          >
                            {copiedId === m.id ? (
                              <CopyCheckIcon className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <CopyDefaultIcon className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {m.sender === "ai" ? (
                      <FormattedSolutionView rawText={m.text} />
                    ) : (
                      <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                    )}
                  </div>
                ))
              )}
              {isAnalyzing && (
                <div className="flex items-center gap-2 bg-teal-950/60 border border-teal-500/30 rounded-xl px-3 py-1.5 w-fit">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                  <span className="text-[11px] font-bold text-teal-200">Solving derivation & steps...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && typedInput.trim()) {
                    sendLiveDoubt(typedInput.trim());
                  }
                }}
                placeholder="Ya type karke doubt puchein..."
                className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-teal-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (typedInput.trim()) sendLiveDoubt(typedInput.trim());
                }}
                disabled={!typedInput.trim() || isAnalyzing}
                className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs active:scale-95 transition"
              >
                Send
              </button>
            </div>
          </div>
        ) : hudMode === "compact" && latestAiMessage ? (
          <div
            onClick={() => setHudMode("expanded")}
            className="w-full bg-slate-900/90 backdrop-blur-md border border-teal-500/30 rounded-2xl p-3 text-left shadow-xl active:scale-98 transition cursor-pointer flex items-center justify-between group"
          >
            <div className="truncate mr-2.5 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                <span className="text-[9.5px] font-mono font-bold text-teal-300 uppercase tracking-wide">
                  Latest Solution
                </span>
              </div>
              <p className="text-xs text-white truncate font-medium">
                {latestAiMessage.text.replace(/[*#`_~$]/g, "").slice(0, 80)}...
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-teal-300 bg-teal-500/20 border border-teal-500/30 px-2.5 py-1.5 rounded-xl shrink-0 font-bold group-hover:bg-teal-500/30">
              <span>View Full</span>
              <ChatBubbleIcon className="w-3.5 h-3.5" />
            </div>
          </div>
        ) : null}
      </div>

      {/* 4. BOTTOM CONTROLS DOCK & PUSH-TO-TALK */}
      <div className="relative z-20 p-4 pb-8 flex flex-col items-center gap-2.5 bg-gradient-to-t from-black via-black/90 to-transparent">
        <div className="px-3.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-center shadow-md">
          <p className="text-[10.5px] font-semibold text-slate-300">
            {isHoldingMic ? (
              <span className="text-emerald-400 font-bold animate-pulse">
                Listening... Sawal boliye (Release karte hi solve hoga)
              </span>
            ) : isAnalyzing ? (
              <span className="text-teal-300 font-bold">
                Analyzing handwritten question...
              </span>
            ) : (
              <span>Hold mic to speak - Chhodte hi solve hoga</span>
            )}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3.5 w-full max-w-xs">
          {/* MIC MUTE / UNMUTE BUTTON (Mic shape with slash when muted) */}
          <button
            type="button"
            onClick={() => {
              if (!isMuted) stopSpeaking();
              setIsMuted(!isMuted);
            }}
            className={`p-3.5 rounded-full transition-all active:scale-95 shadow-xl flex items-center justify-center ${
              isMuted
                ? "bg-rose-600 text-white border border-rose-400 ring-2 ring-rose-500/40"
                : "bg-slate-800/90 text-slate-200 border border-slate-700 hover:bg-slate-700"
            }`}
            title={isMuted ? "Mic Muted (Tap to Unmute Voice)" : "Mic Active (Tap to Mute Voice)"}
          >
            {isMuted ? <MicMutedIcon className="w-5 h-5 text-white" /> : <MicActiveIcon className="w-5 h-5 text-teal-300" />}
          </button>

          {/* Push-to-Talk Primary Mic Button */}
          <button
            type="button"
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            disabled={isAnalyzing}
            className={`px-6 py-4 rounded-full font-black text-sm tracking-wide shadow-2xl transition-all flex items-center gap-2.5 select-none ${
              isHoldingMic
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white scale-105 ring-4 ring-emerald-400/50 shadow-emerald-500/50"
                : "bg-gradient-to-r from-teal-500 via-teal-600 to-emerald-600 text-white hover:from-teal-400 hover:to-emerald-500 active:scale-95 shadow-teal-500/30"
            } ${isAnalyzing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {isHoldingMic ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                <span className="tracking-wide">Release to Solve</span>
              </>
            ) : (
              <>
                <MicActiveIcon className="w-5 h-5" />
                <span>{isAnalyzing ? "Solving..." : "Hold to Ask"}</span>
              </>
            )}
          </button>

          {/* Chat Toggle Button */}
          <button
            type="button"
            onClick={() => setHudMode(hudMode === "expanded" ? "compact" : "expanded")}
            className={`p-3.5 rounded-full transition-all active:scale-95 shadow-xl ${
              hudMode === "expanded"
                ? "bg-teal-600 text-white border border-teal-400"
                : "bg-slate-800/90 text-slate-300 border border-slate-700 hover:bg-slate-700"
            }`}
            title="Toggle Solution Steps & Chat"
          >
            <ChatBubbleIcon className="w-5 h-5" />
          </button>

          {/* End Call Button */}
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

export default LiveVideoCallModal;
