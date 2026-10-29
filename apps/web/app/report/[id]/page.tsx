import Link from "next/link";
import { AlertTriangle, Award, ArrowLeft } from "lucide-react";
import { type ScoreCard, type InterviewContext } from "@deepinterview/shared";
import { serverEnv } from "@/lib/env";
import { SessionViewSchema } from "@/lib/session";
import { SAMPLE_SCORECARD, SAMPLE_INTERVIEW } from "@/lib/sample-scorecard";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScoreBento } from "@/components/report/score-bento";
import { CompetencyChart } from "@/components/report/competency-chart";
import { LanguageReportCard } from "@/components/report/language-report-card";
import { StrengthsGaps } from "@/components/report/strengths-gaps";
import { ModelAnswers } from "@/components/report/model-answers";
import { ScoringPoll } from "@/components/report/scoring-poll";
import {
  TranscriptSection,
  type TranscriptTurn,
} from "@/components/report/transcript-section";
import { ProctorCleanup } from "@/components/interview/proctor-cleanup";

// Reads server-only config and calls the agent API per request; never prerender.
export const dynamic = "force-dynamic";

/**
 * - `ready`   real scorecard persisted → full report (possibly `degraded`).
 * - `sample`  agent unreachable / unknown session → sample preview.
 * - `empty`   interview produced no answers (status `no_answers`, or a legacy
 *             `complete` row with a blank card) → honest empty state, NOT zeros.
 * - `scoring` interview done but scoring hasn't produced a card yet → poll.
 * - `preparing` the prep pipeline is still building the plan — the interview
 *             hasn't happened yet, so "scoring" would be a lie → poll.
 * - `waiting` prep finished but no interview ever ran (status `ready`, zero
 *             answers). NOT scoring, and polling can never change it: only the
 *             voice worker writes a terminal status, so a session whose worker
 *             never joined would spin forever. See issue #67.
 * - `error`   session errored (scoring failed — retriable) → honest notice.
 */
type ReportState =
  "ready" | "sample" | "empty" | "scoring" | "preparing" | "waiting" | "error";

interface Loaded {
  state: ReportState;
  scorecard: ScoreCard;
  /**
   * The agent deliberately persists degraded cards (numbers-only when the
   * narrative LLM call fails — see the agent's `_degraded_scorecard`). When the
   * persisted card is missing its narrative (or its scores), we still render
   * the report but flag it so the page shows an honest partial-report notice.
   */
  degraded: boolean;
  context: InterviewContext | null;
  company: string | null;
  role: string | null;
}

/**
 * Resolve the report state by reading the agent API
 * (`GET /api/session/{id}` → SessionView, which carries `scorecard` + `context`).
 * The sample preview is used ONLY on a true miss (agent down / unknown session /
 * shape drift). A real session with no answers resolves to `empty` (never a
 * misleading all-zeros card), and an in-flight session resolves to `scoring`.
 */
