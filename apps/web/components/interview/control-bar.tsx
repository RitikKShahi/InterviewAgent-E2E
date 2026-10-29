"use client";

/**
 * <ControlBar> — the small, subtle live-interview controls (WP-2).
 *
 * Pure presentational: mute toggle + end-interview, driven entirely by props so
 * the LIVE container can wire real room controls and the PREVIEW container can
 * render the same chrome disabled. Restrained styling — a calm frosted bar.
 */

import { Mic, MicOff, PhoneOff } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/cn";
import { useMessages } from "@/lib/i18n/client";
import { t } from "@/lib/i18n";

export interface ControlBarProps {
  /** True when the mic is publishing; false when muted. */
  micEnabled: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
  /** Disable all controls (preview / not connected). */
  disabled?: boolean;
  /** True while the end action is in flight. */
  ending?: boolean;
  className?: string;
}

export function ControlBar({
  micEnabled,
  onToggleMute,
  onEnd,
  disabled = false,
  ending = false,
  className,
}: ControlBarProps) {
  const messages = useMessages();
  // Two-tap end: the first tap arms ("Tap again to end"), the second fires.
  // Ending an interview mid-call is irreversible, and End sits next to Mute.
  const [armed, setArmed] = React.useState(false);
  const armTimer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (armTimer.current != null) window.clearTimeout(armTimer.current);
    },
    [],
  );

  function handleEnd() {
    if (disabled || ending) return;
    if (!armed) {
      setArmed(true);
      if (armTimer.current != null) window.clearTimeout(armTimer.current);
      armTimer.current = window.setTimeout(() => setArmed(false), 4000);
      return;
    }
    if (armTimer.current != null) window.clearTimeout(armTimer.current);
    setArmed(false);
    onEnd();
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-slate-800",
        "bg-slate-900/90 p-1.5 backdrop-blur-md shadow-lg shadow-black/40",
        className,
      )}
      role="group"
      aria-label={t(messages, "interview.controls")}
    >
      <button
        type="button"
        onClick={onToggleMute}
        disabled={disabled}
        aria-pressed={!micEnabled}
        aria-label={
          micEnabled
            ? t(messages, "interview.mute")
            : t(messages, "interview.unmute")
        }
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full",
          "transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          "disabled:opacity-40 disabled:pointer-events-none",
          micEnabled
            ? "text-slate-300 hover:bg-slate-800 hover:text-white"
            : "bg-rose-500/20 text-rose-400 border border-rose-500/30",
        )}
      >
        {micEnabled ? (
          <Mic className="h-[18px] w-[18px]" aria-hidden />
        ) : (
          <MicOff className="h-[18px] w-[18px]" aria-hidden />
        )}
      </button>

      <button
        type="button"
        onClick={handleEnd}
        onBlur={() => setArmed(false)}
        disabled={disabled || ending}
        aria-label={
          armed
            ? t(messages, "interview.confirmEnd")
            : t(messages, "interview.end")
        }
        aria-live="polite"
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full px-4",
          "text-[13px] font-medium transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          "disabled:opacity-40 disabled:pointer-events-none",
          armed
            ? "bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-600/30"
            : "bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700",
        )}
      >
        <PhoneOff className="h-4 w-4" aria-hidden />
        {ending
          ? t(messages, "interview.ending")
          : armed
            ? t(messages, "interview.confirmEnd")
            : t(messages, "interview.endButton")}
      </button>
    </div>
  );
}
