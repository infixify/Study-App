// app/onboarding/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import StepRail from "@/components/onboarding/StepRail";
import StepLogin from "@/components/onboarding/StepLogin";
import StepClass from "@/components/onboarding/StepClass";
import StepExam from "@/components/onboarding/StepExam";
import StepMode from "@/components/onboarding/StepMode";
import {
  supabase,
  ClassLevel,
  TargetExam,
  StudyMode,
  OnboardingData,
  saveOnboarding,
} from "@/lib/supabase";

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [checkingSession, setCheckingSession] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData>({
    classLevel: null,
    targetExam: null,
    wantsBoards: true,
    studyMode: null,
    batchOrBranch: null,
  });
  const pendingTokenPollerRef = useRef<any>(null);

  async function goToStep2IfNotOnboarded(userId: string, name: string) {
    const { data: userRow } = await supabase
      .from("users")
      .select("onboarding_completed")
      .eq("uid", userId)
      .maybeSingle();

    if (userRow?.onboarding_completed) {
      router.replace("/dashboard");
      return;
    }

    setUserName(name);
    setStep((s) => (s === 1 ? 2 : s));
  }

  async function handleNativeGoogleTokens(idToken: string, accessToken: string) {
    try {
      const { data: authData, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
        access_token: accessToken || undefined,
      });

      if (!error && authData?.user) {
        const name =
          authData.user.user_metadata?.full_name ||
          authData.user.user_metadata?.name ||
          authData.user.email ||
          "there";
        await goToStep2IfNotOnboarded(authData.user.id, name);
      } else {
        console.error("[NativeAuth] signInWithIdToken error:", error);
      }
    } catch (err) {
      console.error("[NativeAuth] Sign-in error:", err);
    }
  }

  useEffect(() => {
    // 1. Register native Google Sign-In callback
    if (typeof window !== "undefined") {
      (window as any).onNativeGoogleSignInSuccess = async (idToken: string, accessToken: string) => {
        // Clear the pending poller — callback came through properly
        if (pendingTokenPollerRef.current) {
          clearInterval(pendingTokenPollerRef.current);
          pendingTokenPollerRef.current = null;
        }
        await handleNativeGoogleTokens(idToken, accessToken);
      };

      // 2. Poll for __pendingGoogleTokens every 500ms (safety net if callback fires before listener registers)
      pendingTokenPollerRef.current = setInterval(() => {
        const pending = (window as any).__pendingGoogleTokens;
        if (pending?.idToken) {
          // Clear pending so we don't process twice
          (window as any).__pendingGoogleTokens = null;
          clearInterval(pendingTokenPollerRef.current);
          pendingTokenPollerRef.current = null;
          handleNativeGoogleTokens(pending.idToken, pending.accessToken ?? "");
        }
      }, 500);
    }

    // 3. Check existing session
    async function checkSession() {
      const { data: sessionData } = await supabase.auth.getUser();
      if (sessionData?.user) {
        const name =
          sessionData.user.user_metadata?.full_name ||
          sessionData.user.user_metadata?.name ||
          sessionData.user.email ||
          "there";
        await goToStep2IfNotOnboarded(sessionData.user.id, name);
      }
      setCheckingSession(false);
    }
    checkSession();

    // 4. Auth state change listener (web OAuth redirect fallback)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const name =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          session.user.email ||
          "there";
        goToStep2IfNotOnboarded(session.user.id, name);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
      if (pendingTokenPollerRef.current) {
        clearInterval(pendingTokenPollerRef.current);
      }
      if (typeof window !== "undefined") {
        (window as any).onNativeGoogleSignInSuccess = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  async function finish(finalData: OnboardingData) {
    setSaveError(null);
    const result = await saveOnboarding(finalData);
    if (!result.success) {
      setSaveError(result.error || "Something went wrong while saving your profile.");
      return;
    }
    router.push("/dashboard");
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <p className="text-sm text-slate">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-paper">
      <StepRail currentStep={step} totalSteps={TOTAL_STEPS} />

      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-md mx-auto w-full">
        {step === 1 && (
          <StepLogin
            onSignedIn={(name) => {
              setUserName(name);
              next();
            }}
          />
        )}

        {step === 2 && (
          <StepClass
            selected={data.classLevel}
            onSelect={(classLevel: ClassLevel) => {
              setData((d) => ({ ...d, classLevel }));
              next();
            }}
            onBack={back}
          />
        )}

        {step === 3 && (
          <StepExam
            classLevel={data.classLevel}
            selectedExam={data.targetExam}
            wantsBoards={data.wantsBoards}
            onContinue={(targetExam: TargetExam, wantsBoards: boolean) => {
              setData((d) => ({ ...d, targetExam, wantsBoards }));
              next();
            }}
            onBack={back}
          />
        )}

        {step === 4 && (
          <StepMode
            onFinish={(studyMode: StudyMode, batchOrBranch: string | null) => {
              const finalData = { ...data, studyMode, batchOrBranch };
              setData(finalData);
              finish(finalData);
            }}
            onBack={back}
          />
        )}

        {userName && step > 1 && (
          <p className="mt-8 text-sm text-slate text-center">
            Signed in as <span className="text-ink font-medium">{userName}</span>
          </p>
        )}

        {saveError && (
          <div className="mt-4 rounded-ticket border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">Couldn't save your profile</p>
            <p className="mt-0.5 text-red-600">{saveError}</p>
            <button
              onClick={() => setSaveError(null)}
              className="mt-2 text-xs font-medium underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
