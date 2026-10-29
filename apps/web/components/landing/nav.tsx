import Link from "next/link";
import { features } from "@deepinterview/ee";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";
import { BrandMark } from "@/components/ui/brand-mark";
import { MobileMenu } from "@/components/landing/mobile-menu";
import { GITHUB_URL } from "@/lib/site";

export const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#product", label: "Features" },
  { href: "#ecosystem", label: "Architecture" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-paper/80 backdrop-blur-md">
      <Container className="flex h-[66px] items-center justify-between">
        <a href="#top" className="flex items-center gap-[9px]">
          <BrandMark size={22} />
          <span className="text-[17px] font-semibold tracking-[-0.01em]">
            InterviewByte
          </span>
        </a>

        <div className="hidden gap-[30px] text-[14.5px] text-ink-soft min-[861px]:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/candidate/jobs"
            className="hidden text-[13.5px] font-medium text-ink-soft hover:text-ink min-[861px]:inline border border-line bg-surface rounded-lg px-3 py-1.5 transition-colors"
          >
            Candidate Portal
          </Link>
          <Link
            href="/recruiter/dashboard"
            className="hidden text-[13.5px] font-medium text-indigo-400 hover:text-indigo-300 min-[861px]:inline border border-indigo-500/30 bg-indigo-500/10 rounded-lg px-3 py-1.5 transition-colors"
          >
            Recruiter Hub
          </Link>
          <Link href="/setup" className={buttonClasses()}>
            Live Voice Mock
          </Link>
          <MobileMenu
            links={[
              ...NAV_LINKS,
              { href: "/candidate/jobs", label: "Candidate Portal" },
              { href: "/recruiter/dashboard", label: "Recruiter Hub" },
            ]}
          />
        </div>
      </Container>
    </nav>
  );
}
