"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  MessageSquare,
  X,
  AlertCircle,
  HelpCircle,
  Send,
  Camera,
  Trash2,
  CheckCircle,
} from "lucide-react";

// Micro Icons for custom UI
const FlashlightBulbIcon = ({ active }: { active: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={`w-6 h-6 transition-all duration-300 ${
      active
        ? "text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.8)] scale-110"
        : "text-slate-300 hover:text-white"
    }`}
  >
    <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7zm-2 18a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1h-4v1z" />
  </svg>
);

const MicActiveIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-7 h-7 text-emerald-400 animate-pulse"
  >
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const MicMutedIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-7 h-7 text-red-400"
  >
    <line x1="2" x2="22" y1="2" y2="22" />
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
    <path d="M5 10v2a7 7 0 0 0 12 5" />
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
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
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 Hours

// 24 Hour Cache Purge Utility
function purgeExpiredSessionData() {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const stored = localStorage.getItem(CACHE_KEY_MESSAGES);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.timestamp && now - parsed.timestamp > CACHE_EXPIRY_MS) {
        localStorage.removeItem(CACHE_KEY_MESSAGES);
      }
    }
    // Clean audio blob keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(AUDIO_CACHE_PREFIX)) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || "{}");
          if (item.timestamp && now - item.timestamp > CACHE_EXPIRY_MS) {
            localStorage.removeItem(key);
          }
        } catch (_) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (err) {
    console.warn("Cache purge error:", err);
  }
}

