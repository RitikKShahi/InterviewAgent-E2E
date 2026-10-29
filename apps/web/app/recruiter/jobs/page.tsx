"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  ChevronRight,
  Filter,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { recruiterFetch } from "@/lib/recruiter-client";

export default function RecruiterJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("AI Platform");
  const [location, setLocation] = useState("San Francisco, CA (Hybrid)");
  const [jobType, setJobType] = useState("Full-time");
  const [experienceLevel, setExperienceLevel] = useState("Senior");
  const [minExp, setMinExp] = useState(4.0);
  const [salary, setSalary] = useState("$180,000 - $220,000");
  const [topK, setTopK] = useState(3);
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");

  async function loadJobs() {
    try {
      setLoading(true);
      const data = await recruiterFetch<any[]>("/api/recruiter/jobs");
      setJobs(data);
    } catch (err: any) {
      setError(err.message || "Failed to load job listings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, []);

  async function handleCreateJob(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await recruiterFetch("/api/recruiter/jobs", {
        method: "POST",
        body: JSON.stringify({
          title,
          department,
          location,
          job_type: jobType,
          experience_level: experienceLevel,
          min_experience_years: Number(minExp),
          salary_range: salary,
          top_k: Number(topK),
          description,
          requirements,
          status: "published",
        }),
      });
      setShowModal(false);
      // Reset form
      setTitle("");
      setDescription("");
      setRequirements("");
      await loadJobs();
    } catch (err: any) {
      alert(err.message || "Failed to create job");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Job Openings</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Create and manage job requisitions, configure Top-K parameters, and monitor applicants.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition-colors"
        >
          <Plus size={16} />
          Post New Opening
        </button>
      </div>

      {/* Jobs List */}
      <div className="rounded-2xl border border-[#262b32] bg-[#161a22] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-400">Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-400">
            No jobs found. Create your first job opening to start receiving applicants!
          </div>
        ) : (
          <div className="divide-y divide-[#262b32]">
            {jobs.map((job) => (
              <div key={job.id} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-[#1a1f27] transition-colors">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link href={`/recruiter/jobs/${job.id}`} className="text-lg font-semibold text-white hover:text-indigo-400 transition-colors">
                      {job.title}
                    </Link>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                      {job.status}
                    </span>
                    <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-400 border border-indigo-500/20">
                      Top-K: {job.top_k}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <span className="text-zinc-300">{job.department}</span>
                    <span>•</span>
                    <span>{job.location}</span>
                    <span>•</span>
                    <span>{job.job_type}</span>
                    <span>•</span>
                    <span>Min {job.min_experience_years} yrs</span>
                    {job.salary_range && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-400/90">{job.salary_range}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2 max-w-2xl">{job.description}</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-base font-bold text-white">{job.applicant_count} Applicants</p>
                    <p className="text-xs text-purple-400 font-medium">{job.shortlisted_count} Shortlisted</p>
                  </div>

                  <Link
                    href={`/recruiter/jobs/${job.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600/10 border border-indigo-500/30 px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                  >
                    <span>View Applicants</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Job Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-[#262b32] bg-[#161a22] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#262b32] pb-4 mb-4">
              <h2 className="text-lg font-bold text-white">Create New Job Opening</h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lead Voice Agent Systems Engineer"
                  className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Job Type</label>
                  <select
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                    className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Part-time">Part-time</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Min Years Exp</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={minExp}
                    onChange={(e) => setMinExp(Number(e.target.value))}
                    className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-indigo-300 mb-1">Top-K Shortlist *</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    className="w-full rounded-lg border border-indigo-500/40 bg-[#1a1f26] px-3 py-2 text-sm text-white font-semibold focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Salary Range</label>
                <input
                  type="text"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="e.g. $170k - $210k + Equity"
                  className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Job Description *</label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Outline role responsibilities, mission, and background..."
                  className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Required Skills & Technologies</label>
                <input
                  type="text"
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="Python, FastAPI, LiveKit, WebRTC, LangGraph, React, TypeScript"
                  className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#262b32]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-[#2a303c] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-[#1a1f26]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {submitting ? "Publishing..." : "Publish Job Opening"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
