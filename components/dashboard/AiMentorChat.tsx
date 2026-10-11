// components/dashboard/AiMentorChat.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
  ttsAudio?: string;
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load cached chat history
  useEffect(() => {
    const cached = localStorage.getItem(`${CHAT_CACHE_PREFIX}${userId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        const recentMessages = parsed.filter(
          (msg: Message) => now - new Date(msg.timestamp).getTime() < TTS_CACHE_TTL
        );
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
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
      audioChunksRef.current = [];
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

  // Speech to text using Web Speech API
  const startSpeechToText = useCallback(async () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("Speech recognition not supported in your browser");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === "auto" ? navigator.language : language;

    recognition.onstart = () => {
      setIsRecording(true);
      setError(null);
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      setError("Speech recognition error. Please try again.");
      console.error("Speech recognition error:", event.error);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText((prev) => prev + " " + transcript);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  }, [language]);

  // Hold to speak recording
  const startHoldToSpeak = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Convert audio to text using speech recognition
        await startSpeechToText();
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError("Could not access microphone. Please check permissions.");
      setIsRecording(false);
      console.error("Microphone access error:", err);
    }
  }, [startSpeechToText]);

  const stopHoldToSpeak = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  // Text to speech
  const speakText = useCallback((text: string, lang?: string) => {
    if (!("speechSynthesis" in window)) {
      setError("Text-to-speech not supported in your browser");
      return;
    }

    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang || language;
    utterance.rate = 1;
    utterance.pitch = 1;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      setIsSpeaking(false);
      console.error("TTS error:", event);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [language]);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
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
      
      const aiMessage: Message = {
        id: `msg_${Date.now()}_ai`,
        text: aiText,
        sender: "ai",
        timestamp: new Date(),
        language: data.language || language,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Auto-speak the response
      setTimeout(() => {
        speakText(aiText, data.language || language);
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
      speakText(message.text, message.language);
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
              disabled={isRecording}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md transition-all shrink-0 ${
                isRecording
                  ? "bg-rose-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700"
              }`}
              title="Speech to Text"
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
