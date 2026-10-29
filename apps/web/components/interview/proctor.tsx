"use client";

/**
 * <InterviewProctor> — three-layer proctoring for the live interview:
 * 1. Fullscreen gate — blocks interview until fullscreen, warns on exit.
 * 2. Tab-switch detection — counts violations via visibilitychange + blur.
 * 3. Face verification — webcam sampled every 5s vs profile photo histogram.
 */

import * as React from "react";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Eye,
  EyeOff,
  Maximize2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type IncidentKind = "tab_switch" | "fullscreen_exit" | "face_missing" | "camera_denied";

export interface Incident {
  kind: IncidentKind;
  at: number;
  count: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TAB_HARD_LIMIT = 3;
const FACE_INTERVAL_MS = 5000;
const SIM_THRESHOLD = 0.55;

// ── Helpers ───────────────────────────────────────────────────────────────────

function reqFs(el: Element) {
  if (el.requestFullscreen) return el.requestFullscreen();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = el as any;
  if (any.webkitRequestFullscreen) return any.webkitRequestFullscreen();
  return Promise.reject(new Error("no fullscreen"));
}

export function inFs() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
}

export function exitFs() {
  if (typeof document === "undefined") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = document as any;
    if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    }
  } catch {}
}

export function stopAllMediaTracks() {
  if (typeof window === "undefined") return;

  // 1. Stop globally registered proctor stream if present
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyWindow = window as any;
  if (anyWindow.__deepinterview_camera_stream) {
    try {
      anyWindow.__deepinterview_camera_stream.getTracks().forEach((t: MediaStreamTrack) => {
        try {
          t.stop();
        } catch {}
      });
      anyWindow.__deepinterview_camera_stream = null;
    } catch {}
  }

  // 2. Stop any active MediaStream on any <video> or <audio> tags in the document
  try {
    const mediaEls = document.querySelectorAll<HTMLMediaElement>("video, audio");
    mediaEls.forEach((el) => {
      if (el.srcObject && "getTracks" in (el.srcObject as MediaStream)) {
        try {
          (el.srcObject as MediaStream).getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {}
          });
          el.srcObject = null;
        } catch {}
      }
    });
  } catch {}
}

function brightness(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): number[] {
  const d = ctx.getImageData(x, y, w, h).data;
  const b: number[] = new Array<number>(16).fill(0);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] ?? 0;
    const g = d[i + 1] ?? 0;
    const bl = d[i + 2] ?? 0;
    const lum = (r * 299 + g * 587 + bl * 114) / 1000;
    const idx = Math.min(15, Math.floor(lum / 16));
    b[idx] = (b[idx] ?? 0) + 1;
  }
  const tot = b.reduce((a, v) => a + v, 0) || 1;
  return b.map((v) => v / tot);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi; na += ai * ai; nb += bi * bi;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useProctor({ profilePhotoUrl, active }: { profilePhotoUrl: string | null; active: boolean }) {
  const [fullscreen, setFullscreen] = React.useState(false);
  const [tabViolations, setTabViolations] = React.useState(0);
  const [facePresent, setFacePresent] = React.useState<boolean | null>(null);
  const [incidents, setIncidents] = React.useState<Incident[]>([]);
  const [cameraStream, setCameraStream] = React.useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);

  const tabRef = React.useRef(0);
  const incRef = React.useRef<Incident[]>([]);
  const activeStreamRef = React.useRef<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const refHist = React.useRef<number[] | null>(null);
  const misses = React.useRef(0);

  function addIncident(kind: IncidentKind) {
    const prev = incRef.current;
    const count = prev.filter((i) => i.kind === kind).length + 1;
    const next = [...prev, { kind, at: Date.now(), count }];
    incRef.current = next;
    setIncidents(next);
  }

  const enterFullscreen = React.useCallback(() => {
    reqFs(document.documentElement).then(() => setFullscreen(true)).catch(() => {});
  }, []);

  const exitFullscreen = React.useCallback(() => {
    exitFs();
    setFullscreen(false);
  }, []);

  const stopCamera = React.useCallback(() => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      activeStreamRef.current = null;
    }
    stopAllMediaTracks();
    setCameraStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.remove();
      videoRef.current = null;
    }
    if (canvasRef.current) {
      canvasRef.current.remove();
      canvasRef.current = null;
    }
  }, []);

  // Fullscreen tracking
  React.useEffect(() => {
    if (!active) return;
    function onFsChange() {
      const f = inFs();
      setFullscreen(f);
      if (!f) addIncident("fullscreen_exit");
    }
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Tab/focus tracking
  React.useEffect(() => {
    if (!active) return;
    function onHide() {
      if (document.visibilityState === "hidden") {
        tabRef.current++; setTabViolations(tabRef.current); addIncident("tab_switch");
      }
    }
    function onBlur() {
      if (!inFs()) return;
      tabRef.current++; setTabViolations(tabRef.current); addIncident("tab_switch");
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", onBlur);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Camera + face scan
  React.useEffect(() => {
    if (!active || !profilePhotoUrl) {
      stopCamera();
      return;
    }
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: 320, height: 240 }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => {
            try { t.stop(); } catch {}
          });
          return;
        }
        activeStreamRef.current = s;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__deepinterview_camera_stream = s;
        setCameraStream(s);
        const vid = document.createElement("video");
        vid.srcObject = s; vid.playsInline = true; vid.muted = true; vid.autoplay = true;
        vid.style.display = "none"; document.body.appendChild(vid);
        videoRef.current = vid;
        const cnv = document.createElement("canvas");
        cnv.style.display = "none"; document.body.appendChild(cnv);
        canvasRef.current = cnv;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = profilePhotoUrl.startsWith("http")
          ? profilePhotoUrl
          : `http://localhost:8003${profilePhotoUrl}`;
        img.onload = () => {
          const rc = document.createElement("canvas"); rc.width = 64; rc.height = 64;
          const rctx = rc.getContext("2d");
          if (rctx) { rctx.drawImage(img, 0, 0, 64, 64); refHist.current = brightness(rctx, 0, 0, 64, 64); }
        };
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError("Camera access denied.");
          addIncident("camera_denied");
        }
      });
    return () => {
      cancelled = true;
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, profilePhotoUrl, stopCamera]);

  React.useEffect(() => {
    if (!active || !profilePhotoUrl) return;
    const t = setInterval(() => {
      const vid = videoRef.current; const cnv = canvasRef.current;
      if (!vid || !cnv || vid.readyState < 2) return;
      cnv.width = 64; cnv.height = 64;
      const ctx = cnv.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(vid, 0, 0, 64, 64);
      const hist = brightness(ctx, 12, 8, 40, 48);
      const maxB = Math.max(...hist);
      const blank = maxB > 0.9;
      let present = !blank;
      if (refHist.current && !blank) present = cosine(hist, refHist.current) > SIM_THRESHOLD;
      setFacePresent(present);
      if (!present) { misses.current++; if (misses.current >= 2) addIncident("face_missing"); }
      else misses.current = 0;
    }, FACE_INTERVAL_MS);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, profilePhotoUrl]);

  return { fullscreen, tabViolations, facePresent, incidents, cameraStream, cameraError, enterFullscreen, exitFullscreen, stopCamera };
}

