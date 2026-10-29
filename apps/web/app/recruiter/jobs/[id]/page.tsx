"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  FolderGit2,
  GraduationCap,
  Mail,
  Send,
  Sliders,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { recruiterFetch } from "@/lib/recruiter-client";

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params?.id as string;
  const router = useRouter();

  const [job, setJob] = useState<any>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningTopK, setRunningTopK] = useState(false);
  const [topKValue, setTopKValue] = useState<number>(3);
  const [notification, setNotification] = useState<string | null>(null);

  // Modals state
  const [selectedApplicant, setSelectedApplicant] = useState<any>(null);
  const [overrideModalApp, setOverrideModalApp] = useState<any>(null);
  const [overrideStatus, setOverrideStatus] = useState("shortlisted");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  // Schedule Interview modal
  const [scheduleModalApp, setScheduleModalApp] = useState<any>(null);
  const [scheduleDate, setScheduleDate] = useState("2026-11-02");
  const [scheduleTime, setScheduleTime] = useState("14:00");
  const [scheduleDuration, setScheduleDuration] = useState(45);
  const [scheduleTz, setScheduleTz] = useState("America/Los_Angeles");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      const [jobData, appsData] = await Promise.all([
        recruiterFetch<any>(`/api/recruiter/jobs/${jobId}`),
        recruiterFetch<any[]>(`/api/recruiter/jobs/${jobId}/applicants`),
      ]);
      setJob(jobData);
      setApplicants(appsData);
      setTopKValue(jobData.top_k || 3);
    } catch (err: any) {
      setNotification(err.message || "Failed to load job applicants");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (jobId) loadData();
  }, [jobId]);

  async function handleRunTopK() {
    try {
      setRunningTopK(true);
      setNotification(null);
      const res = await recruiterFetch<any>(`/api/recruiter/jobs/${jobId}/top-k`, {
        method: "POST",
        body: JSON.stringify({ job_id: jobId, top_k: Number(topKValue) }),
      });
      setNotification(res.message);
      await loadData();
    } catch (err: any) {
      setNotification(`Error running Top-K ranking: ${err.message}`);
    } finally {
      setRunningTopK(false);
    }
  }

  async function handleManualOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!overrideModalApp) return;
    try {
      setOverrideSubmitting(true);
      await recruiterFetch(`/api/recruiter/applicants/${overrideModalApp.id}/override`, {
        method: "POST",
        body: JSON.stringify({
          target_status: overrideStatus,
          override_reason: overrideReason || "Recruiter manual review override",
        }),
      });
      setOverrideModalApp(null);
      setOverrideReason("");
      await loadData();
    } catch (err: any) {
      alert(`Override failed: ${err.message}`);
    } finally {
      setOverrideSubmitting(false);
    }
  }

  async function handleScheduleInterview(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleModalApp) return;
    setScheduleError(null);
    try {
      setScheduleSubmitting(true);
      const startIso = `${scheduleDate}T${scheduleTime}:00Z`;
      await recruiterFetch("/api/recruiter/interviews/schedule", {
        method: "POST",
        body: JSON.stringify({
          application_id: scheduleModalApp.id,
          scheduled_start: startIso,
          duration_minutes: Number(scheduleDuration),
          timezone: scheduleTz,
          recruiter_notes: scheduleNotes,
        }),
      });
      setScheduleModalApp(null);
      setNotification(`Interview successfully scheduled and invitation email dispatched to ${scheduleModalApp.candidate_name}!`);
      await loadData();
    } catch (err: any) {
      setScheduleError(err.message || "Scheduling failed. Please verify availability.");
    } finally {
      setScheduleSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button & Title */}
      <div className="flex items-center gap-3">
        <Link href="/recruiter/jobs" className="rounded-lg border border-[#2a303c] p-1.5 text-zinc-400 hover:text-white">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">{job?.title}</h1>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              {job?.status}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {job?.department} • {job?.location} • Min {job?.min_experience_years} yrs exp • {job?.salary_range}
          </p>
        </div>
      </div>

      {notification && (
        <div className="flex items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-xs text-indigo-300">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-indigo-400" />
            {notification}
          </span>
          <button onClick={() => setNotification(null)} className="text-indigo-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top-K Auto Shortlisting Control Panel */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-[#161a22] to-purple-950/30 p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              <h2 className="text-base font-semibold text-white">Automated Top-K Resume Shortlisting</h2>
            </div>
            <p className="text-xs text-zinc-300 max-w-xl">
              Calculates explainable weighted scores (Skills 40%, Experience 30%, Education 15%, Relevance 15%), ranks all applicants, shortlists the Top K, and dispatches notification emails.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-1.5">
              <span className="text-xs text-zinc-400">K =</span>
              <input
                type="number"
                min="1"
                max="20"
                value={topKValue}
                onChange={(e) => setTopKValue(Number(e.target.value))}
                className="w-12 bg-transparent text-sm font-bold text-white focus:outline-none"
              />
            </div>

            <button
              onClick={handleRunTopK}
              disabled={runningTopK}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 transition-all"
            >
              <Sparkles size={14} />
              {runningTopK ? "Ranking Candidates..." : `Run Top-${topKValue} Shortlisting`}
            </button>
          </div>
        </div>
      </div>

      {/* Applicants Table */}
      <div className="rounded-2xl border border-[#262b32] bg-[#161a22] overflow-hidden">
        <div className="border-b border-[#262b32] px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            Applicants ({applicants.length})
          </h2>
          <span className="text-xs text-zinc-400">
            {applicants.filter((a) => a.status === "shortlisted").length} Shortlisted
          </span>
        </div>

        {applicants.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-400">No applicants have applied yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1c222b] text-zinc-400 font-medium border-b border-[#262b32]">
                <tr>
                  <th className="px-6 py-3">Rank & Candidate</th>
                  <th className="px-6 py-3">Match Score</th>
                  <th className="px-6 py-3">Matched Skills</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Interview</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262b32]">
                {applicants.map((app) => {
                  const score = app.score?.overall_score ?? 0;
                  const rank = app.score?.ranked_position;
                  const scoreColor =
                    score >= 80 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : score >= 60 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-rose-400 bg-rose-500/10 border-rose-500/20";

                  const statusColor: Record<string, string> = {
                    shortlisted: "text-purple-400 bg-purple-500/10 border-purple-500/20",
                    applied: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                    under_review: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
                    interview_scheduled: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                    interview_completed: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
                    selected: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                    rejected: "text-rose-400 bg-rose-500/10 border-rose-500/20",
                  };

                  return (
                    <tr key={app.id} className="hover:bg-[#1a1f27] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {rank ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2a303c] text-[11px] font-bold text-zinc-200">
                              #{rank}
                            </span>
                          ) : (
                            <span className="h-6 w-6" />
                          )}
                          {app.candidate_avatar_url ? (
                            <img
                              src={app.candidate_avatar_url}
                              alt={app.candidate_name}
                              className="h-10 w-10 rounded-full object-cover border border-[#2a303c] shadow-sm flex-shrink-0"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white flex-shrink-0">
                              {(app.candidate_name || "C")[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-white text-sm">{app.candidate_name}</p>
                            <p className="text-zinc-400">{app.candidate_email}</p>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              {app.candidate_location} • {app.candidate_experience || 0} yrs exp
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 font-bold border text-xs ${scoreColor}`}>
                            {score.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {app.score?.scoring_breakdown?.matched_skills?.slice(0, 4).map((skill: string) => (
                            <span key={skill} className="rounded bg-[#2a303c] px-1.5 py-0.5 text-[10px] text-zinc-300">
                              {skill}
                            </span>
                          ))}
                          {(app.score?.scoring_breakdown?.matched_skills?.length || 0) > 4 && (
                            <span className="text-[10px] text-zinc-400 self-center">
                              +{(app.score?.scoring_breakdown?.matched_skills?.length || 0) - 4} more
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium border capitalize ${statusColor[app.status] || "text-zinc-400"}`}>
                            {app.status.replace("_", " ")}
                          </span>
                          {app.manual_override && (
                            <span title="Manual recruiter override" className="rounded bg-amber-500/20 text-amber-300 text-[10px] px-1 font-mono">
                              override
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {app.interview_session_id ? (
                          <div className="space-y-1">
                            <span className="rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 text-[11px] font-medium capitalize">
                              {app.interview_status || "scheduled"}
                            </span>
                            <div>
                              <Link
                                href={`/recruiter/interviews/${app.interview_session_id}/report`}
                                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
                              >
                                View Report <ChevronRight size={10} />
                              </Link>
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-500 text-[11px]">Not scheduled</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedApplicant(app)}
                            className="rounded-lg border border-[#2a303c] bg-[#1c222b] px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-indigo-500 hover:text-white"
                          >
                            Breakdown
                          </button>

                          <button
                            onClick={() => {
                              setOverrideModalApp(app);
                              setOverrideStatus(app.status === "shortlisted" ? "under_review" : "shortlisted");
                            }}
                            className="rounded-lg border border-[#2a303c] bg-[#1c222b] px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-purple-500 hover:text-white"
                          >
                            Override
                          </button>

                          {!app.interview_session_id && (
                            <button
                              onClick={() => {
                                setScheduleModalApp(app);
                                setScheduleError(null);
                              }}
                              className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500 shadow-sm"
                            >
                              Schedule
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal 1: Explainable Score Breakdown & Candidate Resume Profile Modal ── */}
      {selectedApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-[#262b32] bg-[#161a22] p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-[#262b32] pb-4">
              <div className="flex items-center gap-3.5">
                {selectedApplicant.candidate_avatar_url ? (
                  <img
                    src={selectedApplicant.candidate_avatar_url}
                    alt={selectedApplicant.candidate_name}
                    className="h-14 w-14 rounded-full object-cover border-2 border-indigo-500/50 shadow-md flex-shrink-0"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-lg font-bold text-white shadow-md flex-shrink-0">
                    {(selectedApplicant.candidate_name || "C")[0]}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedApplicant.candidate_name}</h2>
                  <p className="text-xs text-zinc-400">
                    {selectedApplicant.candidate_email} • {selectedApplicant.job_title}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {selectedApplicant.candidate_location || "Location not specified"} • {selectedApplicant.candidate_experience || 0} years experience
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedApplicant(null)} className="text-zinc-400 hover:text-white p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Score Highlights */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">Overall Match Score</p>
                <p className="text-3xl font-extrabold text-white mt-0.5">
                  {(selectedApplicant.score?.overall_score || 0).toFixed(1)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400">Ranked Position</p>
                <p className="text-xl font-bold text-indigo-400">
                  #{selectedApplicant.score?.ranked_position || "-"}
                </p>
              </div>
            </div>

            {/* Weighted Criteria Breakdown */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Weighted Scoring Criteria</h3>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">Skills Match (40% weight)</span>
                    <span className="font-semibold text-white">{selectedApplicant.score?.skills_score || 0}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#1c222b]">
                    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${selectedApplicant.score?.skills_score || 0}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">Experience Match (30% weight)</span>
                    <span className="font-semibold text-white">{selectedApplicant.score?.experience_score || 0}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#1c222b]">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${selectedApplicant.score?.experience_score || 0}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">Education Match (15% weight)</span>
                    <span className="font-semibold text-white">{selectedApplicant.score?.education_score || 0}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#1c222b]">
                    <div className="h-2 rounded-full bg-purple-500" style={{ width: `${selectedApplicant.score?.education_score || 0}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">Role & Project Relevance (15% weight)</span>
                    <span className="font-semibold text-white">{selectedApplicant.score?.relevance_score || 0}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#1c222b]">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${selectedApplicant.score?.relevance_score || 0}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Strengths & Gaps */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg bg-emerald-950/20 border border-emerald-500/20 p-3">
                <p className="text-xs font-semibold text-emerald-400 mb-2">Strengths</p>
                <ul className="space-y-1 text-xs text-zinc-300 list-disc list-inside">
                  {selectedApplicant.score?.scoring_breakdown?.strengths?.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg bg-rose-950/20 border border-rose-500/20 p-3">
                <p className="text-xs font-semibold text-rose-400 mb-2">Identified Gaps</p>
                <ul className="space-y-1 text-xs text-zinc-300 list-disc list-inside">
                  {selectedApplicant.score?.scoring_breakdown?.gaps?.map((g: string, i: number) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Explainable Narrative */}
            <div className="rounded-lg bg-[#1a1f26] p-3 text-xs text-zinc-300">
              <p className="font-semibold text-zinc-200 mb-1">Evaluation Synthesis</p>
              <p>{selectedApplicant.score?.match_explanation}</p>
            </div>

            {/* ── Extracted Resume Details: College, Experience, Projects, Achievements ── */}
            <div className="border-t border-[#262b32] pt-4 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                Comprehensive Extracted Candidate Profile & Credentials
              </h3>

              {/* College & Education Information */}
              {selectedApplicant.parsed_education?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <GraduationCap size={15} className="text-emerald-400" />
                    College & Education Info
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {selectedApplicant.parsed_education.map((edu: any, i: number) => (
                      <div key={i} className="bg-[#1c222b] p-3 rounded-xl border border-[#2a303c] text-xs">
                        <p className="font-bold text-white">{edu.degree || "Degree"}</p>
                        <p className="text-zinc-300">{edu.institution || edu.college_name || "University / College"}</p>
                        {edu.field_of_study && (
                          <p className="text-zinc-400 text-[11px]">Field: {edu.field_of_study}</p>
                        )}
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-zinc-400">
                          {(edu.graduation_year || edu.year) && (
                            <span>Graduation: <strong className="text-zinc-200">{edu.graduation_year || edu.year}</strong></span>
                          )}
                          {edu.gpa && <span>GPA: <strong className="text-emerald-400">{edu.gpa}</strong></span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prior Work Experience */}
              {selectedApplicant.parsed_experience?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Briefcase size={15} className="text-indigo-400" />
                    Prior Work Experience
                  </span>
                  <div className="space-y-2.5">
                    {selectedApplicant.parsed_experience.map((exp: any, i: number) => (
                      <div key={i} className="bg-[#1c222b] p-3 rounded-xl border border-[#2a303c] text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-white">{exp.title || "Role"}</p>
                          {exp.duration && (
                            <span className="text-[11px] text-zinc-400 bg-[#161a22] px-2 py-0.5 rounded border border-[#2a303c]">
                              {exp.duration}
                            </span>
                          )}
                        </div>
                        {exp.company && <p className="text-indigo-300 font-medium">{exp.company}</p>}
                        {exp.description && <p className="text-zinc-300 text-xs">{exp.description}</p>}
                        {(() => {
                          const hlList = Array.isArray(exp.highlights)
                            ? exp.highlights
                            : typeof exp.highlights === "string"
                            ? exp.highlights.split(/\n+/).map((h: string) => h.trim()).filter(Boolean)
                            : [];
                          return hlList.length > 0 ? (
                            <ul className="list-disc list-inside space-y-0.5 text-zinc-400 text-[11px] pt-1">
                              {hlList.map((h: string, idx: number) => (
                                <li key={idx}>{h}</li>
                              ))}
                            </ul>
                          ) : null;
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {selectedApplicant.parsed_projects?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <FolderGit2 size={15} className="text-amber-400" />
                    Technical Projects
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {selectedApplicant.parsed_projects.map((proj: any, i: number) => {
                      const techList = Array.isArray(proj.technologies)
                        ? proj.technologies
                        : typeof proj.technologies === "string"
                        ? proj.technologies.split(/[,;|•/]/).map((t: string) => t.trim()).filter(Boolean)
                        : [];
                      return (
                        <div key={i} className="bg-[#1c222b] p-3 rounded-xl border border-[#2a303c] text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-white">{proj.name || "Project"}</p>
                            {proj.link && (
                              <a
                                href={proj.link.startsWith("http") ? proj.link : `https://${proj.link}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 text-[11px]"
                              >
                                Link <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                          {proj.description && <p className="text-zinc-300 text-xs">{proj.description}</p>}
                          {techList.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {techList.map((t: string) => (
                                <span key={t} className="rounded bg-[#161a22] border border-[#2a303c] px-1.5 py-0.5 text-[10px] text-zinc-300">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Achievements & Certifications */}
              {selectedApplicant.parsed_achievements?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Award size={15} className="text-purple-400" />
                    Achievements, Awards & Certifications
                  </span>
                  <div className="space-y-1.5">
                    {selectedApplicant.parsed_achievements.map((ach: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 bg-[#1c222b] p-2.5 rounded-lg border border-[#2a303c] text-xs text-zinc-300">
                        <Award size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
                        <span>{ach}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Skills List */}
              {selectedApplicant.parsed_skills?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-300">All Candidate Skills</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedApplicant.parsed_skills.map((s: string) => (
                      <span key={s} className="rounded bg-blue-950/40 border border-blue-500/20 px-2 py-0.5 text-[11px] text-blue-300">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedApplicant(null)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Close Candidate Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Manual Review Override Modal ────────────────────────────── */}
      {overrideModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#262b32] bg-[#161a22] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#262b32] pb-3">
              <h2 className="text-base font-bold text-white">Manual Review Override</h2>
              <button onClick={() => setOverrideModalApp(null)} className="text-zinc-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-zinc-300">
              Manually modify the shortlisting state for <strong className="text-white">{overrideModalApp.candidate_name}</strong>. An audit log entry will be permanently recorded.
            </p>

            <form onSubmit={handleManualOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Target Decision Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="shortlisted">Shortlisted (Promote Candidate)</option>
                  <option value="under_review">Under Review (Exclude from Shortlist)</option>
                  <option value="rejected">Rejected (Disqualify)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Justification Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="State clear business rationale for this manual override..."
                  className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalApp(null)}
                  className="rounded-lg border border-[#2a303c] px-3.5 py-1.5 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideSubmitting}
                  className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  {overrideSubmitting ? "Applying..." : "Confirm Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 3: Schedule Interview Modal ───────────────────────────────── */}
      {scheduleModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#262b32] bg-[#161a22] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#262b32] pb-3">
              <h2 className="text-base font-bold text-white">Schedule AI Voice Interview</h2>
              <button onClick={() => setScheduleModalApp(null)} className="text-zinc-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-zinc-300">
              Assign an autonomous agentic interview session to <strong className="text-white">{scheduleModalApp.candidate_name}</strong>.
            </p>

            {scheduleError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{scheduleError}</span>
              </div>
            )}

            <form onSubmit={handleScheduleInterview} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Interview Date</label>
                  <input
                    type="date"
                    required
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Duration (Minutes)</label>
                  <select
                    value={scheduleDuration}
                    onChange={(e) => setScheduleDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes (Standard)</option>
                    <option value={60}>60 Minutes (In-Depth)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Timezone</label>
                  <select
                    value={scheduleTz}
                    onChange={(e) => setScheduleTz(e.target.value)}
                    className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="America/Los_Angeles">Pacific (PT)</option>
                    <option value="America/New_York">Eastern (ET)</option>
                    <option value="UTC">UTC Universal</option>
                    <option value="Asia/Kolkata">India (IST)</option>
                    <option value="Asia/Ho_Chi_Minh">Vietnam (ICT)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Recruiter Notes (Internal)</label>
                <textarea
                  rows={2}
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="Specific focus areas for the agentic interviewer..."
                  className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setScheduleModalApp(null)}
                  className="rounded-lg border border-[#2a303c] px-3.5 py-1.5 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Send size={13} />
                  {scheduleSubmitting ? "Dispatching..." : "Schedule & Send Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
