import Link from "next/link";
import { Container } from "@/components/ui/container";

export function AnnouncementBar() {
  return (
    <div className="border-b border-line bg-panel">
      <Container className="flex h-[38px] items-center justify-center gap-2.5 text-[13px] text-muted">
        <span
          aria-hidden="true"
          className="inline-block h-[6px] w-[6px] rounded-full bg-indigo-500 animate-pulse"
        />
        <b className="font-semibold text-ink">
          InterviewByte
        </b>
        <span className="hidden sm:inline text-ink-soft">
          — Autonomous AI Voice Interviews, Resume Parsing &amp; Proctoring
        </span>
        <Link
          href="/candidate/jobs"
          className="font-medium text-accent hover:underline inline-flex items-center gap-1"
        >
          Explore Careers &amp; Jobs →
        </Link>
      </Container>
    </div>
  );
}
