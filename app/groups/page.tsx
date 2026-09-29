// app/groups/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/dashboard/AppHeader";
import BottomNav from "@/components/dashboard/BottomNav";

interface Message {
  id: string;
  sender_name: string;
  sender_uid: string;
  content: string;
  created_at: string;
}

export default function GroupsPage() {
  const [currentTab, setCurrentTab] = useState<"world" | "custom">("world");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender_name: "Aman (JEE Dropper)",
      sender_uid: "101",
      content: "Completed Rotational Dynamics today! Solving 30 Qs now.",
      created_at: "10:14 AM",
    },
    {
      id: "2",
      sender_name: "Priya (NEET 2026)",
      sender_uid: "102",
      content: "Botany Plant Kingdom revision done. Daily target 680+!",
      created_at: "10:18 AM",
    },
    {
      id: "3",
      sender_name: "Rohan (Class 12)",
      sender_uid: "103",
      content: "Chemical Kinetics practice complete. 42 Qs with 86% accuracy!",
      created_at: "10:25 AM",
    },
  ]);
  const [inputMsg, setInputMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    async function loadUser() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;
      setCurrentUser(user);

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("uid", user.id)
        .maybeSingle();

      if (profile?.role === "admin") {
        setIsAdmin(true);
      }
    }
    loadUser();
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      sender_name:
        currentUser?.user_metadata?.full_name ||
        currentUser?.email?.split("@")[0] ||
        "Student",
      sender_uid: currentUser?.id || "guest",
      content: inputMsg.trim(),
      created_at: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages([...messages, newMsg]);
    setInputMsg("");
  };

  // Admin / User delete for everyone
  const deleteForEveryone = (id: string) => {
    setMessages(messages.filter((m) => m.id !== id));
  };

  return (
    <div className="min-h-screen bg-paper pb-28">
      <AppHeader />

      <main className="max-w-md mx-auto px-5 pt-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-ink">👥 Study Groups</h1>
            <p className="text-[11px] text-slate mt-0.5">
              Peer accountability & live study feeds
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentTab("world")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
              currentTab === "world"
                ? "bg-teal text-white border-teal shadow-xs"
                : "bg-white text-slate border-ink/10"
            }`}
          >
            🌍 PrepWise World
          </button>
          <button
            onClick={() => setCurrentTab("custom")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
              currentTab === "custom"
                ? "bg-teal text-white border-teal shadow-xs"
                : "bg-white text-slate border-ink/10"
            }`}
          >
            🔒 Private Rooms
          </button>
        </div>

        {/* World Feed */}
        {currentTab === "world" ? (
          <div className="bg-white rounded-ticket border border-ink/10 p-4 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8 text-xs font-bold text-ink">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Global Study Feed
              </span>
              <span className="text-[10px] text-slate">412 Students Active</span>
            </div>

            {/* Chat Messages */}
            <div className="h-72 overflow-y-auto space-y-2.5 pr-1">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className="bg-paper/70 p-2.5 rounded-xl border border-ink/5 flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-teal-800">
                        {m.sender_name}
                      </span>
                      <span className="text-[9.5px] text-slate font-medium">
                        {m.created_at}
                      </span>
                    </div>
                    <p className="text-xs text-ink mt-0.5 leading-snug">
                      {m.content}
                    </p>
                  </div>

                  {/* Admin or self delete */}
                  {(isAdmin || m.sender_uid === currentUser?.id) && (
                    <button
                      onClick={() => deleteForEveryone(m.id)}
                      className="text-[10px] font-bold text-slate hover:text-rose-600 px-1 py-0.5 rounded"
                      title="Delete for everyone"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Send Form */}
            <form onSubmit={handleSend} className="flex gap-1.5 pt-1">
              <input
                type="text"
                placeholder="Share your daily study target..."
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-xl border border-ink/15 bg-white outline-none focus:border-teal"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-teal text-white rounded-xl text-xs font-bold hover:bg-teal/90 shadow-xs"
              >
                Send
              </button>
            </form>
          </div>
        ) : (
          /* Private Groups */
          <div className="bg-white rounded-ticket border border-ink/10 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                JEE Dropper Elite
              </span>
              <span className="text-[10px] text-slate font-bold">24 Members</span>
            </div>
            <h4 className="font-bold text-sm text-ink">Kota 8-Hour Challenge</h4>
            <p className="text-xs text-slate">
              Daily study verification room. Passcode required to join.
            </p>
            <button className="w-full py-2.5 bg-ink text-paper rounded-xl text-xs font-bold hover:bg-ink-100">
              Enter Passcode & Join
            </button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
          }
