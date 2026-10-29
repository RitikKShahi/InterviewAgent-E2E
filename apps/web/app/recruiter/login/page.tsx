"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Briefcase, Lock, Mail, ShieldCheck, Sparkles, User } from "lucide-react";
import { setRecruiterToken, setRecruiterUser } from "@/lib/recruiter-client";

export default function RecruiterLoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = isRegister ? "/api/recruiter/auth/register" : "/api/recruiter/auth/login";
      const payload = isRegister
        ? {
            email,
            password,
            full_name: fullName,
            role: "recruiter",
            company_name: companyName || "TechCorp AI",
            department: department || "Talent Acquisition",
          }
        : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Authentication failed. Please check your credentials.");
      }

      const data = await res.json();
      setRecruiterToken(data.access_token);
      setRecruiterUser(data.user);
      router.push("/recruiter/dashboard");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  // Quick Demo Login helper
  async function handleDemoLogin() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recruiter/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "recruiter@example.com", password: "password123" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Demo sign in failed.");
      }
      const data = await res.json();
      setRecruiterToken(data.access_token);
      setRecruiterUser(data.user);
      router.push("/recruiter/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[85vh] items-center justify-center py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 mb-4">
            <Briefcase size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isRegister ? "Create Recruiter Account" : "Recruiter Portal"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {isRegister
              ? "Set up your hiring workspace and start screening candidates"
              : "Sign in to manage jobs, rank candidates, and review interview scorecards"}
          </p>
        </div>

        {/* Demo Fast Login Banner */}
        {!isRegister && (
          <div className="mb-6 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-left">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-indigo-300">Quick Demo Access</p>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Sign in immediately as Sarah Connor (Nexus AI) with pre-seeded jobs & candidate evaluations.
                </p>
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={loading}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? "Signing In..." : "Instant Demo Sign In"}
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="rounded-2xl border border-[#262b32] bg-[#161a22] p-7 shadow-xl">
          {error && (
            <div className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Sarah Connor"
                      className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Company</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Company Name"
                      className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Department</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Talent Acquisition"
                      className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="recruiter@company.com"
                  className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50"
            >
              {loading ? "Processing..." : isRegister ? "Create Recruiter Account" : "Sign In to Recruiter Hub"}
            </button>
          </form>

          <div className="mt-5 border-t border-[#262b32] pt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-xs text-indigo-400 hover:underline"
            >
              {isRegister ? "Already have an account? Sign in" : "Need to post jobs? Register as a recruiter"}
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-zinc-500">
          <Link href="/candidate/login" className="hover:text-zinc-400">
            Are you a candidate? Switch to Candidate Portal →
          </Link>
        </div>
      </div>
    </div>
  );
}
