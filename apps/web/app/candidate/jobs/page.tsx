"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  Filter,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { candidateFetch, getCandidateUser } from "@/lib/candidate-client";

export default function CandidateJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");

  // Selected job for apply modal
  const [activeJob, setActiveJob] = useState<any>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  // My applied job IDs to display badges
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());

  async function loadJobs() {
    try {
      setLoading(true);
      const url = searchQuery
        ? `/api/candidate/jobs?q=${encodeURIComponent(searchQuery)}`
        : "/api/candidate/jobs";
      const data = await candidateFetch<any[]>(url);
      setJobs(data);

      // Fetch existing applications to know which jobs are already applied
      try {
        const myApps = await candidateFetch<any[]>("/api/candidate/applications");
        const ids = new Set<string>(myApps.map((a: any) => a.job_id));
        setAppliedJobIds(ids);
      } catch {
        // Not logged in or error
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, [searchQuery]);

  async function handleApplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeJob) return;
    setApplying(true);
    setApplyError(null);
    setApplySuccess(null);

    try {
      const res = await candidateFetch<any>(`/api/candidate/jobs/${activeJob.id}/apply`, {
        method: "POST",
        body: JSON.stringify({
          job_id: activeJob.id,
          cover_letter: coverLetter,
        }),
      });

      setApplySuccess(
        `Application submitted successfully! Your resume match score is ${res.score?.overall_score?.toFixed(1) || "evaluated"}%.`
      );
      setAppliedJobIds((prev) => new Set([...prev, activeJob.id]));
      setCoverLetter("");
    } catch (err: any) {
      setApplyError(err.message || "Failed to submit application.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Explore Open Positions</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Browse verified AI, engineering, and product roles with automated resume matching and direct agent interviews.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by role title, technology (e.g. Python, WebRTC, React)..."
            className="w-full rounded-xl border border-[#2a303c] bg-[#161a22] pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <button
          onClick={loadJobs}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shrink-0"
        >
          Search
        </button>
      </div>

      {/* Job Cards Grid */}
      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-[#262b32] bg-[#161a22] p-12 text-center text-sm text-zinc-400">
          No job openings matched your search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {jobs.map((job) => {
            const isApplied = appliedJobIds.has(job.id);

            return (
              <div
                key={job.id}
                className="rounded-2xl border border-[#262b32] bg-[#161a22] p-6 hover:border-[#384150] transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-white hover:text-blue-400 transition-colors">
                        {job.title}
                      </h2>
                      <p className="text-xs font-medium text-blue-400 mt-0.5">
                        {job.company_name || "Nexus AI"}
                      </p>
                    </div>

                    {isApplied ? (
                      <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-[11px] font-semibold text-blue-400 shrink-0">
                        Applied ✓
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-400 shrink-0">
                        {job.job_type}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <MapPin size={13} className="text-zinc-500" />
                      {job.location}
                    </span>
                    <span>•</span>
                    <span>Min {job.min_experience_years} yrs exp</span>
                    {job.salary_range && (
                      <>
                        <span>•</span>
                        <span className="text-zinc-300">{job.salary_range}</span>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                    {job.description}
                  </p>

                  {job.requirements && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {job.requirements.split(",").slice(0, 4).map((tech: string) => (
                        <span
                          key={tech.trim()}
                          className="rounded-md bg-[#1f2630] border border-[#2d3644] px-2 py-0.5 text-[10px] text-zinc-300"
                        >
                          {tech.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#262b32] flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500">
                    Posted {new Date(job.created_at).toLocaleDateString()}
                  </span>

                  <button
                    onClick={() => {
                      setActiveJob(job);
                      setApplyError(null);
                      setApplySuccess(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm"
                  >
                    <span>{isApplied ? "View Details" : "View & Apply"}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View & Apply Modal */}
      {activeJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-[#262b32] bg-[#161a22] p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between border-b border-[#262b32] pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{activeJob.title}</h2>
                <p className="text-xs text-blue-400 mt-0.5">
                  {activeJob.company_name} • {activeJob.department}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-2">
                  <span>{activeJob.location}</span>
                  <span>•</span>
                  <span>{activeJob.job_type}</span>
                  <span>•</span>
                  <span>Min {activeJob.min_experience_years} yrs exp</span>
                  {activeJob.salary_range && <span>• {activeJob.salary_range}</span>}
                </div>
              </div>

              <button onClick={() => setActiveJob(null)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {applySuccess && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{applySuccess}</span>
              </div>
            )}

            {applyError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{applyError}</span>
              </div>
            )}

            {/* Job Description details */}
            <div className="space-y-4 text-xs text-zinc-300 leading-relaxed">
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Role Overview</h3>
                <p className="whitespace-pre-line text-zinc-300">{activeJob.description}</p>
              </div>

              {activeJob.requirements && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Required Skills & Stack</h3>
                  <div className="flex flex-wrap gap-2">
                    {activeJob.requirements.split(",").map((s: string) => (
                      <span key={s.trim()} className="rounded-md bg-[#252e3b] px-2.5 py-1 text-xs text-blue-300">
                        {s.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Application Section */}
            <div className="rounded-xl bg-[#1c222b] p-4 border border-[#2a303c] space-y-3">
              {appliedJobIds.has(activeJob.id) ? (
                <div className="text-center py-3 space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 size={16} />
                    You have already applied for this opening.
                  </div>
                  <p className="text-xs text-zinc-400">
                    Track your stage progression and scheduled interviews under My Applications.
                  </p>
                  <Link
                    href="/candidate/applications"
                    className="inline-block mt-2 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    View My Applications →
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleApplySubmit} className="space-y-3">
                  <h3 className="text-xs font-semibold text-white">One-Click Application</h3>
                  <p className="text-[11px] text-zinc-400">
                    Your active uploaded resume will be parsed and evaluated automatically against the job requirements.
                  </p>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                      Cover Letter or Note to Recruiter (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      placeholder="Share highlights of your relevant projects and background..."
                      className="w-full rounded-lg border border-[#2a303c] bg-[#161a22] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Link href="/candidate/profile" className="text-xs text-blue-400 hover:underline">
                      Update your resume first →
                    </Link>

                    <button
                      type="submit"
                      disabled={applying}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 shadow-md shadow-blue-600/20"
                    >
                      <Sparkles size={14} />
                      {applying ? "Submitting Application..." : "Submit Application"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
