"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

export interface LiveVideoCallModalProps {
  open: boolean;
  onClose: () => void;
  studentContext?: {
    studentName?: string;
    targetExam?: string;
  };
}

interface LiveMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  time: string;
}

export function LiveVideoCallModal({ open, onClose, studentContext }: LiveVideoCallModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [showMessages, setShowMessages] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 1. Timer
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [open]);

  // Format call duration MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // 2. Start Camera & Audio Stream
  const startCamera = useCallback(async (mode: "environment" | "user") => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      setStream(media);
      if (videoRef.current) {
        videoRef.current.srcObject = media;
      }
    } catch (err) {
      console.error("Camera access failed:", err);
    }
  }, [stream]);

  // Teardown / Cleanup
  const stopAll = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setCallDuration(0);
    setTranscript("");
    setMessages([]);
  }, [stream]);

  // 3. Initialize Camera on Modal Open
  useEffect(() => {
    if (open) {
      startCamera(facingMode);
    } else {
      stopAll();
    }
    return () => {
      stopAll();
    };
  }, [open, facingMode]);

  // 4. Mute / Unmute Microphone
  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted; // Toggle enabled state
        setIsMuted(!isMuted);
      }
    }
  };

  // 5. Flip Camera (Back <-> Front)
  const toggleCameraFacing = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // 6. Speak AI Answer
  const speakResponse = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Clean markdown/symbols for natural voice
    const cleanSpeech = text
      .replace(/\*\*/g, "")
      .replace(/[#*_`]/g, "")
      .replace(/Step \d+:/g, "")
      .slice(0, 300);

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = "hi-IN";
    utterance.rate = 1.05;
    speechSynthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // 7. Capture Frame & Send Query to Live 5-Key Pool
  const sendLiveDoubt = async (spokenText?: string) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);

    let frameBase64 = "";
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = Math.min(video.videoWidth || 640, 640);
      canvas.height = Math.min(video.videoHeight || 480, 480);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frameBase64 = canvas.toDataURL("image/jpeg", 0.7);
      }
    }

    const userQuery = spokenText?.trim() || transcript.trim() || "Camera par jo sawal hai, kripya step-by-step samjhaiye.";
    
    // Add user message
    const userMsg: LiveMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: userQuery,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTranscript("");

    try {
      const res = await fetch("/api/ai-doubt/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frame: frameBase64,
          message: userQuery,
          studentContext,
        }),
      });

      const data = await res.json();
      const aiReply = data?.reply || "Sawal clear nahi dikha, kripya camera thoda nazdeek laayein.";

      const aiMsg: LiveMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: aiReply,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, aiMsg]);
      speakResponse(aiReply);
    } catch {
      const errMsg: LiveMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: "Network issue aaya. Kripya sawal dobara puchiye.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 8. Speech Recognition Listener
  useEffect(() => {
    if (!open) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let current = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          current += event.results[i][0].transcript;
        }
        if (current) {
          setTranscript(current);
        }
      };

      recognition.onend = () => {
        if (open && !isMuted) {
          try { recognition.start(); } catch (_) {}
        }
      };

      recognitionRef.current = recognition;
      if (!isMuted) recognition.start();
    } catch (_) {}

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
    };
  }, [open, isMuted]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden">
      {/* Background Live Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Dark Vignette Overlay for Crisp Readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none" />

      {/* TOP BAR: Call Status, Timer & Camera Controls */}
      <div className="relative z-10 flex items-center justify-between p-4 pt-6">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-black text-white tracking-wide">LIVE AI FACULTY</span>
          <span className="text-[11px] font-mono font-bold text-slate-300">· {formatTime(callDuration)}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Camera Flip Button */}
          <button
            type="button"
            onClick={toggleCameraFacing}
            className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/15 transition active:scale-95"
            title="Flip Camera (Front/Back)"
          >
            🔄
          </button>
        </div>
      </div>

      {/* MIDDLE: Floating AI Answers & Transcripts (Toggleable by Message Button) */}
      {showMessages && (
        <div className="relative z-10 max-w-sm mx-auto w-full px-4 mb-auto max-h-[46vh] overflow-y-auto space-y-2.5">
          {messages.length === 0 ? (
            <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-xs font-bold text-teal-300">Book ya Question Camera par dikhaiye</p>
              <p className="text-[11px] text-slate-300 mt-1">
                Mic se boliye ya niche <span className="text-white font-bold">Ask Live</span> dabaiye. AI turant solve karega!
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-2xl text-xs backdrop-blur-md shadow-lg border ${
                  m.sender === "user"
                    ? "bg-teal-900/80 border-teal-500/40 text-teal-100 ml-8 text-right"
                    : "bg-slate-900/85 border-slate-700/60 text-slate-100 mr-4"
                }`}
              >
                <div className="text-[9px] font-mono text-slate-400 mb-1">
                  {m.sender === "user" ? "You" : "AI Faculty"} · {m.time}
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
              </div>
            ))
          )}

          {isAnalyzing && (
            <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-teal-500/30 rounded-2xl px-3.5 py-2 w-fit">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              <span className="text-xs font-bold text-teal-200">AI Teacher frame analyze kar raha hai...</span>
            </div>
          )}
        </div>
      )}

      {/* Live Speaking Transcript Indicator */}
      {transcript && (
        <div className="relative z-10 mx-auto max-w-xs mb-3 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-center">
          <p className="text-[11px] font-semibold text-emerald-300 truncate">🎙️ "{transcript}"</p>
        </div>
      )}

      {/* BOTTOM CONTROLS DOCK */}
      <div className="relative z-10 p-5 pb-8 flex items-center justify-center gap-4 bg-gradient-to-t from-black via-black/80 to-transparent">
        {/* 1. Mic On/Off Toggle Button */}
        <button
          type="button"
          onClick={toggleMic}
          className={`p-4 rounded-full transition-all active:scale-95 shadow-xl ${
            isMuted
              ? "bg-rose-600 text-white border-2 border-rose-400"
              : "bg-slate-800/90 text-emerald-400 border border-emerald-500/30 hover:bg-slate-700"
          }`}
          title={isMuted ? "Unmute Mic" : "Mute Mic"}
        >
          {isMuted ? "🔇" : "🎙️"}
        </button>

        {/* 2. Instant Live Snapshot & Solve Button */}
        <button
          type="button"
          onClick={() => sendLiveDoubt()}
          disabled={isAnalyzing}
          className="px-6 py-4 rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 disabled:opacity-50 text-white font-black text-sm tracking-wide shadow-2xl active:scale-95 transition-all flex items-center gap-2"
        >
          <span>📸</span>
          <span>{isAnalyzing ? "Solving…" : "Ask Live"}</span>
        </button>

        {/* 3. Messages Button (Toggles AI Text Drawer) */}
        <button
          type="button"
          onClick={() => setShowMessages(!showMessages)}
          className={`p-4 rounded-full transition-all active:scale-95 shadow-xl ${
            showMessages
              ? "bg-indigo-600 text-white border border-indigo-400"
              : "bg-slate-800/90 text-slate-300 border border-slate-700 hover:bg-slate-700"
          }`}
          title="Toggle Written Messages"
        >
          💬
        </button>

        {/* 4. End Call Button */}
        <button
          type="button"
          onClick={onClose}
          className="p-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl active:scale-95 transition-all"
          title="End Video Call"
        >
          🔴
        </button>
      </div>
    </div>
  );
}

export default LiveVideoCallModal;
