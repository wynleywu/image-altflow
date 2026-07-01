"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AmazonMarketplace } from "@/lib/amazon/types";
import { createAuditWorkspace, saveAuditWorkspace } from "@/lib/amazon/workspace";

function BrandLink() {
  return (
    <Link href="/" className="nav-logo page-logo" aria-label="altflow 首页">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="#0D0D0D" />
        <path d="M7.5 17.5l4.5-11 4.5 11" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 13.5h5" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      altflow
    </Link>
  );
}

export default function AmazonAuditPage() {
  const router = useRouter();
  const [asinInput, setAsinInput] = useState("");
  const [marketplace, setMarketplace] = useState<AmazonMarketplace>("US");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showManual, setShowManual] = useState(false);

  const [manualTitle, setManualTitle] = useState("");
  const [manualBullets, setManualBullets] = useState("");
  const [manualSearchTerms, setManualSearchTerms] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualBrowsePath, setManualBrowsePath] = useState("");

  async function runAudit(payload: Record<string, unknown>) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/amazon/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplace, ...payload }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (data.error_type === "fetch_not_configured") {
          setShowManual(true);
        }
        throw new Error(data.error || "审查失败");
      }
      const auditId = crypto.randomUUID();
      saveAuditWorkspace(createAuditWorkspace(auditId, data.snapshot, data.audit));
      router.push(`/amazon/result?id=${encodeURIComponent(auditId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "审查失败");
    } finally {
      setLoading(false);
    }
  }

  function handleAsinSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runAudit({ asin: asinInput.trim() });
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualTitle.trim()) {
      setError("请填写标题");
      return;
    }
    const bullets = manualBullets
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    void runAudit({
      manual: {
        asin: parseAsinFromManual(asinInput) ?? "MANUAL0000",
        title: manualTitle.trim(),
        bullets,
        searchTerms: manualSearchTerms.trim() || undefined,
        description: manualDescription.trim() || undefined,
        browsePath: manualBrowsePath.trim() || undefined,
        attributes: {},
      },
    });
  }

  function parseAsinFromManual(input: string): string | null {
    const m = input.trim().match(/\b([A-Z0-9]{10})\b/i);
    return m?.[1]?.toUpperCase() ?? null;
  }

  return (
    <div className="upload-page upload-page-amazon">
      <BrandLink />

      <nav className="mode-tabs amazon-nav-tabs">
        <Link href="/" className="mode-tab mode-tab-link">图片 SEO</Link>
        <span className="mode-tab is-active">Amazon 审查</span>
      </nav>

      <div className="amazon-audit-content">
        <h1 className="upload-h1 amazon-audit-h1">Amazon Listing SEO 审查</h1>
        <p className="amazon-audit-lead">
          输入 ASIN，AI 审查 Listing SEO 合规性并给出优化建议。
        </p>

        <form className="amazon-audit-form fields-card" onSubmit={handleAsinSubmit}>
          <div className="field-row">
            <div className="field-label-row">
              <span className="field-key">ASIN 或链接</span>
            </div>
            <input
              className="field-input"
              value={asinInput}
              onChange={(e) => setAsinInput(e.target.value)}
              placeholder="B0XXXXXXXX 或商品链接"
              disabled={loading}
            />
          </div>
          <div className="field-row">
            <div className="field-label-row">
              <span className="field-key">站点</span>
            </div>
            <select
              className="field-input sm"
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value as AmazonMarketplace)}
              disabled={loading}
            >
              <option value="US">美国 (amazon.com)</option>
              <option value="UK">英国 (amazon.co.uk)</option>
              <option value="DE">德国 (amazon.de)</option>
              <option value="CA">加拿大 (amazon.ca)</option>
              <option value="AU">澳大利亚 (amazon.com.au)</option>
            </select>
          </div>
          <button type="submit" className="btn" disabled={loading || !asinInput.trim()}>
            {loading ? "审查中…" : "开始审查"}
          </button>
        </form>

        {error ? <div className="meta-error amazon-audit-error">{error}</div> : null}

        {!showManual && error.includes("fetch_not_configured") ? null : (
          <div className="amazon-manual-toggle">
            <button type="button" className="btn-ghost" onClick={() => setShowManual((v) => !v)}>
              {showManual ? "收起手动输入" : "抓取失败？手动粘贴 Listing"}
            </button>
          </div>
        )}

        {showManual ? (
          <form className="amazon-audit-form fields-card" onSubmit={handleManualSubmit}>
            <p className="audit-diff-label">手动粘贴（每行一条 Bullet）</p>
            <div className="field-row">
              <span className="field-key">标题</span>
              <input className="field-input" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} required />
            </div>
            <div className="field-row">
              <span className="field-key">五点描述</span>
              <textarea className="field-textarea" rows={6} value={manualBullets} onChange={(e) => setManualBullets(e.target.value)} />
            </div>
            <div className="field-row">
              <span className="field-key">后台 Search Terms（可选）</span>
              <input className="field-input" value={manualSearchTerms} onChange={(e) => setManualSearchTerms(e.target.value)} />
            </div>
            <div className="field-row">
              <span className="field-key">类目路径（可选）</span>
              <input className="field-input" value={manualBrowsePath} onChange={(e) => setManualBrowsePath(e.target.value)} placeholder="Health > Medical > ..." />
            </div>
            <div className="field-row">
              <span className="field-key">描述（可选）</span>
              <textarea className="field-textarea" rows={3} value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} />
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? "审查中…" : "审查粘贴内容"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
