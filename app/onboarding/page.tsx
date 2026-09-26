"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StepRail from "@/components/onboarding/StepRail";
import StepLogin from "@/components/onboarding/StepLogin";
import StepClass from "@/components/onboarding/StepClass";
import StepExam from "@/components/onboarding/StepExam";
import StepMode from "@/components/onboarding/StepMode";
import {
  ClassLevel,
  TargetExam,
  StudyMode,
  OnboardingData,
  mockSaveOnboarding,
} from "@/lib/supabase";

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData>({
    classLevel: null,
    targetExam: null,
    wantsBoards: false,
    studyMode: null,
    batchOrBranch: null,
  });

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  async function finish(finalData: OnboardingData) {
    await mockSaveOnboarding(finalData);
    router.push("/dashboard");
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
      </div>
    </div>
  );
}
