"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

// Clean UI Icons (Zero lucide dependency issues)
function CloseIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CameraSwitchIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

// Flashlight ON: Vibrant Glowing Filled Bulb
function TorchOnIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm-2 17h4v1c0 .55-.45 1-1 1h-2c-.55 0-1-.45-1-1v-1zm1 3h2v.5c0 .28-.22.5-.5.5h-1c-.28 0-.5-.22-.5-.5V22z" />
    </svg>
  );
}

// Flashlight OFF: Bulb Outline with Clean Diagonal Slash Cut Line
function TorchOffIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18h6m-4 3h2m-4-3v-1.26a6.96 6.96 0 01-2-4.74c0-1.42.42-2.74 1.14-3.85M15 13.74c1.2-1.07 2-2.61 2-4.74 0-.75-.12-1.47-.34-2.14M9.5 3.37A6.995 6.995 0 0112 2c3.87 0 7 3.13 7 7 0 1.05-.23 2.05-.65 2.95" />
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

// Clean Mic Active Icon
function MicActiveIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
    </svg>
  );
}

// Clean Mic Muted Icon with Diagonal Slash Cut
function MicMutedIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4a3 3 0 015.12-2.12M15 9.34V12a3 3 0 01-5.94.6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16.95A7 7 0 015 12v-2m14 0v2a6.97 6.97 0 01-1.25 3.97M12 19v4M8 23h8" />
      <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function ChatBubbleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function CopyCheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CopyDefaultIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function StopSquareIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

function PlayTriangleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronUpIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

// 24 HOURS AUTOMATIC EXPIRY QUOTA SHIELD
const STORAGE_PREFIX = "prepwise_live_call_";
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function purgeExpiredSessionData() {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || "{}");
          if (item.timestamp && now - item.timestamp > TWENTY_FOUR_HOURS_MS) {
            localStorage.removeItem(key);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
}

/**
 * Normalizes speech text for continuous, fast-flowing spoken Hindi/English:
 * Strips commas, colons, unnecessary pauses and normalizes pronunciation
 */
function cleanTextForSpeech(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // 1. Strip markdown, brackets, hashes, asterisks
  text = text.replace(/[*#`_~\[\](){}]/g, " ");
  text = text.replace(/Step \d+:\s*/gi, "");

  // 2. Reduce multiple pauses, ellipses, dashes, colons to continuous flow
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

  // Math & Physics notation pronunciation fixes
  text = text.replace(/\bvo\b/gi, "v objective");
  text = text.replace(/\buo\b/gi, "u objective");
  text = text.replace(/\bfo\b/gi, "f objective");
  text = text.replace(/\bfe\b/gi, "f eyepiece");
  text = text.replace(/\bMo\b/gi, "M objective");
  text = text.replace(/\bMe\b/gi, "M eyepiece");

  // Mathematical operators to spoken words
  text = text.replace(/\+/g, " plus ");
  text = text.replace(/\s-\s/g, " minus ");
  text = text.replace(/\s\*\s|\s×\s/g, " into ");
  text = text.replace(/\s\/\s|\s÷\s/g, " divided by ");
  text = text.replace(/\s=\s/g, " equals ");
  text = text.replace(/\s≈\s/g, " approximately equals ");

  // 4. Aggressively strip mid-sentence commas & hinge pauses so speech flows seamlessly
  text = text.replace(/,\s*(hai|ki|toh|aur|se|mein|ka|ke|ko|par|jab|tab|isliye|kyuki|lekin)\b/gi, " $1");
  text = text.replace(/([a-zA-Z0-9]+),\s*([a-zA-Z0-9]+)/g, "$1 $2");
  text = text.replace(/,/g, " ");

  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function normalizeMathToTextbook(raw: string): string {
  if (!raw) return "";
  let text = raw;
  text = text.replace(/\\cdot/g, " × ");
  text = text.replace(/\\times/g, " × ");
  text = text.replace(/\\div/g, " ÷ ");
  text = text.replace(/\\approx/g, " ≈ ");
  text = text.replace(/\\le|\\leq/g, " ≤ ");
  text = text.replace(/\\ge|\\geq/g, " ≥ ");
  text = text.replace(/\\pm/g, " ± ");
  text = text.replace(/\\degree/g, "°");
  text = text.replace(/\\theta/g, "θ");
  text = text.replace(/\\alpha/g, "α");
  text = text.replace(/\\beta/g, "β");
  text = text.replace(/\\lambda/g, "λ");
  text = text.replace(/\\pi/g, "π");
  text = text.replace(/\\omega/g, "ω");
  text = text.replace(/\\Delta/g, "Δ");
  text = text.replace(/\\sqrt\{([^}]+)\}/g, "√($1)");
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)");
  return text;
}

interface MessageItem {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: number;
  spokenAudioUrl?: string;
}

interface LiveVideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  subject?: string;
}

