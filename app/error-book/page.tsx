// app/error-book/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import AppHeader from "@/components/dashboard/AppHeader";
import BottomNav from "@/components/dashboard/BottomNav";

interface ErrorEntry {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  notes: string;
  tag: "Silly Error" | "Formula Gap" | "Concept Flaw" | "Time Panic";
  audioBase64?: string;
  createdAt: string;
}

export default function ErrorBookPage() {
  const [entries, setEntries] = useState<ErrorEntry[]>([]);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form Fields
  const [title, setTitle] = useState<string>("");
  const [subject, setSubject] = useState<string>("Physics");
  const [chapter, setChapter] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [tag, setTag] = useState<ErrorEntry["tag"]>("Concept Flaw");

  // Audio Recording (In-app voice memo)
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<any[]>([]);

  useEffect(() => {
    const local = localStorage.getItem("prepwise_error_book");
    if (local) {
      try {
        setEntries(JSON.parse(local));
      } catch (e) {}
    }
  }, []);

  const saveEntriesToStorage = (updated: ErrorEntry[]) => {
    setEntries(updated);
    localStorage.setItem("prepwise_error_book", JSON.stringify(updated));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new (window as any).MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event: any) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone permission denied or not available on this device.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: ErrorEntry = {
      id: Date.now().toString(),
      title,
      subject,
      chapter: chapter || "General",
      notes,
      tag,
      audioBase64: audioBase64 || undefined,
      createdAt: new Date().toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      }),
    };

    saveEntriesToStorage([newEntry, ...entries]);
    setShowAddModal(false);
    setTitle("");
    setChapter("");
    setNotes("");
    setAudioBase64(null);
  };

  const deleteEntry = (id: string) => {
    saveEntriesToStorage(entries.filter((e) => e.id !== id));
  };

  const exportBackup = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(entries, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute(
      "download",
      `prepwise_error_book_${new Date().toISOString().split("T")[0]}.json`
    );
    dlAnchorElem.click();
  };

  return (
    <div className="min-h-screen bg-paper pb-28">
      <AppHeader />

      <main className="max-w-md mx-auto px-5 pt-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-ink">📕 Error Book</h1>
            <p className="text-[11px] text-slate mt-0.5">
              Saved on device • Zero cloud cost
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={exportBackup}
              className="px-2.5 py-1.5 bg-ink/5 hover:bg-ink/10 text-ink rounded-lg text-[10px] font-bold"
            >
              Export JSON
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 bg-teal text-white rounded-lg text-xs font-bold shadow-xs hover:bg-teal/90"
            >
              + Log Mistake
            </button>
          </div>
        </div>

        {/* Entries List */}
        {entries.length === 0 ? (
          <div className="bg-white rounded-ticket border border-ink/10 p-8 text-center my-4 shadow-xs">
            <p className="text-3xl mb-2">🎯</p>
            <h3 className="font-bold text-sm text-ink">Your Error Book is Clean!</h3>
            <p className="text-xs text-slate mt-1 max-w-xs mx-auto">
              Whenever you make a mistake in DPP or Mocks, click "+ Log Mistake" to record text or a 30s voice memo so you never repeat it!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white rounded-ticket border border-ink/10 p-4 flex flex-col gap-2 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-ink/60 bg-ink/5 px-2 py-0.5 rounded-full">
                      {entry.subject} • {entry.chapter}
                    </span>
                    <h4 className="font-bold text-xs text-ink mt-1">
                      {entry.title}
                    </h4>
                  </div>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="text-slate hover:text-rose-600 text-xs px-1 font-bold"
                  >
                    ✕
                  </button>
                </div>

                {entry.notes && (
                  <p className="text-xs text-slate bg-paper/60 p-2.5 rounded-xl border border-ink/5 leading-relaxed">
                    {entry.notes}
                  </p>
                )}

                {entry.audioBase64 && (
                  <div className="p-1 bg-ink/5 rounded-xl">
                    <audio
                      controls
                      src={entry.audioBase64}
                      className="w-full h-8"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-ink/5">
                  <span className="font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    {entry.tag}
                  </span>
                  <span className="text-slate font-medium">{entry.createdAt}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-ink/10 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <h3 className="text-sm font-bold text-ink">Record Mistake</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-6 h-6 rounded-full bg-ink/5 text-xs text-ink/60"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">
                  Question Source / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rotational Dynamics HCV Q14"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-ink/15 outline-none focus:border-teal"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate block mb-0.5">
                    Subject
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full p-2 text-xs font-semibold rounded-xl border border-ink/15 bg-white"
                  >
                    <option>Physics</option>
                    <option>Chemistry</option>
                    <option>Mathematics</option>
                    <option>Biology</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate block mb-0.5">
                    Mistake Reason
                  </label>
                  <select
                    value={tag}
                    onChange={(e) => setTag(e.target.value as any)}
                    className="w-full p-2 text-xs font-semibold rounded-xl border border-ink/15 bg-white"
                  >
                    <option>Concept Flaw</option>
                    <option>Formula Gap</option>
                    <option>Silly Error</option>
                    <option>Time Panic</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate block mb-0.5">
                  Explanation / Forgotten Formula
                </label>
                <textarea
                  rows={2}
                  placeholder="What was the trap? Note the correct step/formula..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl border border-ink/15 outline-none focus:border-teal"
                />
              </div>

              {/* 30s Voice Memo */}
              <div className="p-2.5 bg-paper rounded-xl border border-ink/10 flex items-center justify-between">
                <span className="text-[11px] font-bold text-ink">
                  {isRecording ? "🔴 Recording Voice..." : audioBase64 ? "✓ Voice Note Captured" : "🎙️ Optional 30s Voice Memo"}
                </span>

                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="px-2.5 py-1 bg-ink text-paper rounded-lg text-[10px] font-bold"
                  >
                    Record
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold"
                  >
                    Stop
                  </button>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded-xl border border-ink/10 text-xs font-semibold text-slate"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-teal text-white text-xs font-bold shadow-xs hover:bg-teal/90"
                >
                  Save to Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
  }
