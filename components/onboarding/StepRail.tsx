interface StepRailProps {
  currentStep: number;
  totalSteps: number;
}

// Visual reference: the perforated tear-line down the side of an Indian
// exam admit card. Each dot is a step; filled dots are completed.
export default function StepRail({ currentStep, totalSteps }: StepRailProps) {
  return (
    <div className="hidden sm:flex flex-col items-center w-16 bg-ink py-10 relative">
      <span className="font-display text-paper/40 text-xs tracking-wide -rotate-90 whitespace-nowrap mb-16 origin-center">
        ROLL NO. 0{currentStep}
      </span>

      <div className="flex-1 flex flex-col justify-center gap-6">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          return (
            <div key={stepNum} className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 rounded-full border-2 transition-colors ${
                  isDone
                    ? "bg-marigold border-marigold"
                    : isCurrent
                    ? "border-marigold bg-transparent"
                    : "border-paper/25 bg-transparent"
                }`}
              />
              {stepNum < totalSteps && (
                <div className="w-px h-6 bg-paper/15" />
              )}
            </div>
          );
        })}
      </div>

      <div className="w-full h-8 perf-rail opacity-20" />
    </div>
  );
}
