import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { buttonClasses } from "@/components/ui/button";

export function OpenSource() {
  return (
    <section id="ecosystem" className="scroll-mt-24 border-t border-line py-[84px]">
      <Container className="grid items-center gap-[54px] md:grid-cols-2">
        <Reveal>
          <Eyebrow>End-to-End Architecture</Eyebrow>
          <h2 className="serif my-3.5 text-[36px]">
            Modular, scalable, and built for modern hiring.
          </h2>
          <p className="mb-[22px] text-base text-muted leading-relaxed">
            InterviewByte orchestrates real-time WebRTC voice agents, FastAPI microservices, automated resume extraction, and multi-layer anti-cheating proctoring into one unified platform.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/candidate/jobs"
              className={buttonClasses()}
            >
              Candidate Portal <ArrowRight size={16} />
            </Link>
            <Link
              href="/recruiter/dashboard"
              className={buttonClasses({ variant: "out" })}
            >
              Recruiter Hub
            </Link>
          </div>
        </Reveal>

        <Reveal>
          <div className="overflow-hidden rounded-[13px] border border-[#26262B] bg-[#161619] shadow-[0_24px_50px_-30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-[#26262B] px-3.5 py-3">
              <div className="flex gap-[7px]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#34343A]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#34343A]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#34343A]" />
              </div>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
                <Terminal size={12} /> platform-stack
              </span>
            </div>
            <pre className="overflow-x-auto p-[18px] font-mono text-[13px] leading-[1.8] text-[#D6D4DE]">
              <span className="text-[#6B6B72]">
                # Start the InterviewByte E2E platform
              </span>
              {"\n"}
              <span className="text-[#7C84F2]">$</span> ./start.sh{"\n"}
              <span className="text-[#5BBF8B]">
                ✓ web-portal    → http://localhost:3000 (Candidate &amp; Recruiter)
              </span>
              {"\n"}
              <span className="text-[#5BBF8B]">
                ✓ candidate-svc → http://localhost:8003 (Resume Parsing &amp; Auth)
              </span>
              {"\n"}
              <span className="text-[#5BBF8B]">
                ✓ recruiter-svc → http://localhost:8004 (Jobs &amp; Shortlisting)
              </span>
              {"\n"}
              <span className="text-[#5BBF8B]">
                ✓ voice-agent   → connected (LiveKit WebRTC Real-Time AI)
              </span>
              {"\n"}
              <span className="text-[#5BBF8B]">
                ✓ proctoring    → active (Webcam Vector &amp; Fullscreen Guard)
              </span>
            </pre>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
