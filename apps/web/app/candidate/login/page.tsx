"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock, Mail, Sparkles, User } from "lucide-react";
import { setCandidateToken, setCandidateUser } from "@/lib/candidate-client";

export default function CandidateLoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [location, setLocation] = useState("San Francisco, CA");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = isRegister ? "/api/candidate/auth/register" : "/api/candidate/auth/login";
      const payload = isRegister
        ? {
            email,
            password,
            full_name: fullName,
            role: "candidate",
            current_title: currentTitle || "Software Engineer",
            location: location || "Remote",
          }
        : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Authentication failed. Please verify credentials.");
      }

      const data = await res.json();
      setCandidateToken(data.access_token);
      setCandidateUser(data.user);
      router.push("/candidate/jobs");
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
      const res = await fetch("/api/candidate/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alex.morgan@example.com", password: "password123" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Demo sign in failed.");
      }
      const data = await res.json();
      setCandidateToken(data.access_token);
      setCandidateUser(data.user);
      router.push("/candidate/jobs");
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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 mb-4">
            <User size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isRegister ? "Create Candidate Profile" : "Candidate Portal"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {isRegister
              ? "Join top tech companies and take AI voice interviews"
              : "Sign in to explore openings, track applications, and attend scheduled interviews"}
          </p>
        </div>

        {/* Demo Fast Login Banner */}
        {!isRegister && (
          <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-left">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-blue-300">Fast Track Demo Login</p>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Sign in instantly as Alex Morgan (Lead AI Platform Engineer) with pre-applied status & live interview link.
                </p>
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={loading}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? "Signing In..." : "Instant Candidate Sign In"}
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form Card */}
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
                      placeholder="e.g. Alex Morgan"
                      className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Current Role / Title</label>
                    <input
                      type="text"
                      value={currentTitle}
                      onChange={(e) => setCurrentTitle(e.target.value)}
                      placeholder="e.g. Full-Stack Engineer"
                      className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="City or Remote"
                      className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex.morgan@example.com"
                  className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
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
                  className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:from-blue-500 hover:to-indigo-500 transition-all disabled:opacity-50"
            >
              {loading ? "Signing In..." : isRegister ? "Create Profile" : "Sign In to Candidate Portal"}
            </button>
          </form>

          <div className="mt-5 border-t border-[#262b32] pt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-xs text-blue-400 hover:underline"
            >
              {isRegister ? "Already registered? Sign in" : "New candidate? Create your account"}
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-zinc-500">
          <Link href="/recruiter/login" className="hover:text-zinc-400">
            Are you a recruiter or hiring manager? Switch to Recruiter Hub →
          </Link>
        </div>
      </div>
    </div>
  );
}
