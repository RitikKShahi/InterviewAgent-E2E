import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { buttonClasses } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/site";

export function CtaBand() {
  return (
    <section className="pb-[84px]">
      <Container>
        <Reveal>
          <div className="rounded-[18px] border border-line bg-panel p-[54px] text-center">
            <Eyebrow>Start Hiring or Practicing Today</Eyebrow>
            <h2 className="serif mt-3 mb-3.5 text-[38px]">
              Your Next Career Move or Top Hire Starts Here.
            </h2>
            <p className="mb-[26px] text-[17px] text-ink-soft max-w-xl mx-auto">
              Join InterviewByte to experience autonomous voice evaluations, streamlined candidate resume parsing, and secure proctoring.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/candidate/jobs"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-purple-500 transition-all"
              >
                Candidate Portal
              </Link>
              <Link
                href="/recruiter/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink hover:border-ink-soft transition-all"
              >
                Recruiter Hub
              </Link>
              <Link href="/setup" className={buttonClasses({ variant: "out" })}>
                Practice Voice Mock
              </Link>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