// Function to clean text for TTS and reduce excessive pauses
function cleanTextForSpeech(text: string): string {
  if (!text) return "";
  let cleaned = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~#>]/g, "")
    .replace(/(\$|\$\$)([\s\S]*?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();

  // Natural pause normalization (prevents Microsoft TTS long boundary breaks)
  cleaned = cleaned
    .replace(/[,;]\s*/g, ", ")
    .replace(/\.{2,}/g, ".")
    .replace(/[!?]+\s*/g, ". ")
    .replace(/:\s*/g, " - ")
    .replace(/\s*([.,?!])\s*/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

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
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [activeSpeechMessageId, setActiveSpeechMessageId] = useState<string | null>(null);

  // Video Streaming State
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Messages & Call Transcript State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isAudioQueuePlayingRef = useRef(false);
  const transcriptRef = useRef("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
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
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(
          CACHE_KEY_MESSAGES,
          JSON.stringify({ timestamp: Date.now(), items: messages })
        );
      } catch (_) {}
    }
  }, [messages]);

  // 2. Call Timer
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

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 3. Audio Player & Cleanup
  const stopCurrentAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }
    audioQueueRef.current = [];
    isAudioQueuePlayingRef.current = false;
    setIsAiSpeaking(false);
    setActiveSpeechMessageId(null);
  }, []);

  const playAudioBlobUrl = useCallback((blobUrl: string, msgId: string, onEnd?: () => void) => {
    stopCurrentAudio();
    const audio = new Audio(blobUrl);
    currentAudioRef.current = audio;
    setIsAiSpeaking(true);
    setActiveSpeechMessageId(msgId);

    audio.onended = () => {
      setIsAiSpeaking(false);
      setActiveSpeechMessageId(null);
      if (onEnd) onEnd();
    };
    audio.onerror = () => {
      setIsAiSpeaking(false);
      setActiveSpeechMessageId(null);
      if (onEnd) onEnd();
    };
    audio.play().catch((e) => {
      console.warn("Audio play prevented:", e);
      setIsAiSpeaking(false);
      setActiveSpeechMessageId(null);
    });
  }, [stopCurrentAudio]);

  // Fetch TTS from Microsoft Edge Backend
  const playAiVoice = useCallback(
    async (text: string, msgId: string) => {
      const speechReadyText = cleanTextForSpeech(text);
      if (!speechReadyText) return;

      const cacheKey = `${AUDIO_CACHE_PREFIX}${encodeURIComponent(speechReadyText.slice(0, 60))}`;
      try {
        const cachedBlob = sessionStorage.getItem(cacheKey);
        if (cachedBlob) {
          playAudioBlobUrl(cachedBlob, msgId);
          return;
        }
      } catch (_) {}

      try {
        setIsAiSpeaking(true);
        setActiveSpeechMessageId(msgId);

        const response = await fetch(
          `/api/ai-doubt/live/tts?text=${encodeURIComponent(speechReadyText)}`
        );
        if (!response.ok) throw new Error("TTS Route Failed");

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        try {
          sessionStorage.setItem(cacheKey, blobUrl);
        } catch (_) {}

        playAudioBlobUrl(blobUrl, msgId);
      } catch (err) {
        console.warn("Edge TTS unavailable, falling back to Web Speech:", err);
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(speechReadyText);
          utterance.rate = 1.1;
          utterance.lang = "hi-IN";
          utterance.onend = () => {
            setIsAiSpeaking(false);
            setActiveSpeechMessageId(null);
          };
          utterance.onerror = () => {
            setIsAiSpeaking(false);
            setActiveSpeechMessageId(null);
          };
          window.speechSynthesis.speak(utterance);
        } else {
          setIsAiSpeaking(false);
          setActiveSpeechMessageId(null);
        }
      }
    },
    [playAudioBlobUrl]
  );

  // 4. Capture Frame from Live Video
  const captureFrameBase64 = useCallback((): string | null => {
    if (!videoRef.current) return null;
    try {
      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return null;

      const canvas = document.createElement("canvas");
      canvas.width = Math.min(video.videoWidth, 800);
      canvas.height = Math.round((video.videoHeight / video.videoWidth) * canvas.width);

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.75);
    } catch (e) {
      console.warn("Frame capture error:", e);
      return null;
    }
  }, []);

  // 5. Send Doubt Query
  const sendDoubtQuery = useCallback(
    async (queryText: string) => {
      if (!queryText.trim() && !isCameraActive) return;
      setIsProcessing(true);
      setIsAiThinking(true);

      const userMsgId = `user_${Date.now()}`;
      const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const newMsg: ChatMessage = {
        id: userMsgId,
        sender: "user",
        text: queryText || "[Sent Camera Frame for Doubt Analysis]",
        time: nowTime,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, newMsg]);
      setTextInput("");

      const frameBase64 = isCameraActive ? captureFrameBase64() : null;

      try {
        const payload = {
          message: queryText,
          image: frameBase64,
          studentContext: studentContext || {},
          history: messages.slice(-4).map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text,
          })),
        };

        const res = await fetch("/api/ai-doubt/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("API call failed");
        const data = await res.json();

        const aiText = data.reply || data.text || "Main aapka doubt samajh gaya. Kripya dhyan se dekhein.";
        const aiMsgId = `ai_${Date.now()}`;
        const aiMsg: ChatMessage = {
          id: aiMsgId,
          sender: "ai",
          text: aiText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, aiMsg]);
        setIsAiThinking(false);
        setIsProcessing(false);

        // Auto trigger high-clarity voice response
        if (!isMuted) {
          playAiVoice(aiText, aiMsgId);
        }
      } catch (err) {
        console.error("Doubt processing error:", err);
        setIsAiThinking(false);
        setIsProcessing(false);

        const errorMsg: ChatMessage = {
          id: `err_${Date.now()}`,
          sender: "ai",
          text: "Maaf kijiye, network issue ke kaaran main check nahi kar paaya. Kripya dobara mic daba kar bole ya frame check karein.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    },
    [
      isCameraActive,
      captureFrameBase64,
      studentContext,
      messages,
      isMuted,
      playAiVoice,
    ]
  );

  // 6. Camera Lifecycle & Torch Control
  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.warn("Video play error:", e));
      }

      // Check Torch capabilities
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities && track.getCapabilities()) as any;
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access in browser."
          : "Unable to start camera. Please verify device camera is working."
      );
      setIsCameraActive(false);
    }
  }, [facingMode]);

  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      }
    } catch (e) {
      console.warn("Flashlight toggle error:", e);
    }
  };

  const flipCamera = () => {
    setIsTorchOn(false);
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  useEffect(() => {
    if (isModalOpen) {
      startCamera();
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      stopCurrentAudio();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      stopCurrentAudio();
    };
  }, [isModalOpen, startCamera, stopCurrentAudio]);

  // 7. Speech Recognition
  const startSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn("Speech recognition not supported on this browser.");
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "hi-IN";

      transcriptRef.current = "";

      recognition.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        transcriptRef.current = currentTranscript;
      };

      recognition.onerror = (e: any) => {
        console.warn("Speech rec error:", e);
      };

      recognition.onend = () => {
        if (isHoldingMic) {
          try {
            recognition.start();
          } catch (_) {}
        }
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("Speech recognition initiation error:", err);
    }
  }, [isHoldingMic]);

  const stopSpeechRecognition = useCallback(() => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (_) {}
      speechRecognitionRef.current = null;
    }

    const recorded = transcriptRef.current.trim();
    if (recorded.length > 0) {
      sendDoubtQuery(recorded);
    }
    transcriptRef.current = "";
  }, [sendDoubtQuery]);

  const handleMicMouseDown = () => {
    if (isMuted) return;
    setIsHoldingMic(true);
    stopCurrentAudio();
    startSpeechRecognition();
  };

  const handleMicMouseUp = () => {
    if (isMuted || !isHoldingMic) return;
    setIsHoldingMic(false);
    stopSpeechRecognition();
  };

  const handleEndCall = () => {
    stopCurrentAudio();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setIsModalOpen(false);
    onClose();
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-0 md:p-4 select-none">
      {/* Main Container */}
      <div className="relative w-full h-full md:max-w-4xl md:h-[90vh] md:rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header Overlay */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/60 shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="w-2 h-2 rounded-full bg-red-500 absolute" />
              <span className="text-xs font-semibold text-white tracking-wider ml-2">
                LIVE FACULTY
              </span>
              <span className="text-slate-400 text-xs">|</span>
              <span className="text-xs font-mono font-medium text-emerald-400">
                {formatTimer(callDuration)}
              </span>
            </div>

            {isAiSpeaking && (
              <div className="flex items-center space-x-1.5 bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-full animate-pulse">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-semibold text-emerald-300">
                  Faculty Explaining...
                </span>
              </div>
            )}

            {isAiThinking && (
              <div className="flex items-center space-x-1.5 bg-indigo-950/80 border border-indigo-500/40 px-3 py-1 rounded-full animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-semibold text-indigo-300">
                  Reading Frame...
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setChatDrawerOpen(!chatDrawerOpen)}
              className="relative p-2.5 rounded-full bg-black/50 backdrop-blur-md border border-slate-700/60 text-slate-200 hover:text-white hover:bg-black/70 transition shadow-lg"
              title="Chat History"
            >
              <MessageSquare className="w-5 h-5" />
              {messages.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-indigo-500 text-[10px] text-white font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {messages.length}
                </span>
              )}
            </button>

            <button
              onClick={handleEndCall}
              className="p-2.5 rounded-full bg-red-600/80 hover:bg-red-600 text-white transition shadow-lg border border-red-500/40"
              title="Leave Call"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Canvas / Main View */}
        <div className="relative flex-1 w-full h-full bg-slate-900 flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center max-w-md">
              <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">Camera Notice</h3>
              <p className="text-sm text-slate-300 mb-4">{cameraError}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition"
              >
                Retry Camera
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover transition-transform duration-300 ${
                facingMode === "user" ? "scale-x-[-1]" : ""
              }`}
            />
          )}

          {/* Real-time Subtitle Overlay on Video */}
          {messages.length > 0 && messages[messages.length - 1].sender === "ai" && (
            <div className="absolute bottom-28 left-4 right-4 z-20 flex justify-center pointer-events-none">
              <div className="max-w-xl bg-black/75 backdrop-blur-md border border-slate-700/60 rounded-2xl px-4 py-3 shadow-2xl text-center pointer-events-auto">
                <div className="flex items-center justify-center space-x-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wide">
                    Live Explanation
                  </span>
                </div>
                <p className="text-sm text-slate-100 font-medium line-clamp-3 leading-relaxed">
                  {messages[messages.length - 1].text}
                </p>
              </div>
            </div>
          )}

          {/* Watermark / Guidance Tag */}
          <div className="absolute top-20 left-4 z-10 pointer-events-none">
            <div className="bg-black/40 backdrop-blur-sm px-3 py-1 rounded-lg border border-white/10 text-[11px] text-slate-300">
              Point camera at notebook, book, or screen
            </div>
          </div>
        </div>

        {/* Bottom Call Action Control Bar */}
        <div className="relative z-30 p-4 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent flex items-center justify-around border-t border-slate-800/80">
          {/* Torch Toggle */}
          <button
            onClick={toggleTorch}
            disabled={!hasTorch}
            className={`p-3.5 rounded-2xl border transition-all duration-200 flex flex-col items-center space-y-1 ${
              hasTorch
                ? isTorchOn
                  ? "bg-yellow-500/20 border-yellow-500/60 text-yellow-300"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700/60"
                : "bg-slate-900 border-slate-800 text-slate-600 opacity-40 cursor-not-allowed"
            }`}
            title={hasTorch ? "Toggle Flashlight" : "Torch unavailable on this lens"}
          >
            <FlashlightBulbIcon active={isTorchOn} />
            <span className="text-[10px] font-medium tracking-tight">Flash</span>
          </button>

          {/* Flip Lens */}
          <button
            onClick={flipCamera}
            className="p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-slate-200 transition flex flex-col items-center space-y-1"
            title="Switch Front/Back Camera"
          >
            <RotateCcw className="w-6 h-6 text-slate-300" />
            <span className="text-[10px] font-medium tracking-tight">Flip</span>
          </button>

          {/* Push-to-Talk Mic Center Button */}
          <div className="relative flex flex-col items-center">
            {isHoldingMic && (
              <span className="absolute -top-10 text-[11px] font-bold text-emerald-400 bg-emerald-950/90 border border-emerald-500/40 px-3 py-1 rounded-full animate-bounce">
                Listening... Release to Ask
              </span>
            )}
            <button
              onMouseDown={handleMicMouseDown}
              onMouseUp={handleMicMouseUp}
              onTouchStart={handleMicMouseDown}
              onTouchEnd={handleMicMouseUp}
              disabled={isProcessing}
              className={`relative w-18 h-18 rounded-3xl p-4 flex items-center justify-center transition-all duration-300 shadow-xl ${
                isMuted
                  ? "bg-slate-800 border-2 border-red-500/50 text-red-400"
                  : isHoldingMic
                  ? "bg-emerald-600 border-4 border-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.7)] scale-105"
                  : isProcessing
                  ? "bg-indigo-600 border-2 border-indigo-400 animate-pulse"
                  : "bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border-2 border-indigo-400/60"
              }`}
              title="Hold to Speak Doubt"
            >
              {isMuted ? (
                <MicMutedIcon />
              ) : isHoldingMic ? (
                <MicActiveIcon />
              ) : (
                <Mic className="w-7 h-7 text-white" />
              )}
            </button>
            <span className="text-[10px] font-semibold text-slate-300 mt-1">
              {isHoldingMic ? "Listening..." : "Hold to Ask"}
            </span>
          </div>

          {/* Mute Audio Output */}
          <button
            onClick={() => {
              if (!isMuted) stopCurrentAudio();
              setIsMuted(!isMuted);
            }}
            className={`p-3.5 rounded-2xl border transition flex flex-col items-center space-y-1 ${
              isMuted
                ? "bg-red-500/20 border-red-500/60 text-red-300"
                : "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700/60"
            }`}
            title={isMuted ? "Unmute AI Faculty" : "Mute AI Faculty"}
          >
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            <span className="text-[10px] font-medium tracking-tight">
              {isMuted ? "Unmute" : "Mute"}
            </span>
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="p-3.5 rounded-2xl bg-red-600/90 hover:bg-red-600 border border-red-500/60 text-white transition flex flex-col items-center space-y-1 shadow-lg shadow-red-900/40"
            title="End Session"
          >
            <PhoneOff className="w-6 h-6" />
            <span className="text-[10px] font-medium tracking-tight">End</span>
          </button>
        </div>

        {/* Slide-over Chat & Doubt History Drawer */}
        {chatDrawerOpen && (
          <div className="absolute inset-y-0 right-0 z-40 w-full sm:w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">Call Transcript & History</h4>
              </div>
              <button
                onClick={() => setChatDrawerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <HelpCircle className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-xs">
                    Abhi koi doubt discuss nahi hua hai. Hold the mic button ya text input use karein.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs ${
                        msg.sender === "user"
                          ? "bg-indigo-600 text-white rounded-br-none"
                          : "bg-slate-800 border border-slate-700/60 text-slate-100 rounded-bl-none shadow-md"
                      }`}
                    >
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <span className="font-bold text-[10px] opacity-75">
                          {msg.sender === "user" ? "You" : "AI Faculty"}
                        </span>
                        <span className="text-[9px] opacity-60">{msg.time}</span>
                      </div>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                      {msg.sender === "ai" && (
                        <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between">
                          <button
                            onClick={() => playAiVoice(msg.text, msg.id)}
                            className="flex items-center space-x-1 text-[10px] text-indigo-300 hover:text-indigo-200"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>
                              {activeSpeechMessageId === msg.id && isAiSpeaking
                                ? "Playing..."
                                : "Listen"}
                            </span>
                          </button>
                          <button
                            onClick={() => copyText(msg.text, msg.id)}
                            className="text-[10px] text-slate-400 hover:text-slate-200"
                          >
                            {copiedId === msg.id ? "Copied" : "Copy"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Text Input for Quiet Classrooms */}
            <div className="p-3 border-t border-slate-800 bg-slate-950">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (textInput.trim() && !isProcessing) {
                    sendDoubtQuery(textInput);
                  }
                }}
                className="flex items-center space-x-2"
              >
                <input
                  type="text"
                  placeholder="Type doubt if you can't speak..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isProcessing}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
