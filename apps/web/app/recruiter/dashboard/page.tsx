"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Plus,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { recruiterFetch } from "@/lib/recruiter-client";

export default function RecruiterDashboardPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [analyticsData, jobsData] = await Promise.all([
          recruiterFetch<any>("/api/recruiter/analytics"),
          recruiterFetch<any[]>("/api/recruiter/jobs"),
        ]);
        setAnalytics(analyticsData);
        setJobs(jobsData);
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard metrics");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-xs text-zinc-400">Loading recruitment intelligence...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-rose-300">
        <p className="text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
        >
          Retry
        </button>
      </div>
    );
  }

  const funnel = analytics?.funnel || {};

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Recruiter Overview</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time pipeline metrics, automated resume scoring, and interview intelligence.
          </p>
        </div>

        <Link
          href="/recruiter/jobs"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition-colors"
        >
          <Plus size={16} />
          Create Job Opening
        </Link>
      </div>

      {/* Analytics Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="rounded-xl border border-[#262b32] bg-[#161a22] p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Active Jobs</span>
            <Briefcase size={16} className="text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{analytics?.active_jobs ?? 0}</div>
          <p className="text-[11px] text-zinc-500 mt-1">{analytics?.total_jobs ?? 0} total created</p>
        </div>

        <div className="rounded-xl border border-[#262b32] bg-[#161a22] p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Applicants</span>
            <Users size={16} className="text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">{analytics?.total_applicants ?? 0}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Across all jobs</p>
        </div>

        <div className="rounded-xl border border-[#262b32] bg-[#161a22] p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Top-K Shortlisted</span>
            <Sparkles size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">{analytics?.shortlisted_applicants ?? 0}</div>
          <p className="text-[11px] text-zinc-500 mt-1">AI ranked & verified</p>
        </div>

        <div className="rounded-xl border border-[#262b32] bg-[#161a22] p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Interviews</span>
            <Calendar size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">{analytics?.interviews_scheduled ?? 0}</div>
          <p className="text-[11px] text-zinc-500 mt-1">{analytics?.interviews_completed ?? 0} completed</p>
        </div>

        <div className="rounded-xl border border-[#262b32] bg-[#161a22] p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Selected / Offers</span>
            <Award size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{analytics?.candidates_selected ?? 0}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Final hires</p>
        </div>

        <div className="rounded-xl border border-[#262b32] bg-[#161a22] p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Avg Match Score</span>
            <TrendingUp size={16} className="text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-white">{analytics?.avg_resume_score ?? 0}%</div>
          <p className="text-[11px] text-zinc-500 mt-1">Weighted criteria</p>
        </div>
      </div>

      {/* Recruitment Funnel Section */}
      <div className="rounded-2xl border border-[#262b32] bg-[#161a22] p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <span>Hiring Funnel Progression</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-[#1c222b] p-4 border border-[#2a303c]">
            <p className="text-xs font-medium text-zinc-400">1. Total Applied</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">
              {(funnel.applied || 0) + (funnel.under_review || 0) + (funnel.shortlisted || 0) + (funnel.interview_scheduled || 0) + (funnel.interview_completed || 0) + (funnel.selected || 0)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Initial candidate applications</p>
          </div>

          <div className="rounded-xl bg-[#1c222b] p-4 border border-[#2a303c]">
            <p className="text-xs font-medium text-zinc-400">2. Shortlisted (Top-K)</p>
            <p className="text-2xl font-bold text-purple-400 mt-1">
              {(funnel.shortlisted || 0) + (funnel.interview_scheduled || 0) + (funnel.interview_completed || 0) + (funnel.selected || 0)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Passed AI resume evaluation</p>
          </div>

          <div className="rounded-xl bg-[#1c222b] p-4 border border-[#2a303c]">
            <p className="text-xs font-medium text-zinc-400">3. Interview Conducted</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {(funnel.interview_scheduled || 0) + (funnel.interview_completed || 0) + (funnel.selected || 0)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Live voice interview agent</p>
          </div>

          <div className="rounded-xl bg-[#1c222b] p-4 border border-[#2a303c]">
            <p className="text-xs font-medium text-zinc-400">4. Selected / Hired</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{funnel.selected || 0}</p>
            <p className="text-[11px] text-zinc-500 mt-1">Passed technical scorecard</p>
          </div>
        </div>
      </div>

      {/* Active Jobs & Top-K Controls */}
      <div className="rounded-2xl border border-[#262b32] bg-[#161a22] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#262b32] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Active Job Openings & Shortlisting</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Manage job requisitions, configure Top-K parameters, and view applicant ranking.</p>
          </div>
          <Link href="/recruiter/jobs" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
            View All Jobs <ArrowRight size={13} />
          </Link>
        </div>

        <div className="divide-y divide-[#262b32]">
          {jobs.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-400">No job openings created yet.</div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-[#1a1f27] transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <Link href={`/recruiter/jobs/${job.id}`} className="text-base font-semibold text-white hover:text-indigo-400 transition-colors">
                      {job.title}
                    </Link>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                      {job.status}
                    </span>
                    <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-400 border border-indigo-500/20">
                      Top-K: {job.top_k}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                    <span>{job.department}</span>
                    <span>•</span>
                    <span>{job.location}</span>
                    <span>•</span>
                    <span>Min {job.min_experience_years} yrs exp</span>
                    {job.salary_range && (
                      <>
                        <span>•</span>
                        <span className="text-zinc-300">{job.salary_range}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{job.applicant_count} Applicants</p>
                    <p className="text-xs text-purple-400">{job.shortlisted_count} Shortlisted</p>
                  </div>

                  <Link
                    href={`/recruiter/jobs/${job.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a303c] bg-[#1c222b] px-3.5 py-2 text-xs font-medium text-zinc-200 hover:border-indigo-500 hover:text-white transition-colors"
                  >
                    <span>Manage & Rank</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
