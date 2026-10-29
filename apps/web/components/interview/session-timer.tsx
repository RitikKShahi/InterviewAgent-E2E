"use client";

/**
 * <SessionTimer> — a calm mm:ss elapsed clock for the live interview (WP-2).
 *
 * Pure presentational: it owns only a tick interval and is driven by `running`.
 * The container starts it on *connect* (not on mount) by flipping `running`, so
 * it never ticks during the connecting/buffering phase. In preview (offline)
 * mode it renders a static `00:00`.
 *
 * Calm, restrained styling: mono, faint, hairline frosted chip — an interview is
 * already high-stress, so the clock is glanceable but never loud.
 */

import * as React from "react";
import { cn } from "@/lib/cn";
import { useMessages } from "@/lib/i18n/client";
import { t } from "@/lib/i18n";

export interface SessionTimerProps {
  /** When true the clock ticks; flip on connect. Static 00:00 when false. */
  running: boolean;
  className?: string;
}

function format(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SessionTimer({ running, className }: SessionTimerProps) {
  const messages = useMessages();
  const [seconds, setSeconds] = React.useState(0);
  // Remember when the clock first started so a pause/resume keeps the total.
  const startedAtRef = React.useRef<number | null>(null);
  const baseRef = React.useRef(0);

  React.useEffect(() => {
    if (!running) {
      // Freeze the accumulated total; clear the start marker.
      baseRef.current = seconds;
      startedAtRef.current = null;
      return;
    }
    startedAtRef.current = Date.now();
    const id = window.setInterval(() => {
      const started = startedAtRef.current;
      if (started == null) return;
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setSeconds(baseRef.current + elapsed);
    }, 500);
    return () => window.clearInterval(id);
    // `seconds` is intentionally omitted: we snapshot it into baseRef on stop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-slate-800",
        "bg-slate-900/80 px-3.5 py-1.5 backdrop-blur-md shadow-sm",
        className,
      )}
      role="timer"
      aria-label={t(messages, "interview.elapsed")}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          running ? "bg-emerald-400 animate-pulse" : "bg-slate-600",
        )}
        aria-hidden
      />
      <span className="font-mono text-[12px] font-semibold tabular-nums tracking-[0.08em] text-slate-200">
        {format(seconds)}
      </span>
    </div>
  );
}