// ── Components ────────────────────────────────────────────────────────────────

export function ProctorStatusBar({ state }: { state: ReturnType<typeof useProctor> }) {
  const { fullscreen, tabViolations, facePresent, cameraError } = state;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[#262b32] bg-[#0d0f12]/80 px-3 py-1.5 backdrop-blur-sm text-xs font-medium">
      <span className={`flex items-center gap-1 ${fullscreen ? "text-emerald-400" : "text-rose-400"}`} title="Fullscreen">
        <Maximize2 size={11} />{fullscreen ? "FS" : "No FS"}
      </span>
      <span className="text-[#262b32]">·</span>
      <span className={`flex items-center gap-1 ${tabViolations===0?"text-emerald-400":tabViolations<TAB_HARD_LIMIT?"text-amber-400":"text-rose-400"}`}>
        <Eye size={11} />{tabViolations===0?"OK":`${tabViolations} switch${tabViolations!==1?"es":""}`}
      </span>
      <span className="text-[#262b32]">·</span>
      {cameraError
        ? <span className="flex items-center gap-1 text-zinc-500"><CameraOff size={11}/> Cam off</span>
        : facePresent===null
        ? <span className="flex items-center gap-1 text-zinc-500"><Camera size={11}/> Starting…</span>
        : facePresent
        ? <span className="flex items-center gap-1 text-emerald-400"><ShieldCheck size={11}/> Face ✓</span>
        : <span className="flex items-center gap-1 text-rose-400 animate-pulse"><ShieldAlert size={11}/> No face!</span>
      }
    </div>
  );
}

export function FullscreenGate({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0d0f12]/95 backdrop-blur-lg">
      <div className="mx-4 max-w-md rounded-2xl border border-indigo-500/30 bg-[#161a22] p-8 text-center shadow-2xl shadow-indigo-900/40">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20">
            <Maximize2 className="text-indigo-400" size={28} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Fullscreen Required</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          This interview must be conducted in fullscreen mode. Switching tabs, minimizing, or
          exiting fullscreen will be recorded as a proctoring violation.
        </p>
        <div className="mt-5 space-y-2 rounded-xl border border-[#262b32] bg-[#0d0f12] p-3 text-left text-xs text-zinc-500">
          <p className="flex items-center gap-2"><Eye size={12} className="text-amber-400 shrink-0" />Tab switches are monitored and flagged to the recruiter.</p>
          <p className="flex items-center gap-2"><Camera size={12} className="text-indigo-400 shrink-0" />Your camera verifies your presence during the interview.</p>
          <p className="flex items-center gap-2"><ShieldCheck size={12} className="text-emerald-400 shrink-0" />Proctoring data is only shared with the recruiter.</p>
        </div>
        <button
          type="button" onClick={onEnter}
          className="mt-6 w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shadow-lg shadow-indigo-600/20 active:scale-95"
        >
          Enter Fullscreen &amp; Begin Interview
        </button>
      </div>
    </div>
  );
}

