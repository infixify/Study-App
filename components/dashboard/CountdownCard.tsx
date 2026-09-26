interface CountdownCardProps {
  examDate: string; // ISO date
  examLabel: string;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export default function CountdownCard({ examDate, examLabel }: CountdownCardProps) {
  const days = daysUntil(examDate);

  return (
    <div className="mt-6 rounded-ticket bg-ink text-paper p-6 relative overflow-hidden">
      <div className="perf-rail absolute top-0 left-0 right-0 h-3 opacity-10" />
      <p className="text-marigold text-xs font-medium tracking-wide">
        {examLabel.toUpperCase()} · {new Date(examDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      </p>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="font-display text-6xl font-bold leading-none">
          {days}
        </span>
        <span className="text-paper/70 text-sm mb-1">days left</span>
      </div>
    </div>
  );
}
