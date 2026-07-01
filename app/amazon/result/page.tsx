"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AmazonListingSnapshot, ListingAuditResult } from "@/lib/amazon/types";
import { AuditReport } from "../_components/audit-report";

const MARKETPLACE_LABELS: Record<string, string> = {
  US: "amazon.com",
  UK: "amazon.co.uk",
  DE: "amazon.de",
  CA: "amazon.ca",
  AU: "amazon.com.au",
};

interface StoredAuditResult {
  snapshot: AmazonListingSnapshot;
  audit: ListingAuditResult;
  storedAt: number;
}

const STORAGE_KEY = "amazon_audit_result";
const EXPIRY_MS = 30 * 60 * 1000;

export default function AmazonResultPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<AmazonListingSnapshot | null>(null);
  const [audit, setAudit] = useState<ListingAuditResult | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      router.replace("/amazon");
      return;
    }
    try {
      const stored = JSON.parse(raw) as StoredAuditResult;
      if (Date.now() - stored.storedAt > EXPIRY_MS) {
        sessionStorage.removeItem(STORAGE_KEY);
        router.replace("/amazon");
        return;
      }
      setSnapshot(stored.snapshot);
      setAudit(stored.audit);
      setReady(true);
    } catch {
      router.replace("/amazon");
    }
  }, [router]);

  if (!ready || !snapshot || !audit) {
    return (
      <div style={{ minHeight: "100dvh" }} aria-busy="true" />
    );
  }

  const marketplaceLabel = MARKETPLACE_LABELS[snapshot.marketplace] ?? snapshot.marketplace;

  return (
    <>
      <div className="audit-result-topbar">
        <Link href="/" className="nav-logo" aria-label="altflow 首页">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect width="24" height="24" rx="6" fill="#0D0D0D" />
            <path d="M7.5 17.5l4.5-11 4.5 11" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9.5 13.5h5" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          altflow
        </Link>
        <span className="audit-topbar-title">Amazon 审查报告</span>
      </div>

      <AuditReport snapshot={snapshot} audit={audit} onBack={() => router.push("/amazon")} />
    </>
  );
}