export function FullscreenWarning({ onReenter }: { onReenter: () => void }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-[#0d0f12]/90 backdrop-blur-md">
      <div className="mx-4 max-w-sm rounded-2xl border border-rose-500/30 bg-[#161a22] p-6 text-center shadow-2xl shadow-rose-900/40">
        <div className="mb-3 flex justify-center"><AlertTriangle className="text-rose-400" size={32} /></div>
        <h2 className="text-lg font-bold text-white">Fullscreen Exited</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          You exited fullscreen. This has been recorded as a violation. Please re-enter fullscreen to continue.
        </p>
        <button type="button" onClick={onReenter}
          className="mt-4 w-full rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-rose-500 active:scale-95">
          Re-enter Fullscreen
        </button>
      </div>
    </div>
  );
}

export function TabSwitchWarning({ count, onDismiss }: { count: number; onDismiss: () => void }) {
  const crit = count >= TAB_HARD_LIMIT;
  return (
    <div className={`fixed top-4 left-1/2 z-[9997] -translate-x-1/2 max-w-md w-[calc(100%-2rem)] rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur-md ${crit?"border-rose-500/40 bg-rose-950/90 text-rose-200":"border-amber-500/30 bg-amber-950/80 text-amber-200"}`}>
      <div className="flex items-start gap-3">
        <EyeOff size={18} className={`mt-0.5 shrink-0 ${crit?"text-rose-400":"text-amber-400"}`} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">
            {crit ? `Tab switch limit reached (${count}/${TAB_HARD_LIMIT})` : `Tab switch detected (${count}/${TAB_HARD_LIMIT})`}
          </p>
          <p className="mt-0.5 text-xs opacity-80">
            {crit ? "This will be flagged to the recruiter." : "Switching tabs is being recorded. Please stay on this page."}
          </p>
        </div>
        <button onClick={onDismiss} className="shrink-0 rounded-lg p-1 text-xs opacity-60 hover:opacity-100" aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}

export function FaceWarning({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed top-4 right-4 z-[9997] max-w-xs rounded-2xl border border-rose-500/30 bg-rose-950/90 px-4 py-3 shadow-xl backdrop-blur-md">
      <div className="flex items-start gap-2.5">
        <CameraOff size={16} className="text-rose-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-rose-200">Face not detected</p>
          <p className="mt-0.5 text-xs text-rose-300/80">Please look directly at the camera.</p>
        </div>
        <button onClick={onDismiss} className="text-rose-400/60 hover:text-rose-400 text-xs" aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}

// ── Composed wrapper ──────────────────────────────────────────────────────────

export function InterviewProctor({
  profilePhotoUrl,
  active,
  children,
}: {
  profilePhotoUrl: string | null;
  active: boolean;
  children: React.ReactNode;
}) {
  const proctor = useProctor({ profilePhotoUrl, active });
  const [showTabWarn, setShowTabWarn] = React.useState(false);
  const [showFaceWarn, setShowFaceWarn] = React.useState(false);
  const [hasEnteredFs, setHasEnteredFs] = React.useState(false);
  const prevTab = React.useRef(0);
  const prevFace = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    if (proctor.tabViolations > prevTab.current) {
      prevTab.current = proctor.tabViolations;
      setShowTabWarn(true);
      const t = setTimeout(() => setShowTabWarn(false), 6000);
      return () => clearTimeout(t);
    }
  }, [proctor.tabViolations]);

  React.useEffect(() => {
    if (prevFace.current === true && proctor.facePresent === false) setShowFaceWarn(true);
    if (proctor.facePresent === true) setShowFaceWarn(false);
    prevFace.current = proctor.facePresent;
  }, [proctor.facePresent]);

  // Cleanup camera & fullscreen when unmounting or deactivated
  React.useEffect(() => {
    return () => {
      stopAllMediaTracks();
      exitFs();
    };
  }, []);

  React.useEffect(() => {
    if (!active) {
      stopAllMediaTracks();
      exitFs();
    }
  }, [active]);

  function handleEnterFs() { setHasEnteredFs(true); proctor.enterFullscreen(); }

  const showGate = active && !hasEnteredFs && !proctor.fullscreen;
  const showFsWarn = active && hasEnteredFs && !proctor.fullscreen;

  return (
    <>
      {showGate && <FullscreenGate onEnter={handleEnterFs} />}
      {showFsWarn && <FullscreenWarning onReenter={proctor.enterFullscreen} />}
      {showTabWarn && <TabSwitchWarning count={proctor.tabViolations} onDismiss={() => setShowTabWarn(false)} />}
      {showFaceWarn && <FaceWarning onDismiss={() => setShowFaceWarn(false)} />}
      <div className="relative">{children}</div>
      {active && (
        <div className="fixed bottom-4 right-4 z-50">
          <ProctorStatusBar state={proctor} />
        </div>
      )}
    </>
  );
}
