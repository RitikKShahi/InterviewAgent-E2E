"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Briefcase, Calendar, ChevronRight, LayoutDashboard, LogOut, Sparkles, User, Users } from "lucide-react";
import { clearRecruiterToken, getRecruiterToken, getRecruiterUser } from "@/lib/recruiter-client";

export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = getRecruiterToken();
    const currentUser = getRecruiterUser();
    if (!token && !pathname.includes("/login")) {
      router.push("/recruiter/login");
    } else {
      setUser(currentUser);
    }
  }, [pathname, router]);

  function handleSignOut() {
    clearRecruiterToken();
    router.push("/recruiter/login");
  }

  const isLoginPage = pathname.includes("/login");

  return (
    <div className="min-h-screen bg-[#0d0f12] text-[#f1f3f5]">
      {/* Top Navigation */}
      {!isLoginPage && (
        <header className="sticky top-0 z-50 border-b border-[#262b32] bg-[#12151a]/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <div className="flex items-center gap-8">
              <Link href="/recruiter/dashboard" className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
                  <Briefcase size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white tracking-tight">InterviewByte</span>
                    <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-400 border border-indigo-500/20">
                      Recruiter Hub
                    </span>
                  </div>
                </div>
              </Link>

              <nav className="hidden md:flex items-center gap-1">
                <Link
                  href="/recruiter/dashboard"
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    pathname === "/recruiter/dashboard"
                      ? "bg-[#1c222b] text-white"
                      : "text-zinc-400 hover:bg-[#1a1f26] hover:text-zinc-200"
                  }`}
                >
                  <LayoutDashboard size={16} />
                  Dashboard
                </Link>
                <Link
                  href="/recruiter/jobs"
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    pathname.startsWith("/recruiter/jobs")
                      ? "bg-[#1c222b] text-white"
                      : "text-zinc-400 hover:bg-[#1a1f26] hover:text-zinc-200"
                  }`}
                >
                  <Users size={16} />
                  Jobs & Applicants
                </Link>
                <Link
                  href="/recruiter/interviews"
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    pathname.startsWith("/recruiter/interviews")
                      ? "bg-[#1c222b] text-white"
                      : "text-zinc-400 hover:bg-[#1a1f26] hover:text-zinc-200"
                  }`}
                >
                  <Calendar size={16} />
                  Interviews
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/candidate/jobs"
                className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-400 hover:text-indigo-400 border border-[#2a303c] rounded-md px-2.5 py-1 bg-[#161a22]"
              >
                <span>Candidate Portal</span>
                <ChevronRight size={12} />
              </Link>

              {user ? (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-medium text-white">{user.full_name || "Recruiter"}</p>
                    <p className="text-[11px] text-zinc-400">{user.company_name || "Company"}</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-xs font-semibold text-white">
                    {(user.full_name || "R")[0]}
                  </div>
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
                  href="/recruiter/login"
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition-all"
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
