"use client";

/**
 * <AvatarStage> — the avatar centerpiece (WP-9).
 *
 * Two stacked, always-mounted <video loop muted playsInline> layers (idle +
 * speaking) crossfaded by opacity from the `state` prop. WP-2 wires this by
 * passing `useVoiceAssistant().state` straight through — this component stays
 * fully decoupled from LiveKit and is driven entirely by props.
 *
 * Graceful, asset-free fallback (load-bearing): no real loops exist yet, so the
 * placeholder URLs all 404. Rather than flash a broken <video>, the fallback
 * "stage" renders by DEFAULT and a video layer reveals itself only once its
 * `onLoadedData` fires (and hides again on `onError`). With zero assets the
 * fallback is what you see — a calm, editorial gradient panel with the persona
 * name and a state-aware breathing pulse — so the component looks intentional
 * offline. When real MP4s land in `lib/personas.ts`, the videos take over with
 * no code change.
 */

import * as React from "react";
import { cn } from "@/lib/cn";
import type { Persona } from "@/lib/personas";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

export interface AvatarStageProps {
  persona: Persona;
  state: AvatarState;
  className?: string;
  companyName?: string;
}

/**
 * Per-persona fallback hues — kept inside the editorial palette (light, paper,
 * one indigo accent). Each is a subtle two-stop gradient + a soft accent glow,
 * so the three personas read as distinct without leaving the design language.
 */
const FALLBACK_STYLE: Record<
  Persona["id"],
  { gradient: string; glow: string; accent: string }
> = {
  // Anime — dark neon magenta/purple
  anime: {
    gradient: "linear-gradient(165deg, #0f0717 0%, #3b0764 55%, #05020a 100%)",
    glow: "radial-gradient(120% 90% at 50% 25%, rgba(244,114,182,0.32), transparent 70%)",
    accent: "#f472b6",
  },
  // Superhero — cool deep cyan/indigo
  superhero: {
    gradient: "linear-gradient(165deg, #020617 0%, #0c4a6e 55%, #030712 100%)",
    glow: "radial-gradient(120% 90% at 50% 25%, rgba(56,189,248,0.32), transparent 70%)",
    accent: "#38bdf8",
  },
  // Recruiter — sleek slate/indigo
  recruiter: {
    gradient: "linear-gradient(165deg, #090d16 0%, #1e1b4b 55%, #020617 100%)",
    glow: "radial-gradient(120% 90% at 50% 25%, rgba(99,102,241,0.32), transparent 70%)",
    accent: "#818cf8",
  },
  professor: {
    gradient: "linear-gradient(165deg, #02120b 0%, #064e3b 55%, #020b06 100%)",
    glow: "radial-gradient(120% 90% at 50% 25%, rgba(52,211,153,0.32), transparent 70%)",
    accent: "#34d399",
  },
};

type LayerStatus = "loading" | "ready" | "error";

const STATE_LABEL: Record<AvatarState, string> = {
  idle: "IDLE",
  listening: "LISTENING",
  thinking: "THINKING",
  speaking: "SPEAKING",
};

/**
 * Scoped keyframes for the fallback breathing/pulse. Injected as a plain <style>
 * (not styled-jsx) so it needs no globals.css edit and no extra dep. Both
 * animations freeze under `prefers-reduced-motion` per the a11y requirement.
 */
const STAGE_KEYFRAMES = `
@keyframes di-avatar-breathe {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50%      { opacity: 0.8;  transform: scale(1.03); }
}
@keyframes di-avatar-speak {
  0%, 100% { opacity: 0.6;  transform: scale(1); }
  50%      { opacity: 1;    transform: scale(1.08); }
}
.di-avatar-pulse { animation: di-avatar-breathe 4.5s ease-in-out infinite; }
.di-avatar-pulse[data-speaking="true"] { animation: di-avatar-speak 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .di-avatar-pulse { animation: none !important; }
}
`;

export function AvatarStage({ persona, state, className, companyName }: AvatarStageProps) {
  const [idleStatus, setIdleStatus] = React.useState<LayerStatus>("loading");
  const [speakStatus, setSpeakStatus] = React.useState<LayerStatus>("loading");

  const speaking = state === "speaking";
  // Everything that isn't `speaking` (idle / listening / thinking) shows idle.
  const showSpeakingLayer = speaking;

  const idleReady = idleStatus === "ready";
  const speakReady = speakStatus === "ready";
  // Fallback owns the stage whenever the layer we'd want to show isn't ready.
  const fallbackVisible = showSpeakingLayer ? !speakReady : !idleReady;

  const look = FALLBACK_STYLE[persona.id];

  return (
    <div
      className={cn(
        "relative aspect-[4/5] w-full overflow-hidden rounded-2xl",
        "border border-slate-800 bg-slate-900 shadow-2xl select-none",
        className,
      )}
      role="img"
      aria-label={`${persona.name} avatar, ${STATE_LABEL[state].toLowerCase()}`}
    >
      <style>{STAGE_KEYFRAMES}</style>

      {/* Fallback stage — rendered by default; video layers cover it once ready. */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 transition-opacity duration-300 ease-out",
          fallbackVisible ? "opacity-100" : "opacity-0",
        )}
        style={{ background: look.gradient }}
      >
        {/* Soft accent glow + breathing orb behind the name. */}
        <div className="absolute inset-0" style={{ background: look.glow }} />
        <div
          className="di-avatar-pulse absolute left-1/2 top-[34%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          data-speaking={speaking}
          style={{ backgroundColor: look.accent, opacity: 0.5 }}
        />

        {/* Persona identity. Sits above the bottom audio visualizer (h-20 in
            voice-stage), so pad clear of that 5rem band to avoid overlap. */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 px-5 pb-24 text-center">
          <span className="font-sans text-2xl font-bold tracking-tight text-white">{persona.name}</span>
          <span className="max-w-[26ch] text-xs font-semibold leading-snug text-indigo-300">
            {companyName || persona.style}
          </span>
        </div>
      </div>

      {/* Idle layer — visible for idle/listening/thinking. */}
      <video
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          "transition-opacity duration-300 ease-out",
          !showSpeakingLayer && idleReady ? "opacity-100" : "opacity-0",
        )}
        src={persona.idle_url}
        poster={persona.poster_url}
        loop
        muted
        playsInline
        preload="auto"
        autoPlay
        onLoadedData={() => setIdleStatus("ready")}
        onError={() => setIdleStatus("error")}
      />

      {/* Speaking layer — visible only for `speaking`. */}
      <video
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          "transition-opacity duration-300 ease-out",
          showSpeakingLayer && speakReady ? "opacity-100" : "opacity-0",
        )}
        src={persona.speaking_url}
        loop
        muted
        playsInline
        preload="auto"
        autoPlay
        onLoadedData={() => setSpeakStatus("ready")}
        onError={() => setSpeakStatus("error")}
      />

      {/* State pill — small, mono, for at-a-glance clarity. */}
      <div className="absolute left-3 top-3 z-10">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5",
            "bg-slate-900/90 font-mono text-[10px] tracking-[0.12em] text-slate-200",
            "border border-slate-700/80 backdrop-blur-md shadow-sm",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              speaking ? "bg-emerald-400 animate-pulse" : "bg-slate-600",
            )}
          />
          {STATE_LABEL[state]}
        </span>
      </div>
    </div>
  );
}