export default function LiveVideoCallModal({
  isOpen,
  onClose,
  userId = "student",
  subject = "Physics & Maths",
}: LiveVideoCallModalProps) {
  // Streams & Devices
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Live session UI
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Chat & Realtime state
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [liveAnswerCard, setLiveAnswerCard] = useState<string | null>(null);
  const [activeSpeechText, setActiveSpeechText] = useState("");
  const [callDuration, setCallDuration] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize and run 24h cleanup on open
  useEffect(() => {
    if (isOpen) {
      purgeExpiredSessionData();
      const storageKey = `${STORAGE_PREFIX}${userId}`;
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Date.now() - (parsed.timestamp || 0) < TWENTY_FOUR_HOURS_MS) {
            setMessages(parsed.messages || []);
          } else {
            localStorage.removeItem(storageKey);
          }
        }
      } catch (_) {}

      // Start call timer
      setCallDuration(0);
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }

    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [isOpen, userId]);

  // Persist messages with timestamp
  useEffect(() => {
    if (!isOpen) return;
    try {
      const storageKey = `${STORAGE_PREFIX}${userId}`;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          timestamp: Date.now(),
          messages,
        })
      );
    } catch (_) {}
  }, [messages, isOpen, userId]);

  // Stop camera stream safely
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start Camera Stream
  const startCamera = useCallback(async (facing: "environment" | "user") => {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      // Check flashlight support on environment camera
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        setIsTorchSupported(!!capabilities.torch);
      }
    } catch (err) {
      console.error("Camera access error:", err);
    }
  }, [stream]);

  // Toggle Camera Direction
  const toggleFacingMode = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    setIsTorchOn(false);
    startCamera(nextMode);
  };

  // Toggle Flashlight
  const toggleTorch = async () => {
    if (!stream || !isTorchSupported) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const nextState = !isTorchOn;
      await videoTrack.applyConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn("Torch toggle failed:", err);
    }
  };

  // Toggle Mic Mute
  const toggleMicMute = () => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMuted; // Invert
      setIsMuted(!isMuted);
    }
  };

  // Manual Clear 24hr History
  const clearSessionHistory = () => {
    try {
      const storageKey = `${STORAGE_PREFIX}${userId}`;
      localStorage.removeItem(storageKey);
      setMessages([]);
      setLiveAnswerCard(null);
      setShowClearConfirm(false);
    } catch (_) {}
  };

  // Capture current frame for AI
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  }, []);

  // Audio Playback with fast stop & resume
  const playSpeechAudio = async (text: string) => {
    try {
      if (currentAudioSourceRef.current) {
        try {
          currentAudioSourceRef.current.stop();
        } catch (_) {}
      }

      const clean = cleanTextForSpeech(text);
      if (!clean) return;

      setIsSpeaking(true);
      setActiveSpeechText(clean);

      const res = await fetch(`/api/ai-doubt/live/tts?text=${encodeURIComponent(clean)}`);
      if (!res.ok) throw new Error("TTS failed");

      const audioBlob = await res.blob();
      const arrayBuffer = await audioBlob.arrayBuffer();

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      source.onended = () => {
        setIsSpeaking(false);
        setActiveSpeechText("");
      };

      currentAudioSourceRef.current = source;
      source.start(0);
    } catch (e) {
      console.warn("Speech playback error:", e);
      setIsSpeaking(false);
      setActiveSpeechText("");
    }
  };

  const stopSpeech = () => {
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
      } catch (_) {}
    }
    setIsSpeaking(false);
    setActiveSpeechText("");
  };

  // AI Ask Handler
  const askAIWithQuestion = async (studentQuery: string) => {
    if (!studentQuery.trim()) return;
    setIsAnalyzing(true);

    const userMsg: MessageItem = {
      id: crypto.randomUUID(),
      sender: "user",
      text: studentQuery,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const frameData = captureFrame();

      const response = await fetch("/api/ai-doubt/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: studentQuery,
          image: frameData,
          subject,
          userId,
        }),
      });

      if (!response.ok) throw new Error("Failed to get solution");
      const data = await response.json();
      const answerText = data.answer || "Main is question ko analyze kar raha hoon, kripya thoda wait kijiye.";

      const aiMsg: MessageItem = {
        id: crypto.randomUUID(),
        sender: "ai",
        text: answerText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setLiveAnswerCard(answerText);

      // Play audio automatically
      await playSpeechAudio(answerText);
    } catch (err) {
      const errorMsg: MessageItem = {
        id: crypto.randomUUID(),
        sender: "ai",
        text: "Kshama kijiye, network error ki wajah se answer fetch nahi ho saka. Kripya punah prayas karein.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Push-to-Talk Speech Recognition
  const [isListening, setIsListening] = useState(false);
  const [recognizedTranscript, setRecognizedTranscript] = useState("");

  const startVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const fallbackQuery = prompt("Apna question yahan type karein:");
      if (fallbackQuery) askAIWithQuestion(fallbackQuery);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "hi-IN";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setRecognizedTranscript("");
      };

      recognition.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) {
            setRecognizedTranscript(e.results[i][0].transcript);
          } else {
            interim += e.results[i][0].transcript;
          }
        }
        if (interim) setRecognizedTranscript(interim);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (recognizedTranscript.trim()) {
          askAIWithQuestion(recognizedTranscript.trim());
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  // Copy Solution to Clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Format call duration MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Setup camera on modal open
  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopStream();
      stopSpeech();
    }
    return () => {
      stopStream();
      stopSpeech();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Container */}
      <div className="relative w-full h-full max-w-4xl max-h-[96vh] flex flex-col md:rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl">
        {/* Top Header Bar */}
        <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          {/* Status Badge */}
          <div className="flex items-center space-x-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                PrepWise Live Faculty
              </span>
              <span className="text-[11px] text-slate-300 font-mono">
                {formatTime(callDuration)} • {subject}
              </span>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center space-x-2">
            {/* 24H Shield Notice Badge */}
            <div className="hidden sm:flex items-center px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[10px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5"></span>
              24h Auto-Expiry Active
            </div>

            {/* Chat Drawer Toggle */}
            <button
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className="relative p-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-white border border-slate-700 transition"
              title="Chat History"
            >
              <ChatBubbleIcon className="w-5 h-5 text-slate-200" />
              {messages.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                  {messages.length}
                </span>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={() => {
                stopStream();
                stopSpeech();
                onClose();
              }}
              className="p-2.5 rounded-full bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 transition"
              title="End Call"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Viewport */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition duration-300 ${
              facingMode === "user" ? "-scale-x-100" : ""
            }`}
          />

          {/* Floating AI Teacher HUD Card (Bottom of video) */}
          {liveAnswerCard && (
            <div className="absolute bottom-28 inset-x-4 md:inset-x-8 z-20 max-w-xl mx-auto">
              <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl transition animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
                    <span className="text-xs font-semibold text-blue-300">
                      Live Solution Step
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Audio Speech Toggle */}
                    <button
                      onClick={() =>
                        isSpeaking ? stopSpeech() : playSpeechAudio(liveAnswerCard)
                      }
                      className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center space-x-1 transition ${
                        isSpeaking
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                      }`}
                    >
                      {isSpeaking ? (
                        <>
                          <StopSquareIcon className="w-3.5 h-3.5 mr-1" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <PlayTriangleIcon className="w-3.5 h-3.5 mr-1" />
                          <span>Listen</span>
                        </>
                      )}
                    </button>

                    {/* Copy Solution Button */}
                    <button
                      onClick={() => handleCopy("live_hud", liveAnswerCard)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Copy Solution"
                    >
                      {copiedId === "live_hud" ? (
                        <CopyCheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <CopyDefaultIcon className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-2.5 max-h-36 overflow-y-auto text-sm text-slate-100 font-sans leading-relaxed select-text">
                  {normalizeMathToTextbook(liveAnswerCard)}
                </div>
              </div>
            </div>
          )}

          {/* Analyzing / Listening State Wave Overlay */}
          {(isAnalyzing || isListening) && (
            <div className="absolute top-20 inset-x-0 z-20 flex justify-center">
              <div className="px-4 py-2 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700 shadow-xl flex items-center space-x-3">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping"></span>
                <span className="text-xs font-medium text-slate-200">
                  {isAnalyzing
                    ? "Camera frame analyze kiya ja raha hai..."
                    : `Suniye: "${recognizedTranscript || "Bolte rahiye..."}"`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Interactive HUD Dock */}
        <div className="relative z-30 px-6 py-5 bg-gradient-to-t from-black via-slate-950/90 to-transparent flex items-center justify-between border-t border-slate-900">
          {/* Left Actions: Torch & Flip Camera */}
          <div className="flex items-center space-x-3">
            {/* Flashlight Toggle: Off shows Cut Bulb, On shows Vibrant Filled Bulb */}
            <button
              onClick={toggleTorch}
              disabled={!isTorchSupported || facingMode === "user"}
              className={`p-3.5 rounded-full border transition ${
                isTorchOn
                  ? "bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.6)]"
                  : "bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800"
              } ${!isTorchSupported || facingMode === "user" ? "opacity-40 cursor-not-allowed" : ""}`}
              title={
                !isTorchSupported
                  ? "Torch not available on this device"
                  : isTorchOn
                  ? "Turn Flashlight OFF"
                  : "Turn Flashlight ON"
              }
            >
              {isTorchOn ? (
                <TorchOnIcon className="w-5 h-5 text-amber-950" />
              ) : (
                <TorchOffIcon className="w-5 h-5 text-slate-300" />
              )}
            </button>

            {/* Flip Camera */}
            <button
              onClick={toggleFacingMode}
              className="p-3.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition"
              title="Flip Camera"
            >
              <CameraSwitchIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Center Action: Hold to Speak & Snap */}
          <div className="flex flex-col items-center">
            <button
              onMouseDown={startVoiceInput}
              onMouseUp={stopVoiceInput}
              onTouchStart={startVoiceInput}
              onTouchEnd={stopVoiceInput}
              className={`px-6 py-3.5 rounded-full font-semibold text-sm flex items-center space-x-2 transition shadow-xl ${
                isListening
                  ? "bg-rose-500 text-white scale-105 shadow-rose-500/50"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/40"
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isListening ? "bg-white animate-ping" : "bg-blue-200"
                }`}
              ></span>
              <span>{isListening ? "Sun raha hoon..." : "Hold karke Doubt Puche"}</span>
            </button>
            <span className="text-[10px] text-slate-400 mt-1 font-mono">
              Press & Hold mic or Snap
            </span>
          </div>

          {/* Right Actions: Mic Mute Toggle strictly with Microphone Slashed Icon */}
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleMicMute}
              className={`p-3.5 rounded-full border transition ${
                isMuted
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                  : "bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800"
              }`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? (
                <MicMutedIcon className="w-5 h-5 text-rose-400" />
              ) : (
                <MicActiveIcon className="w-5 h-5 text-slate-200" />
              )}
            </button>
          </div>
        </div>

        {/* Slide-over / Overlay 24h Chat & Notes Drawer */}
        {isDrawerOpen && (
          <div className="absolute inset-y-0 right-0 w-full max-w-md bg-slate-950/95 backdrop-blur-2xl border-l border-slate-800 z-40 flex flex-col shadow-2xl transition">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ChatBubbleIcon className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Live Chat & Solution Notes
                </h3>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* 24h Quota Notice & Manual Clear Banner */}
            <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Chat automatically 24h me clear ho jati hai</span>
              </div>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-medium flex items-center space-x-1"
              >
                <TrashIcon className="w-3 h-3" />
                <span>Clear Now</span>
              </button>
            </div>

            {/* Clear Confirm Dialog */}
            {showClearConfirm && (
              <div className="p-3 bg-rose-950/40 border-b border-rose-800/40 flex items-center justify-between text-xs text-rose-200">
                <span>Kya aap abhi saari chat clear karna chahte hain?</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={clearSessionHistory}
                    className="px-2 py-0.5 rounded bg-rose-600 text-white font-medium"
                  >
                    Haan
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-300"
                  >
                    Nahi
                  </button>
                </div>
              </div>
            )}

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs p-6">
                  <ChatBubbleIcon className="w-8 h-8 mb-2 opacity-40" />
                  <p>Koi previous chat nahi hai.</p>
                  <p className="mt-1">Doubt bolne ke liye hold-to-talk button dabayein.</p>
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
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-sans leading-relaxed shadow-sm ${
                        msg.sender === "user"
                          ? "bg-blue-600 text-white rounded-br-xs"
                          : "bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-xs"
                      }`}
                    >
                      {normalizeMathToTextbook(msg.text)}
                    </div>
                    <div className="flex items-center space-x-2 mt-1 px-1">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {msg.sender === "ai" && (
                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="text-[10px] text-slate-400 hover:text-slate-200"
                        >
                          {copiedId === msg.id ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
