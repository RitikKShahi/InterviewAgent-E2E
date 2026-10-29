"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  MapPin,
  Play,
  User,
  XCircle,
} from "lucide-react";
import { recruiterFetch } from "@/lib/recruiter-client";

export default function RecruiterInterviewsPage() {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInterviews() {
      try {
        setLoading(true);
        const data = await recruiterFetch<any[]>("/api/recruiter/interviews");
        setInterviews(data);
      } catch (err: any) {
        setError(err.message || "Failed to load interviews");
      } finally {
        setLoading(false);
      }
    }
    loadInterviews();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Interview Sessions</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Monitor scheduled sessions, live agent interview status, and candidate evaluation reports.
        </p>
      </div>

      <div className="rounded-2xl border border-[#262b32] bg-[#161a22] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-400">Loading interview sessions...</div>
        ) : interviews.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-400">
            No interview sessions have been scheduled yet. Schedule interviews from the Job Applicants tab.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1c222b] text-zinc-400 font-medium border-b border-[#262b32]">
                <tr>
                  <th className="px-6 py-3">Candidate & Role</th>
                  <th className="px-6 py-3">Scheduled Date & Time</th>
                  <th className="px-6 py-3">Duration & Timezone</th>
                  <th className="px-6 py-3">Session Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262b32]">
                {interviews.map((sess) => {
                  const statusColors: Record<string, string> = {
                    scheduled: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                    ready: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                    in_progress: "text-purple-400 bg-purple-500/10 border-purple-500/20",
                    completed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                    cancelled: "text-rose-400 bg-rose-500/10 border-rose-500/20",
                  };

                  const formattedDate = new Date(sess.scheduled_start).toLocaleString();

                  return (
                    <tr key={sess.id} className="hover:bg-[#1a1f27] transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-white text-sm">{sess.candidate_name}</p>
                          <p className="text-zinc-400">{sess.candidate_email}</p>
                          <p className="text-[11px] text-indigo-400 mt-0.5">{sess.job_title}</p>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-zinc-200">
                          <Calendar size={13} className="text-indigo-400" />
                          <span>{formattedDate}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-zinc-300">
                          <p>{sess.duration_minutes} Minutes</p>
                          <p className="text-[11px] text-zinc-500">{sess.timezone}</p>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border capitalize ${statusColors[sess.status] || "text-zinc-400"}`}>
                          {sess.status.replace("_", " ")}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/recruiter/interviews/${sess.id}/report`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600/10 border border-indigo-500/30 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                          >
                            <FileText size={13} />
                            <span>Evaluation Report</span>
                          </Link>

                          <a
                            href={sess.secure_link}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-[#2a303c] bg-[#1c222b] p-1.5 text-zinc-400 hover:text-white"
                            title="Open Join Link"
                          >
                            <Play size={13} />
                          </a>
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
    </div>
  );
}
