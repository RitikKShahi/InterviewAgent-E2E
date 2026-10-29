"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { candidateFetch } from "@/lib/candidate-client";

export default function CandidateApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadApplications() {
      try {
        setLoading(true);
        const data = await candidateFetch<any[]>("/api/candidate/applications");
        setApplications(data);
      } catch (err: any) {
        setError(err.message || "Failed to load applications");
      } finally {
        setLoading(false);
      }
    }
    loadApplications();
  }, []);

  const stages = [
    { key: "applied", label: "Applied" },
    { key: "under_review", label: "Review" },
    { key: "shortlisted", label: "Shortlisted" },
    { key: "interview_scheduled", label: "Interview" },
    { key: "interview_completed", label: "Evaluated" },
    { key: "selected", label: "Offer" },
  ];

  function getStageIndex(status: string): number {
    switch (status) {
      case "applied":
        return 0;
      case "under_review":
        return 1;
      case "shortlisted":
        return 2;
      case "interview_scheduled":
      case "interview_in_progress":
        return 3;
      case "interview_completed":
        return 4;
      case "selected":
        return 5;
      case "rejected":
        return 1;
      default:
        return 0;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">My Applications</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Track the live progression of your job submissions, shortlisting decisions, and scheduled interviews.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-2xl border border-[#262b32] bg-[#161a22] p-12 text-center text-sm text-zinc-400">
          <p>You haven't submitted any job applications yet.</p>
          <Link
            href="/candidate/jobs"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            Explore Open Jobs <ArrowRight size={13} />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const currentStageIdx = getStageIndex(app.status);
            const isRejected = app.status === "rejected";

            return (
              <div
                key={app.id}
                className="rounded-2xl border border-[#262b32] bg-[#161a22] p-6 space-y-4 hover:border-[#384150] transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">{app.job_title}</h2>
                    <p className="text-xs text-blue-400 font-medium">{app.company_name}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Applied on {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {app.interview_session_id && (
                      <Link
                        href="/candidate/interviews"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600/10 border border-indigo-500/30 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all"
                      >
                        <Calendar size={13} />
                        <span>Interview Details</span>
                      </Link>
                    )}

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold border capitalize ${
                        app.status === "shortlisted"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          : app.status === "selected"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : app.status === "rejected"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      }`}
                    >
                      {app.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Status Progression Bar */}
                <div className="pt-2">
                  <div className="grid grid-cols-6 gap-2">
                    {stages.map((st, idx) => {
                      const isComplete = idx <= currentStageIdx && !isRejected;
                      const isCurrent = idx === currentStageIdx;

                      return (
                        <div key={st.key} className="space-y-1 text-center">
                          <div
                            className={`h-1.5 rounded-full transition-colors ${
                              isComplete ? "bg-blue-500" : isRejected && idx === 1 ? "bg-rose-500" : "bg-[#252c38]"
                            }`}
                          />
                          <p
                            className={`text-[10px] font-medium truncate ${
                              isCurrent ? "text-white font-bold" : isComplete ? "text-blue-300" : "text-zinc-500"
                            }`}
                          >
                            {st.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Callout Banners */}
                {app.status === "shortlisted" && (
                  <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5 text-xs text-purple-300 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Sparkles size={16} className="text-purple-400" />
                      Congratulations! You have been shortlisted by the hiring team. An interview session will be scheduled shortly.
                    </span>
                  </div>
                )}

                {app.status === "interview_scheduled" && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar size={16} className="text-amber-400" />
                      Your technical interview with the AI interviewer has been scheduled! Check the interview tab to join.
                    </span>
                    <Link
                      href="/candidate/interviews"
                      className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500 shrink-0"
                    >
                      Join Interview →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
