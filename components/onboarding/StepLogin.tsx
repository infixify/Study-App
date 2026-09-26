"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface StepLoginProps {
  onSignedIn: (name: string) => void;
}

export default function StepLogin({ onSignedIn }: StepLoginProps) {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/onboarding`,
      },
    });
    if (error) {
      console.error("Google sign-in failed:", error.message);
      setLoading(false);
    }
    // On success the browser redirects to Google, then back to /onboarding.
    // onSignedIn is NOT called here — the parent page picks up the session
    // on mount after the redirect (see app/onboarding/page.tsx).
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-marigold font-medium">Prepwise</p>
      <h1 className="font-display text-3xl font-semibold leading-tight">
        Every topper's prep starts with one sign-in.
      </h1>
      <p className="text-slate text-sm mt-1 mb-8">
        We'll set up your dashboard around your class, exam, and how you study.
      </p>

      <button
        onClick={handleSignIn}
        disabled={loading}
        className="flex items-center justify-center gap-3 border border-ink/15 bg-white rounded-ticket py-3.5 font-medium text-ink hover:border-ink/30 transition-colors disabled:opacity-60"
      >
        {loading ? (
          <span>Redirecting to Google…</span>
        ) : (
          <>
            <GoogleIcon />
            <span>Continue with Google</span>
          </>
        )}
      </button>

      <p className="text-xs text-slate mt-6 text-center">
        By continuing you agree to Prepwise's Terms and Privacy Policy.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.36 0-4.36-1.6-5.07-3.74H.9v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.93 10.68A5.4 5.4 0 0 1 3.65 9c0-.58.1-1.15.28-1.68V4.99H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.01l3.03-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.99l3.03 2.33C4.64 5.18 6.64 3.58 9 3.58z"/>
    </svg>
  );
}
