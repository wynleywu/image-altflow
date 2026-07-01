"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { AmazonAuditWorkspace } from "@/lib/amazon/types";
import { loadAuditWorkspace, migrateLegacyWorkspace, saveAuditWorkspace } from "@/lib/amazon/workspace";
import { AuditReport } from "../_components/audit-report";

function BrandBar() {
  return (
    <div className="audit-result-topbar">
      <Link href="/" className="nav-logo" aria-label="altflow 首页">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#0D0D0D" />
          <path d="M7.5 17.5l4.5-11 4.5 11" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 13.5h5" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        altflow
      </Link>
      <span className="audit-topbar-title">Amazon 审查工作台</span>
    </div>
  );
}

function ResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workspace, setWorkspace] = useState<AmazonAuditWorkspace | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let auditId = searchParams.get("id");
    if (!auditId) {
      auditId = crypto.randomUUID();
      const migrated = migrateLegacyWorkspace(auditId);
      if (migrated) {
        setWorkspace(migrated);
        router.replace(`/amazon/result?id=${encodeURIComponent(auditId)}`);
      }
      setReady(true);
      return;
    }
    setWorkspace(loadAuditWorkspace(auditId));
    setReady(true);
  }, [router, searchParams]);

  const updateWorkspace = useCallback((next: AmazonAuditWorkspace) => {
    const saved = saveAuditWorkspace(next);
    setWorkspace(saved);
  }, []);

  if (!ready) return <div style={{ minHeight: "100dvh" }} aria-busy="true" />;

  if (!workspace) {
    return (
      <main className="audit-empty-state">
        <p className="audit-empty-kicker">无法恢复报告</p>
        <h1>这份审查记录不存在或已损坏</h1>
        <p>本地工作区可能被清理，或链接来自另一台设备。请重新发起审查。</p>
        <Link href="/amazon" className="btn">重新审查</Link>
      </main>
    );
  }

  return (
    <AuditReport
      workspace={workspace}
      onChange={updateWorkspace}
      onBack={() => router.push("/amazon")}
    />
  );
}

export default function AmazonResultPage() {
  return (
    <>
      <BrandBar />
      <Suspense fallback={<div style={{ minHeight: "100dvh" }} aria-busy="true" />}>
        <ResultContent />
      </Suspense>
    </>
  );
}
