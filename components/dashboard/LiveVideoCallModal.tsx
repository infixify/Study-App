// components/dashboard/LiveVideoCallModal.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Sparkles,
  Send,
  MessageSquare,
  AlertCircle,
  Volume2,
  VolumeX,
} from "lucide-react";

interface LiveVideoCallModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  studentContext?: {
    name?: string;
    targetExam?: string;
    classLevel?: string;
    weakChapters?: string[];
  };
}

interface LiveMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  time: string;
  modelUsed?: string;
  provider?: string;
}

// ─── PHONETIC TEACHER NORMALIZER (CLEANS MATH FOR NATURAL ACCENT & FLUIDITY) ───
function cleanTextForNaturalSpeech(raw: string): string {
  if (!raw) return "";
  let text = raw;

  text = text.replace(/[*#`_~]/g, " ");
  text = text.replace(/\$\$|\$/g, " ");
  text = text.replace(/Step \d+:\s*/gi, "");
  text = text.replace(/\\\[|\\\]|\\\(|\\\)/g, "");
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 divided by $2");
  text = text.replace(/\\sqrt\{([^}]+)\}/g, "square root of $1");
  text = text.replace(/\^2/g, " squared");
  text = text.replace(/\^3/g, " cubed");
  text = text.replace(/\^([a-zA-Z0-9]+)/g, " power $1");
  text = text.replace(/\\times/g, " multiplied by ");
  text = text.replace(/\\div/g, " divided by ");
  text = text.replace(/\\pm/g, " plus minus ");
  text = text.replace(/\\approx/g, " approximately ");
  text = text.replace(/\\neq/g, " not equal to ");
  text = text.replace(/\\leq/g, " less than or equal to ");
  text = text.replace(/\\geq/g, " greater than or equal to ");
  text = text.replace(/\\theta/g, " theta ");
  text = text.replace(/\\alpha/g, " alpha ");
  text = text.replace(/\\beta/g, " beta ");
  text = text.replace(/\\pi/g, " pi ");
  text = text.replace(/\\infty/g, " infinity ");
  text = text.replace(/\\rightarrow/g, " gives ");

  text = text.replace(/[\[\]{}()]/g, " ");
  text = text.replace(/[-–—]/g, " ");
  text = text.replace(/\s+/g, " ");
  return text.trim();
}

function formatSolutionText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/[*#`_~]/g, "")
    .replace(/\$\$|\$/g, "")
    .replace(/\\\[|\\\]|\\\(|\\\)/g, "")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)")
    .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
    .replace(/\\times/g, " × ")
    .replace(/\\div/g, " ÷ ")
    .replace(/\\rightarrow/g, " → ")
    .trim();
}

