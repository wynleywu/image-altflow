import Link from "next/link";

export function BrandLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`nav-logo ${className}`.trim()} aria-label="altflow 首页">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="#0D0D0D" />
        <path d="M7.5 17.5l4.5-11 4.5 11" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 13.5h5" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      altflow
    </Link>
  );
}
