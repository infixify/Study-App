interface StudyTimeTrackerProps {
  studiedMinutes: number;
  targetMinutes: number;
}

function formatHrs(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function StudyTimeTracker({
  studiedMinutes,
  targetMinutes,
}: StudyTimeTrackerProps) {
  const pct = Math.min(100, Math.round((studiedMinutes / targetMinutes) * 100));

  return (
    <div className="mt-4 rounded-ticket border border-ink/10 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">Today's study time</p>
        <p className="text-xs text-slate">
          {formatHrs(studiedMinutes)} of {formatHrs(targetMinutes)} target
        </p>
      </div>

      <div className="mt-3 h-2.5 rounded-full bg-ink/8 overflow-hidden">
        <div
          className="h-full rounded-full bg-teal transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs text-slate mt-2">
        {pct >= 100
          ? "Target hit — great work today."
          : `${formatHrs(targetMinutes - studiedMinutes)} more to hit today's target.`}
      </p>
    </div>
  );
}