export function LiveVideoCallModal({
  isOpen,
  open,
  onClose,
  studentContext,
}: LiveVideoCallModalProps) {
  // Support both open and isOpen props
  const isModalOpen = isOpen ?? open ?? false;

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [recognizedText, setRecognizedText] = useState("");
  const [textInput, setTextInput] = useState("");
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [aiStatus, setAiStatus] = useState<"listening" | "analyzing" | "speaking" | "idle">("idle");
  const [activeModel, setActiveModel] = useState("gemini-live-teacher");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Stop active audio
  const stopAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsAiSpeaking(false);
    setAiStatus("idle");
  };

  // 3-Tier Speech Engine (Google Neural ➔ Sarvam bulbul:v3 ➔ Native Device)
  const speakText = async (textToSpeak: string) => {
    if (isAudioMuted || !textToSpeak) return;

    stopAudio();
    const cleaned = cleanTextForNaturalSpeech(textToSpeak);
    if (!cleaned) return;

    setIsAiSpeaking(true);
    setAiStatus("speaking");

    // Tier 1 & 2: Remote High-Quality Neural TTS
    try {
      const audioUrl = `/api/ai-doubt/live/tts?text=${encodeURIComponent(cleaned.slice(0, 300))}`;
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      audio.onended = () => {
        setIsAiSpeaking(false);
        setAiStatus("idle");
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        console.warn("TTS stream fallback to browser device speech.");
        fallbackDeviceSpeech(cleaned);
      };

      await audio.play();
      return;
    } catch (e) {
      console.warn("Audio play failed, falling back to Web Speech:", e);
      fallbackDeviceSpeech(cleaned);
    }
  };

  const fallbackDeviceSpeech = (cleanText: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsAiSpeaking(false);
      setAiStatus("idle");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();

    const indianMale = voices.find(
      (v) =>
        (v.lang.includes("hi") || v.lang.includes("IN")) &&
        (v.name.toLowerCase().includes("male") ||
          v.name.toLowerCase().includes("pradeep") ||
          v.name.toLowerCase().includes("hemant") ||
          v.name.toLowerCase().includes("google hi-in"))
    ) || voices.find((v) => v.lang.includes("hi")) || voices.find((v) => v.lang.includes("IN"));

    if (indianMale) utterance.voice = indianMale;
    utterance.rate = 1.05;
    utterance.pitch = 0.95;

    utterance.onend = () => {
      setIsAiSpeaking(false);
      setAiStatus("idle");
    };
    utterance.onerror = () => {
      setIsAiSpeaking(false);
      setAiStatus("idle");
    };

    window.speechSynthesis.speak(utterance);
  };

  // Camera & Stream initialization
  useEffect(() => {
    if (!isModalOpen) {
      stopAudio();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    let isMounted = true;
    async function startCamera() {
      try {
        setCameraError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Welcome Greeting
        const studentName = studentContext?.name || "Beta";
        const exam = studentContext?.targetExam || "JEE/NEET";
        const welcome = `Namaste ${studentName}! Main aapka Live Teacher hoon. ${exam} ka koi bhi doubt screen par dikhao ya seedha pucho!`;
        
        setMessages([
          {
            id: "msg-0",
            sender: "ai",
            text: welcome,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);

        speakText(welcome);
      } catch (err: any) {
        if (!isMounted) return;
        setHasCameraPermission(false);
        setCameraError("Camera/Microphone access not permitted. Please allow permissions.");
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      stopAudio();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isModalOpen]);

  // Video track toggle
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => (t.enabled = isVideoOn));
    }
  }, [isVideoOn]);

  // Mic track toggle
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => (t.enabled = isMicOn));
    }
  }, [isMicOn]);

  // Frame capture
  const captureCurrentFrame = (): string | null => {
    if (!videoRef.current || !isVideoOn) return null;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.75).split(",")[1] || null;
    } catch {
      return null;
    }
  };

  // Submit Doubt Question
  const handleSendQuery = async (queryText?: string) => {
    const textToSend = (queryText || textInput || recognizedText).trim();
    if (!textToSend || isAnalyzing) return;

    stopAudio();
    setIsAnalyzing(true);
    setAiStatus("analyzing");
    setTextInput("");
    setRecognizedText("");

    const userMsg: LiveMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);

    const frameBase64 = captureCurrentFrame();

    try {
      const res = await fetch("/api/ai-doubt/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: textToSend,
          image: frameBase64,
          studentContext: studentContext || {},
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get response");
      }

      const data = await res.json();
      const rawSolution = data?.solution || "Beta, kripya apna sawal dobara pucho.";
      const formattedSolution = formatSolutionText(rawSolution);

      const aiMsg: LiveMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: "ai",
        text: formattedSolution,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        modelUsed: data?.modelUsed,
        provider: data?.provider,
      };

      setMessages((prev) => [...prev, aiMsg]);
      if (data?.modelUsed) setActiveModel(data.modelUsed);

      speakText(formattedSolution);
    } catch (e) {
      const errorMsg: LiveMessage = {
        id: `msg-${Date.now() + 2}`,
        sender: "ai",
        text: "Network issue ya server delay hua hai beta. Ek baar dubara try karo.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
      speakText("Network issue ya server delay hua hai beta. Ek baar dubara try karo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4">
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[850px] bg-slate-950 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              LIVE 1-ON-1
            </div>
            <span className="text-sm font-semibold text-slate-200">
              👨‍🏫 Indian Faculty (AI)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAudioMuted(!isAudioMuted)}
              className={`p-2 rounded-lg border transition ${
                isAudioMuted
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
              title={isAudioMuted ? "Unmute AI Voice" : "Mute AI Voice"}
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 relative flex overflow-hidden">
          
          {/* Video Feed Area */}
          <div className="flex-1 relative bg-slate-900 flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isVideoOn ? "opacity-100" : "opacity-0"
              }`}
            />

            {!isVideoOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2">
                <VideoOff className="w-12 h-12" />
                <span className="text-sm">Camera is Off</span>
              </div>
            )}

            {/* AI Status Overlay Floating Badge */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs text-slate-300 shadow-lg">
              {isAnalyzing ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span className="text-amber-300 font-medium">Faculty Solving Doubt...</span>
                </>
              ) : isAiSpeaking ? (
                <>
                  <span className="flex gap-0.5 items-end h-3">
                    <span className="w-1 bg-emerald-400 h-2 animate-bounce" />
                    <span className="w-1 bg-emerald-400 h-3 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1 bg-emerald-400 h-1.5 animate-bounce [animation-delay:0.4s]" />
                  </span>
                  <span className="text-emerald-300 font-medium">Teacher Explaining...</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span>Ready for Question</span>
                </>
              )}
            </div>

            {/* Subtitles / Latest Explanation Overlay */}
            {messages.length > 0 && messages[messages.length - 1].sender === "ai" && (
              <div className="absolute bottom-6 inset-x-6 z-20 max-w-2xl mx-auto bg-slate-950/90 backdrop-blur-lg border border-slate-700/60 p-4 rounded-xl shadow-2xl transition">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> Teacher Solution
                  </span>
                  <button
                    onClick={() => speakText(messages[messages.length - 1].text)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
                  >
                    <Volume2 className="w-3 h-3" /> Replay
                  </button>
                </div>
                <p className="text-sm text-slate-100 max-h-24 overflow-y-auto leading-relaxed">
                  {messages[messages.length - 1].text}
                </p>
              </div>
            )}
          </div>

          {/* Right Chat History Panel (Collapsible) */}
          {showChatPanel && (
            <div className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col z-20">
              <div className="p-3 border-b border-slate-800 font-semibold text-xs text-slate-400 flex items-center justify-between">
                <span>Call Transcript</span>
                <button
                  onClick={() => setShowChatPanel(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div ref={chatScrollRef} className="flex-1 p-3 overflow-y-auto space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl p-2.5 text-xs ${
                        m.sender === "user"
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-800 text-slate-200 border border-slate-700"
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 px-1">{m.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Controls & Question Input Bar */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-3 z-10">
          
          {/* Media Toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMicOn(!isMicOn)}
              className={`p-2.5 rounded-xl border transition ${
                isMicOn
                  ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                  : "bg-rose-500/20 border-rose-500/40 text-rose-400"
              }`}
            >
              {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`p-2.5 rounded-xl border transition ${
                isVideoOn
                  ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                  : "bg-rose-500/20 border-rose-500/40 text-rose-400"
              }`}
            >
              {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setShowChatPanel(!showChatPanel)}
              className={`p-2.5 rounded-xl border transition ${
                showChatPanel
                  ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-400"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Input Bar for Math or Voice Doubts */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuery();
            }}
            className="flex-1 w-full flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Camera me sawal dikhayein ya type karke pucho..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={isAnalyzing}
              className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-200 outline-none transition placeholder:text-slate-500 disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={!textInput.trim() || isAnalyzing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </button>
          </form>

          {/* End Call Button */}
          <button
            onClick={onClose}
            className="px-3.5 py-2 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition shadow-lg shadow-rose-900/20"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default LiveVideoCallModal;
