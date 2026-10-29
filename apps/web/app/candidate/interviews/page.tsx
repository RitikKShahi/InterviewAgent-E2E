"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Headphones,
  Mic,
  Play,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { candidateFetch } from "@/lib/candidate-client";

export default function CandidateInterviewsPage() {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feedback modal
  const [activeFeedback, setActiveFeedback] = useState<any>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  async function loadInterviews() {
    try {
      setLoading(true);
      const data = await candidateFetch<any[]>("/api/candidate/interviews");
      setInterviews(data);
    } catch (err: any) {
      setError(err.message || "Failed to load interviews");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInterviews();
  }, []);

  async function viewFeedback(sessionId: string) {
    try {
      setLoadingFeedback(true);
      const res = await candidateFetch<any>(`/api/candidate/interviews/${sessionId}/feedback`);
      setActiveFeedback(res);
    } catch (err: any) {
      alert(err.message || "Feedback not yet available");
    } finally {
      setLoadingFeedback(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Scheduled Interviews</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Access your autonomous AI voice interview sessions, review instructions, and join the live room.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : interviews.length === 0 ? (
        <div className="rounded-2xl border border-[#262b32] bg-[#161a22] p-12 text-center text-sm text-zinc-400">
          <p>No interviews currently scheduled. Once a recruiter shortlists your application, an interview slot will appear here.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {interviews.map((sess) => {
            const formattedDate = new Date(sess.scheduled_start).toLocaleString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={sess.id}
                className="rounded-2xl border border-[#262b32] bg-[#161a22] p-6 space-y-5 hover:border-indigo-500/30 transition-all shadow-lg"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400">
                      AI Voice Technical Interview
                    </span>
                    <h2 className="text-xl font-bold text-white mt-1.5">{sess.job_title}</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {sess.company_name} • Recruiter: {sess.recruiter_name}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => viewFeedback(sess.id)}
                      className="rounded-lg border border-[#2a303c] bg-[#1c222b] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-indigo-500 hover:text-white"
                    >
                      Recruiter Feedback
                    </button>

                    <Link
                      href={`/interview/${sess.id}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/30 hover:from-blue-500 hover:to-indigo-500 transition-all"
                    >
                      <Play size={14} />
                      Join Live Interview
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-[#1c222b] p-4 border border-[#2a303c] text-xs">
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Scheduled Date & Time</span>
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Calendar size={13} className="text-blue-400" />
                      {formattedDate}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-500 block mb-0.5">Duration & Timezone</span>
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Clock size={13} className="text-purple-400" />
                      {sess.duration_minutes} Minutes ({sess.timezone})
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-500 block mb-0.5">Session Status</span>
                    <span className="font-semibold text-emerald-400 capitalize">
                      {sess.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Candidate Interview Tips */}
                <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 p-4 space-y-2">
                  <p className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                    <Headphones size={14} />
                    Interview Guidelines & Preparation
                  </p>
                  <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                    <li>Grant microphone permissions when entering the interview room.</li>
                    <li>The AI agent asks role-specific questions and evaluates your spoken technical responses.</li>
                    <li>If you encounter audio issues, you can type your answers directly using the interactive text fallback.</li>
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recruiter Feedback Modal */}
      {activeFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#262b32] bg-[#161a22] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#262b32] pb-3">
              <h2 className="text-base font-bold text-white">Interview Feedback</h2>
              <button onClick={() => setActiveFeedback(null)} className="text-zinc-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {activeFeedback.shared ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                  <p className="text-xs text-emerald-400 font-semibold">Evaluation Score</p>
                  <p className="text-2xl font-bold text-white mt-0.5">{activeFeedback.overall_score}%</p>
                </div>

                {activeFeedback.feedback && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-zinc-300">Recruiter Notes</p>
                    <p className="text-xs text-zinc-300 leading-relaxed bg-[#1c222b] p-3 rounded-lg border border-[#2a303c]">
                      {activeFeedback.feedback}
                    </p>
                  </div>
                )}

                {activeFeedback.strengths?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-zinc-300">Key Strengths Highlighted</p>
                    <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                      {activeFeedback.strengths.map((s: string, idx: number) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-zinc-400">
                <p>{activeFeedback.message}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveFeedback(null)}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
