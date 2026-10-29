import { notFound } from "next/navigation";
import {
  isLiveKitConfigured,
  isSupabaseConfigured,
  serverEnv,
} from "@/lib/env";
import { getUser } from "@/lib/supabase/server";
import { createInterviewToken } from "@/lib/livekit";
import { getPersona } from "@/lib/personas";
import { SessionViewSchema, type SessionView } from "@/lib/session";
import { LiveRoom } from "@/components/interview/live-room";

// Reads server-only config and calls the agent API per request; never prerender.
export const dynamic = "force-dynamic";

/**
 * Live interview screen (WP-2). Server component.
 *
 * Next 15: `params`/`searchParams` are Promises — await them. Page-level auth:
 * when Supabase is configured and there's no user, we still proceed — OSS runs
 * with no sign-in, and the unguessable session id IS the capability (see below).
 *
 * Token: minted server-side via `createInterviewToken` behind an
 * `isLiveKitConfigured()` guard, only after the session is verified to exist and
 * pinned to its own room (there is deliberately no general-purpose token
 * endpoint — a caller cannot mint a token for an arbitrary room or identity).
 * When LiveKit is NOT configured we pass `token=null` so `<LiveRoom>` renders in
 * preview (not-connected) mode — the offline path the build runs with no keys.
 *
 * Capability guard: before minting, the session must exist with the agent
 * (same auth-free read path the report page uses). The session id is an
 * unguessable `sess_<uuid4>` capability URL (OSS no-auth design) — knowing it
 * grants access, but we never mint LiveKit tokens for arbitrary room names.
 */

/**
 * Resolve the session from the agent (`GET /api/session/{id}`). Returns null
 * when the session is unknown, the body doesn't parse, or the agent is
 * unreachable — the token guard FAILS CLOSED (no verified session ⇒ no token).
 */
async function loadSession(id: string): Promise<SessionView | null> {
  try {
    const res = await fetch(
      `${serverEnv.agentApiUrl}/api/session/${encodeURIComponent(id)}`,
      { cache: "no-store", signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return null;
    const parsed = SessionViewSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function loadCompany(id: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `http://127.0.0.1:8003/api/candidate/interviews/public/${encodeURIComponent(id)}`,
      { cache: "no-store", signal: AbortSignal.timeout(3000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.company_name) return data.company_name;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Fetch the candidate's profile photo URL from the candidate service.
 * Used by the proctoring layer for face-presence verification.
 * Returns null when the JWT token is unavailable server-side (the proctoring
 * layer silently degrades to no face-check in that case).
 */
async function loadProfilePhoto(sessionId: string): Promise<string | null> {
  try {
    // The public session endpoint also returns candidate info when available.
    const res = await fetch(
      `http://127.0.0.1:8003/api/candidate/interviews/public/${encodeURIComponent(sessionId)}`,
      { cache: "no-store", signal: AbortSignal.timeout(3000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.candidate_photo_url) return data.candidate_photo_url as string;
      if (data?.avatar_url) return data.avatar_url as string;
    }
  } catch {
    // ignore — proctor runs without face ref
  }
  return null;
}

export default async function InterviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ persona?: string }>;
}) {
  const { id } = await params;
  const { persona: personaId } = await searchParams;

  let identity = `dev-${id}`;
  let name: string | undefined;

  // No auth gate (OSS): an anonymous visitor joins with a session-scoped dev
  // identity. When a user IS signed in (hosted) we use their real identity.
  if (isSupabaseConfigured()) {
    const user = await getUser();
    if (user) {
      identity = user.id;
      name =
        (user.user_metadata?.name as string | undefined) ??
        user.email ??
        undefined;
    }
  }

  const persona = getPersona(personaId);
  const session = await loadSession(id);
  const companyFromSession =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (session?.context as any)?.job?.company_name ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (session?.context as any)?.company?.name;
  const [companyName, profilePhotoUrl] = await Promise.all([
    companyFromSession ? Promise.resolve(companyFromSession as string) : loadCompany(id),
    loadProfilePhoto(id),
  ]);

  // Mint a token only when LiveKit is configured; otherwise preview mode.
  let token: string | null = null;
  let url: string | null = null;
  if (isLiveKitConfigured()) {
    // The session id IS the capability: verify it exists with the agent before
    // minting, and pin the LiveKit room to exactly the verified session id —
    // never a client-supplied room name.
    if (!session || session.session_id !== id) notFound();

    // Only mint a publish-capable token for a session that is still joinable.
    // A shared report/prep link points at the same id; without this a finished
    // (or errored) session's link would still open a live mic into the room.
    const JOINABLE = new Set(["prep", "ready"]);
    if (!JOINABLE.has(session.status)) {
      return (
        <LiveRoom
          sessionId={id}
          persona={persona}
          token={null}
          url={null}
          previewReason="ended"
          companyName={companyName ?? undefined}
          profilePhotoUrl={profilePhotoUrl}
        />
      );
    }

    const room = session.session_id;
    const minted = await createInterviewToken({
      room,
      identity,
      name,
      metadata: { session_id: room },
    });
    token = minted.token;
    url = minted.url;
  }

  return (
    <LiveRoom
      sessionId={id}
      persona={persona}
      token={token}
      url={url}
      companyName={companyName ?? undefined}
      profilePhotoUrl={profilePhotoUrl}
    />
  );
}
