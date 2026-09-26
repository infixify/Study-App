"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";

interface AnalyticsRadarProps {
  accuracy: number;    // mock test accuracy, 0-100
  consistency: number; // daily study consistency, 0-100
}

export default function AnalyticsRadar({ accuracy, consistency }: AnalyticsRadarProps) {
  // Recharts' radar needs >=3 axes to read as a shape rather than a line;
  // Speed is a light proxy metric here — swap in a real "avg time/question" stat.
  const speed = Math.round((accuracy + consistency) / 2 - 5);

  const data = [
    { metric: "Accuracy", value: accuracy },
    { metric: "Consistency", value: consistency },
    { metric: "Speed", value: speed },
  ];

  return (
    <div className="mt-4 rounded-ticket border border-ink/10 bg-white p-5">
      <p className="text-sm font-medium mb-1">This week's shape</p>
      <p className="text-xs text-slate mb-2">
        Mock test accuracy and daily consistency, at a glance.
      </p>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="#12172B" strokeOpacity={0.1} />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: "#12172B", fontSize: 12 }}
            />
            <Radar
              dataKey="value"
              stroke="#F2A93B"
              fill="#F2A93B"
              fillOpacity={0.35}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between mt-2 text-xs">
        <span className="text-slate">
          Accuracy <span className="text-ink font-medium">{accuracy}%</span>
        </span>
        <span className="text-slate">
          Consistency <span className="text-ink font-medium">{consistency}%</span>
        </span>
      </div>
    </div>
  );
}