async function load(id: string): Promise<Loaded> {
  const sample: Loaded = {
    state: "sample",
    scorecard: SAMPLE_SCORECARD,
    degraded: false,
    context: null,
    company: SAMPLE_INTERVIEW.company,
    role: SAMPLE_INTERVIEW.role,
  };

  try {
    const res = await fetch(
      `${serverEnv.agentApiUrl}/api/session/${encodeURIComponent(id)}`,
      { cache: "no-store", signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return sample;

    const parsed = SessionViewSchema.safeParse(await res.json());
    if (!parsed.success) return sample;

    const view = parsed.data;
    const base = {
      degraded: false,
      context: view.context,
      company: view.context?.job.company_name ?? null,
      role: view.context?.job.title ?? null,
    };
    const answers = view.context?.answers.length ?? 0;
    const hasScores = (view.scorecard?.competency_scores?.length ?? 0) > 0;

    // Honest empty: no answers were captured. New sessions are flagged
    // `no_answers`; legacy rows may be `complete` with a blank (score-less) card.
    if (
      view.status === "no_answers" ||
      (answers === 0 && !!view.scorecard && !hasScores)
    ) {
      return { ...base, state: "empty", scorecard: SAMPLE_SCORECARD };
    }
    // `error` now also covers a scoring (evaluate) failure for an answered
    // interview — retriable, so the error copy invites a re-run.
    if (view.status === "error" || view.status === "rejected") {
      return { ...base, state: "error", scorecard: SAMPLE_SCORECARD };
    }
    // A persisted card ALWAYS renders — the agent deliberately writes degraded
    // (numbers-only / narrative-less) cards, and a `complete` session is
    // terminal: polling it forever would never change anything. Flag partial
    // cards so the page shows an honest notice instead of silent blanks.
    if (view.scorecard && (hasScores || view.status === "complete")) {
      const c = view.scorecard;
      const narrativeMissing =
        c.strengths.length === 0 &&
        c.weaknesses.length === 0 &&
        c.model_answers.length === 0;
      return {
        ...base,
        state: "ready",
        scorecard: c,
        degraded: !hasScores || narrativeMissing,
      };
    }
    // `complete` but no card at all (partial/legacy write): terminal — treat as
    // a retriable scoring error rather than polling forever.
    if (view.status === "complete") {
      return { ...base, state: "error", scorecard: SAMPLE_SCORECARD };
    }
    // Prep still running: the interview hasn't happened, so don't claim to be
    // scoring it. Genuinely transient — poll.
    if (view.status === "prep") {
      return { ...base, state: "preparing", scorecard: SAMPLE_SCORECARD };
    }
    // Prepped, but nothing was ever recorded. Only the voice worker writes a
    // terminal status (`complete` / `no_answers`), so if it never joined the
    // room this session stays `ready` forever — polling it was the infinite
    // "Scoring your interview…" spinner in #67. Answer the user's real question
    // instead: the interview hasn't run.
    if (answers === 0) {
      return { ...base, state: "waiting", scorecard: SAMPLE_SCORECARD };
    }
    // Answers exist but no card yet — scoring really is in flight. Poll, but
    // the poller gives up and says so rather than spinning forever.
    return { ...base, state: "scoring", scorecard: SAMPLE_SCORECARD };
  } catch {
    return sample;
  }
}

/** Build the question-text lookup + ordered transcript turns. */
function buildTranscript(loaded: Loaded): {
  questionText: Record<string, string>;
  turns: TranscriptTurn[];
} {
  const questionText: Record<string, string> = {};
  const turns: TranscriptTurn[] = [];

  if (loaded.context) {
    const answerByQ = new Map(
      loaded.context.answers.map((a) => [a.question_id, a.transcript]),
    );
    for (const q of loaded.context.plan.questions) {
      // Schema guarantees a non-empty `en`; coalesce for noUncheckedIndexedAccess.
      const text = q.text.en ?? "";
      questionText[q.id] = text;
      turns.push({
        question_id: q.id,
        question: text,
        transcript: answerByQ.get(q.id) ?? null,
      });
    }
  } else {
    const answerByQ = new Map(
      SAMPLE_INTERVIEW.answers.map((a) => [a.question_id, a.transcript]),
    );
    for (const q of SAMPLE_INTERVIEW.questions) {
      questionText[q.id] = q.text;
      turns.push({
        question_id: q.id,
        question: q.text,
        transcript: answerByQ.get(q.id) ?? null,
      });
    }
  }

  return { questionText, turns };
}

/** Shared page chrome for the non-report (status) states. */
function StatusShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d0f12] text-[#f1f3f5] [--color-paper:#0d0f12] [--color-panel:#161a22] [--color-ink:#f1f3f5] [--color-ink-soft:#cbd5e1] [--color-muted:#94a3b8] [--color-faint:#64748b] [--color-line:#262b32] [--color-line-2:#1c222b] [--color-accent:#6366f1] [--color-accent-soft:rgba(99,102,241,0.12)]">
      <ProctorCleanup />
      <header className="sticky top-0 z-50 border-b border-[#262b32] bg-[#12151a]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/candidate/interviews" className="flex items-center gap-2.5 no-underline">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <Award size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-white tracking-tight">InterviewByte</span>
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-400 border border-indigo-500/20">
                  AI Evaluation
                </span>
              </div>
            </div>
          </Link>
          <Link
            href="/candidate/interviews"
            className="flex items-center gap-1.5 rounded-lg border border-[#262b32] bg-[#161a22] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-[#363d47] hover:bg-[#1c222b] hover:text-white"
          >
            ← Back to Portal
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-20 flex justify-center">
        {children}
      </main>
    </div>
  );
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // No auth gate: OSS reads the report through the agent API, which needs no
  // sign-in. (Hosted/multi-tenant deployments add auth as a separate layer.)
  const loaded = await load(id);

  // Still scoring, or still prepping: auto-refresh until terminal. The poller
  // stops after a bounded wait and says so — an indefinite spinner tells the
  // user nothing and hides a stuck pipeline (#67).
  if (loaded.state === "scoring" || loaded.state === "preparing") {
    const preparing = loaded.state === "preparing";
    return (
      <StatusShell>
        <Card className="max-w-md w-full border-[#262b32] bg-[#161a22] text-center shadow-2xl shadow-black/50">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <div className="relative flex items-center justify-center">
              <span
                className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"
                aria-hidden
              />
              <span className="absolute h-5 w-5 rounded-full bg-indigo-500/20 animate-ping" />
            </div>
            <h1 className="font-sans text-2xl font-bold tracking-tight text-white">
              {preparing
                ? "Preparing your interview…"
                : "Scoring your interview…"}
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
              {preparing
                ? "Reading your CV and the job description to build your question plan. This page updates automatically."
                : "Hang tight — we’re analyzing your answers. This page updates automatically the moment your report is ready."}
            </p>
            <ScoringPoll
              stalledMessage={
                preparing
                  ? "Prep is taking longer than expected. It runs on your configured LLM provider — check the agent logs for a failing prep stage, then reload."
                  : "Scoring is taking longer than expected. Check the agent API logs for a failing scoring stage, then reload this page."
              }
            />
          </CardContent>
        </Card>
      </StatusShell>
    );
  }

  // Prepped, but no interview ever ran. This is the state a session sits in
  // when the voice worker never joined the room — the worker is a separate
  // process (`docker compose --profile live up`), and nothing else writes a
  // terminal status. Say that, instead of pretending to score nothing (#67).
  if (loaded.state === "waiting") {
    return (
      <StatusShell>
        <Card className="max-w-md w-full border-[#262b32] bg-[#161a22] text-center shadow-2xl shadow-black/50">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <h1 className="font-sans text-2xl font-bold tracking-tight text-white">
              This interview hasn’t run yet
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
              {loaded.role && loaded.company ? (
                <>
                  Your {loaded.role} interview at {loaded.company} is prepped
                  and ready, but no answers were recorded — so there’s nothing
                  to score.{" "}
                </>
              ) : (
                <>
                  This interview is prepped and ready, but no answers were
                  recorded — so there’s nothing to score.{" "}
                </>
              )}
              Join the interview to start it.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href={`/interview/${encodeURIComponent(id)}`}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 shadow-md shadow-indigo-600/20"
              >
                Join interview
              </Link>
              <Link
                href="/candidate/interviews"
                className="inline-flex items-center justify-center rounded-lg border border-[#262b32] bg-[#1c222b] px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:border-[#363d47] hover:bg-[#252c38] hover:text-white"
              >
                Back to Interviews
              </Link>
            </div>
          </CardContent>
        </Card>
      </StatusShell>
    );
  }

  // No answers captured: honest empty state instead of an all-zeros report.
  if (loaded.state === "empty") {
    return (
      <StatusShell>
        <Card className="max-w-md w-full border-[#262b32] bg-[#161a22] text-center shadow-2xl shadow-black/50">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <h1 className="font-sans text-2xl font-bold tracking-tight text-white">
              No answers recorded
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
              {loaded.role && loaded.company ? (
                <>
                  This {loaded.role} interview at {loaded.company} ended before
                  any question was answered, so there’s nothing to score
                  yet.{" "}
                </>
              ) : (
                <>
                  This interview ended before any question was answered, so
                  there’s nothing to score yet.{" "}
                </>
              )}
              Give it another go — answer out loud and we’ll build your report.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href={`/interview/${encodeURIComponent(id)}`}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 shadow-md shadow-indigo-600/20"
              >
                Practice again
              </Link>
              <Link
                href="/candidate/interviews"
                className="inline-flex items-center justify-center rounded-lg border border-[#262b32] bg-[#1c222b] px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:border-[#363d47] hover:bg-[#252c38] hover:text-white"
              >
                Back to Interviews
              </Link>
            </div>
          </CardContent>
        </Card>
      </StatusShell>
    );
  }

  // Session errored — scoring failed before a card was saved. The agent keeps
  // the session's answers, so scoring is retriable; be honest, don't fake zeros.
  if (loaded.state === "error") {
    return (
      <StatusShell>
        <Card className="max-w-md w-full border-[#262b32] bg-[#161a22] text-center shadow-2xl shadow-black/50">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <h1 className="font-sans text-2xl font-bold tracking-tight text-white">
              We couldn’t score this interview
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
              Scoring hit a temporary error, so we’re not showing a report
              rather than show inaccurate results. Your answers are saved and
              scoring can be retried — check back here in a few minutes, or
              start another run.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href={`/report/${encodeURIComponent(id)}`}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 shadow-md shadow-indigo-600/20"
              >
                Check again
              </Link>
              <Link
                href="/candidate/interviews"
                className="inline-flex items-center justify-center rounded-lg border border-[#262b32] bg-[#1c222b] px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:border-[#363d47] hover:bg-[#252c38] hover:text-white"
              >
                Back to Interviews
              </Link>
            </div>
          </CardContent>
        </Card>
      </StatusShell>
    );
  }

  // ready | sample → the full report.
  const { scorecard } = loaded;
  const { questionText, turns } = buildTranscript(loaded);

  return (
    <div className="min-h-screen bg-[#0d0f12] text-[#f1f3f5] [--color-paper:#0d0f12] [--color-panel:#161a22] [--color-ink:#f1f3f5] [--color-ink-soft:#cbd5e1] [--color-muted:#94a3b8] [--color-faint:#64748b] [--color-line:#262b32] [--color-line-2:#1c222b] [--color-accent:#6366f1] [--color-accent-soft:rgba(99,102,241,0.12)] font-sans antialiased">
      <ProctorCleanup />
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-[#262b32] bg-[#12151a]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/candidate/interviews" className="flex items-center gap-2.5 no-underline">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <Award size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-white tracking-tight">InterviewByte</span>
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-400 border border-indigo-500/20">
                  AI Evaluation
                </span>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {loaded.state === "sample" && (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
                Preview (sample data)
              </span>
            )}
            <Link
              href="/candidate/interviews"
              className="flex items-center gap-1.5 rounded-lg border border-[#262b32] bg-[#161a22] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-[#363d47] hover:bg-[#1c222b] hover:text-white"
            >
              ← Back to Interviews
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div>
          <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-white">Your interview report</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
            {loaded.role && loaded.company ? (
              <span className="text-zinc-200 font-semibold">
                {loaded.role} · {loaded.company}.{" "}
              </span>
            ) : null}
            {scorecard.summary}
          </p>
        </div>

        {/* Partial (degraded) card: the agent persisted it without the full
            narrative — show what's there, with an honest notice. */}
        {loaded.degraded && (
          <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] leading-relaxed text-amber-200">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
              aria-hidden
            />
            <span>
              Partial report: the detailed narrative was unavailable when this
              interview was scored. Your scores are preserved — re-run scoring to
              get the full write-up and model answers.
            </span>
          </div>
        )}

        {/* Bento: hero + top metrics */}
        <section className="mt-8">
          <ScoreBento scorecard={scorecard} />
        </section>

        {/* Competency radar + strengths/gaps */}
        <section className="mt-4 grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Competencies</CardTitle>
              <CardDescription>Scored 0–5 across the rubric.</CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <CompetencyChart competencies={scorecard.competency_scores} />
            </CardContent>
          </Card>

          <div className="lg:col-span-3">
            <StrengthsGaps scorecard={scorecard} />
          </div>
        </section>

        {/* Language report + next steps */}
        <section className="mt-4 grid gap-4 md:grid-cols-2">
          <LanguageReportCard report={scorecard.language_report} />
          <Card>
            <CardHeader>
              <CardTitle>Next steps</CardTitle>
              <CardDescription>
                What to drill before your next run.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <ol className="space-y-3">
                {scorecard.next_steps.map((step, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-sm leading-relaxed text-zinc-300"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 font-mono text-[11px] text-indigo-400 border border-indigo-500/30">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>

        {/* Stronger answers */}
        <section className="mt-4">
          <ModelAnswers
            answers={scorecard.model_answers}
            questionText={questionText}
          />
        </section>

        {/* Transcript */}
        <section className="mt-4">
          <TranscriptSection turns={turns} />
        </section>

        {/* CTA */}
        <section className="mt-6">
          <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-[#161a22] to-purple-950/30 p-6 shadow-xl">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-sans text-xl font-bold text-white">
                  Turn these gaps into a study plan
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Your Prep Coach builds focused drills around your weak areas —
                  then you run it back.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Link
                  href={
                    loaded.state === "ready"
                      ? `/prep?session=${encodeURIComponent(id)}`
                      : "/prep"
                  }
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 shadow-md shadow-indigo-600/20"
                >
                  Coach me on my weak areas
                </Link>
                <Link
                  href="/candidate/interviews"
                  className="inline-flex items-center justify-center rounded-lg border border-[#262b32] bg-[#1c222b] px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:border-[#363d47] hover:bg-[#252c38] hover:text-white"
                >
                  Back to Interviews
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
