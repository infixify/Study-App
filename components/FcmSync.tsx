// components/FcmSync.tsx
"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function FcmSync() {
  useEffect(() => {
    async function saveToken(token: string) {
      if (!token) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("user_fcm_tokens").upsert(
        { user_id: user.id, token, updated_at: new Date().toISOString() },
        { onConflict: "token" }
      );
    }

    const w = window as any;

    // Flutter ne already inject kar diya ho token tab tak
    if (w.__pendingFcmToken) {
      saveToken(w.__pendingFcmToken);
    }

    // Flutter baad mein inject kare tab ke liye
    w.onNativeFCMToken = (token: string) => {
      saveToken(token);
    };
  }, []);

  return null;
}
