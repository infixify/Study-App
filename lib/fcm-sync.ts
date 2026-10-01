// lib/fcm-sync.ts
import { supabase } from "@/lib/supabase";

export function setupFcmTokenSync() {
  async function saveToken(token: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !token) return;
    await supabase.from("user_fcm_tokens").upsert(
      { user_id: user.id, token, updated_at: new Date().toISOString() },
      { onConflict: "token" }
    );
  }

  const w = window as any;
  if (w.__pendingFcmToken) saveToken(w.__pendingFcmToken);
  w.onNativeFCMToken = (token: string) => saveToken(token);
}
