interface GreetingHeaderProps {
  name: string;
  streak: number;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function GreetingHeader({ name, streak }: GreetingHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-slate text-sm">{getGreeting()},</p>
        <h1 className="font-display text-2xl font-semibold">{name}</h1>
      </div>

      {/* Streak stamp — deliberately reads like an admit-card verification stamp */}
      <div className="flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 border-coral/70 text-coral rotate-[-6deg]">
        <span className="font-display text-xl font-bold leading-none">
          {streak}
        </span>
        <span className="text-[9px] font-medium mt-0.5">DAY 🔥</span>
      </div>
    </div>
  );
}
