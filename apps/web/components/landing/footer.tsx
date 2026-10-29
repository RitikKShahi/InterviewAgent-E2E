import { Container } from "@/components/ui/container";
import { BrandMark } from "@/components/ui/brand-mark";
import { GITHUB_URL, DOCS_URL } from "@/lib/site";

type FooterLink = { href: string; label: string; external?: boolean };

function FooterCol({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h4 className="mb-3.5 font-mono text-[12px] uppercase tracking-[0.08em] text-faint">
        {title}
      </h4>
      {links.map((link) =>
        link.external ? (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="mb-2.5 block text-sm text-ink-soft hover:text-ink"
          >
            {link.label}
          </a>
        ) : (
          <a
            key={link.label}
            href={link.href}
            className="mb-2.5 block text-sm text-ink-soft hover:text-ink"
          >
            {link.label}
          </a>
        ),
      )}
    </div>
  );
}

const PLATFORM_LINKS: FooterLink[] = [
  { href: "#how", label: "How it works" },
  { href: "#product", label: "Features" },
  { href: "#ecosystem", label: "Architecture" },
  { href: "/setup", label: "Live Voice Mock" },
];

const CANDIDATE_LINKS: FooterLink[] = [
  { href: "/candidate/jobs", label: "Browse Job Openings" },
  { href: "/candidate/profile", label: "Candidate Profile & Resume" },
  { href: "/candidate/interviews", label: "My Interview Sessions" },
  { href: "/candidate/login", label: "Candidate Sign In" },
];

const RECRUITER_LINKS: FooterLink[] = [
  { href: "/recruiter/dashboard", label: "Recruiter Dashboard" },
  { href: "/recruiter/jobs", label: "Post & Manage Jobs" },
  { href: "/recruiter/interviews", label: "Applicant Shortlisting" },
  { href: "/recruiter/login", label: "Recruiter Sign In" },
];

export function Footer() {
  return (
    <footer className="mt-[30px] border-t border-line pt-[54px] pb-10">
      <Container>
        <div className="mb-9 grid grid-cols-2 gap-[30px] md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-[9px]">
              <BrandMark size={22} />
              <span className="text-[17px] font-semibold tracking-[-0.01em]">
                InterviewByte
              </span>
            </div>
            <p className="max-w-[280px] text-sm text-muted leading-relaxed">
              Autonomous AI Voice Interview &amp; Intelligent Recruitment Platform.
            </p>
          </div>
          <FooterCol title="Platform" links={PLATFORM_LINKS} />
          <FooterCol title="Candidates" links={CANDIDATE_LINKS} />
          <FooterCol title="Recruiters" links={RECRUITER_LINKS} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-line pt-[22px] text-[13px] text-faint">
          <span>© 2026 InterviewByte. All rights reserved.</span>
          <span className="font-mono text-xs">Empowered by Multi-Modal Voice AI</span>
        </div>
      </Container>
    </footer>
  );
}
