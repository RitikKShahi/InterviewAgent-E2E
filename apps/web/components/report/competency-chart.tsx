"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { CompetencyScore } from "@deepinterview/shared";

const ACCENT = "#6366f1";
const LINE = "#262b32";
const MUTED = "#94a3b8";

/**
 * Calm radar of competency scores on a fixed 0-5 domain. Client island —
 * recharts needs the DOM. The parent passes plain serializable
 * `competency_scores`; we map to recharts' row shape here.
 *
 * ResponsiveContainer collapses to 0 inside auto-height parents, so the wrapper
 * has an explicit height.
 */
export function CompetencyChart({
  competencies,
}: {
  competencies: CompetencyScore[];
}) {
  const data = competencies.map((c) => ({
    competency: c.competency,
    score: c.score,
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={LINE} />
          <PolarAngleAxis
            dataKey="competency"
            tick={{ fill: MUTED, fontSize: 11 }}
          />
          <PolarRadiusAxis
            domain={[0, 5]}
            tickCount={6}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke={ACCENT}
            fill={ACCENT}
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{ r: 2.5, fill: ACCENT, strokeWidth: 0 }}
          />
          <Tooltip
            formatter={(value) => [`${value} / 5`, "Score"]}
            contentStyle={{
              backgroundColor: "#161a22",
              borderRadius: 10,
              border: `1px solid ${LINE}`,
              fontSize: 12,
              color: "#f1f3f5",
              boxShadow: "0 12px 28px -18px rgba(0,0,0,0.5)",
            }}
            labelStyle={{ color: "#f1f3f5", fontWeight: 600 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
