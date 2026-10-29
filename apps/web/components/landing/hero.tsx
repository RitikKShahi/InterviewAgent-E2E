import Link from "next/link";
import { Check, ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { buttonClasses } from "@/components/ui/button";
import { HeroMock } from "@/components/landing/hero-mock";
import { GITHUB_URL } from "@/lib/site";

export function Hero() {
  return (
    <header id="top" className="border-b border-line">
      <Container className="grid items-center gap-11 pt-[84px] pb-16 min-[920px]:grid-cols-[1.04fr_0.96fr] min-[920px]:gap-14">
        <div>
          <Eyebrow>Autonomous AI Hiring &amp; Voice Interview Platform</Eyebrow>
          <h1 className="serif mt-[18px] mb-[22px] text-[44px] text-ink min-[920px]:text-[60px]">
            Smart Talent Hiring.{" "}
            <em className="italic text-accent">Interview out loud.</em>
            <br />
            Accelerate Every Step.
          </h1>
          <p className="mb-7 max-w-[520px] text-lg text-ink-soft">
            InterviewByte powers the complete recruitment lifecycle: intelligent resume parsing, automated candidate shortlisting, real-time voice mock interviews, and browser proctoring.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/recruiter/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-purple-500 transition-all"
            >
              Recruiter Hub →
            </Link>
            <Link
              href="/candidate/jobs"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:border-ink-soft transition-all"
            >
              Candidate Portal
            </Link>
            <Link href="/setup" className={buttonClasses({ variant: "out" })}>
              Practice Voice Mock
            </Link>
          </div>
          <div className="mt-[18px] flex flex-wrap gap-3.5 text-[13px] text-faint">
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-ok" /> Real-Time Voice Agent
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-ok" /> Smart Resume Parser
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-ok" /> AI Proctoring Engine
            </span>
          </div>
        </div>

        <Reveal>
          <HeroMock />
        </Reveal>
      </Container>
    </header>
  );
}
