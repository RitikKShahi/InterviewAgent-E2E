"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Briefcase, Calendar, CheckSquare, ChevronRight, FileText, LogOut, Search, User } from "lucide-react";
import { clearCandidateToken, getCandidateToken, getCandidateUser } from "@/lib/candidate-client";

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = getCandidateToken();
    const currentUser = getCandidateUser();
    const isPublic = pathname.includes("/login") || pathname === "/candidate/jobs";
    if (!token && !isPublic) {
      router.push("/candidate/login");
    } else {
      setUser(currentUser);
    }
  }, [pathname, router]);

  function handleSignOut() {
    clearCandidateToken();
    router.push("/candidate/login");
  }

  const isLoginPage = pathname.includes("/login");

  return (
    <div className="min-h-screen bg-[#0d0f12] text-[#f1f3f5]">
      {/* Top Navigation */}
      {!isLoginPage && (
        <header className="sticky top-0 z-50 border-b border-[#262b32] bg-[#12151a]/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <div className="flex items-center gap-8">
              <Link href="/candidate/jobs" className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                  <User size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white tracking-tight">InterviewByte</span>
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400 border border-blue-500/20">
                      Candidate Portal
                    </span>
                  </div>
                </div>
              </Link>

              <nav className="hidden md:flex items-center gap-1">
                <Link
                  href="/candidate/jobs"
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    pathname === "/candidate/jobs"
                      ? "bg-[#1c222b] text-white"
                      : "text-zinc-400 hover:bg-[#1a1f26] hover:text-zinc-200"
                  }`}
                >
                  <Search size={16} />
                  Explore Jobs
                </Link>
                <Link
                  href="/candidate/applications"
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    pathname.startsWith("/candidate/applications")
                      ? "bg-[#1c222b] text-white"
                      : "text-zinc-400 hover:bg-[#1a1f26] hover:text-zinc-200"
                  }`}
                >
                  <CheckSquare size={16} />
                  My Applications
                </Link>
                <Link
                  href="/candidate/interviews"
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    pathname.startsWith("/candidate/interviews")
                      ? "bg-[#1c222b] text-white"
                      : "text-zinc-400 hover:bg-[#1a1f26] hover:text-zinc-200"
                  }`}
                >
                  <Calendar size={16} />
                  My Interviews
                </Link>
                <Link
                  href="/candidate/profile"
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    pathname.startsWith("/candidate/profile")
                      ? "bg-[#1c222b] text-white"
                      : "text-zinc-400 hover:bg-[#1a1f26] hover:text-zinc-200"
                  }`}
                >
                  <FileText size={16} />
                  Resume & Profile
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/recruiter/dashboard"
                className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-400 hover:text-indigo-400 border border-[#2a303c] rounded-md px-2.5 py-1 bg-[#161a22]"
              >
                <span>Recruiter Hub</span>
                <ChevronRight size={12} />
              </Link>

              {user ? (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-medium text-white">{user.full_name || "Candidate"}</p>
                    <p className="text-[11px] text-zinc-400">{user.current_title || "Job Seeker"}</p>
                  </div>
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name || "Candidate"}
                      className="h-8 w-8 rounded-full object-cover border border-blue-500/30 shadow-sm"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-xs font-semibold text-white">
                      {(user.full_name || "C")[0]}
                    </div>
                  )}
                  <button
                    onClick={handleSignOut}
                    title="Sign Out"
                    className="p-1.5 text-zinc-400 hover:text-rose-400 transition-colors"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              ) : (
                <Link
                  href="/candidate/login"
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition-all"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
