"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AmazonMarketplace } from "@/lib/amazon/types";
import { createAuditWorkspace, saveAuditWorkspace } from "@/lib/amazon/workspace";
import { BrandLink } from "@/app/brand-link";

const FALLBACK_ERROR = "Audit failed. Please try again.";
const RATE_LIMITED_MESSAGE = "请求过于频繁，请稍后再试";
const DETAIL_LABELS: Record<string, string> = {
  fetch_not_configured: "Setup",
  fetch_blocked: "Blocked",
  fetch_failed: "Fetch",
  fetch_proxy_failed: "Proxy",
  audit_chain_failed: "Pipeline",
  ai_parse_error: "AI parse",
  gemini_error: "Gemini",
  modelscope_error: "ModelScope",
};

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
        if (data.error_type === "rate_limited") {
          throw new Error(RATE_LIMITED_MESSAGE);
        }
        const detailLabel = DETAIL_LABELS[String(data.error_type ?? "")];
        const message = detailLabel
          ? `${data.error || FALLBACK_ERROR}\n${detailLabel}`
          : data.error || FALLBACK_ERROR;
        throw new Error(message);
      }
      const auditId = crypto.randomUUID();
      saveAuditWorkspace(createAuditWorkspace(auditId, data.snapshot, data.audit));
      router.push(`/amazon/result?id=${encodeURIComponent(auditId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : FALLBACK_ERROR);
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
      setError("Please enter a title for manual audit.");
      return;
    }
    const bullets = manualBullets
      .split("\n")
      .map((line) => line.trim())
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
    const match = input.trim().match(/\b([A-Z0-9]{10})\b/i);
    return match?.[1]?.toUpperCase() ?? null;
  }

  return (
    <div className="upload-page upload-page-amazon">
      <BrandLink className="page-logo" />

      <nav className="mode-tabs amazon-nav-tabs">
        <Link href="/" className="mode-tab mode-tab-link">Image SEO</Link>
        <span className="mode-tab is-active">Amazon Audit</span>
      </nav>

      <div className="amazon-audit-content">
        <h1 className="upload-h1 amazon-audit-h1">Amazon Listing SEO Audit</h1>
        <p className="amazon-audit-lead">
          Enter an ASIN and let AI review listing SEO and suggest improvements.
        </p>

        <form className="amazon-audit-form fields-card" onSubmit={handleAsinSubmit}>
          <div className="field-row">
            <div className="field-label-row">
              <span className="field-key">ASIN or URL</span>
            </div>
            <input
              className="field-input"
              value={asinInput}
              onChange={(e) => setAsinInput(e.target.value)}
              placeholder="B0XXXXXXXX or Amazon product URL"
              disabled={loading}
            />
          </div>
          <div className="field-row">
            <div className="field-label-row">
              <span className="field-key">Marketplace</span>
            </div>
            <select
              className="field-input sm"
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value as AmazonMarketplace)}
              disabled={loading}
            >
              <option value="US">United States (amazon.com)</option>
              <option value="UK">United Kingdom (amazon.co.uk)</option>
              <option value="DE">Germany (amazon.de)</option>
              <option value="CA">Canada (amazon.ca)</option>
              <option value="AU">Australia (amazon.com.au)</option>
            </select>
          </div>
          <button type="submit" className="btn" disabled={loading || !asinInput.trim()}>
            {loading ? "Auditing..." : "Start audit"}
          </button>
        </form>

        {error ? <div className="meta-error amazon-audit-error">{error}</div> : null}

        {!showManual && error.includes("fetch_not_configured") ? null : (
          <div className="amazon-manual-toggle">
            <button type="button" className="btn-ghost" onClick={() => setShowManual((v) => !v)}>
              {showManual ? "Hide manual input" : "Fetch failed? Paste listing manually"}
            </button>
          </div>
        )}

        {showManual ? (
          <form className="amazon-audit-form fields-card" onSubmit={handleManualSubmit}>
            <p className="audit-diff-label">Manual paste (one bullet per line)</p>
            <div className="field-row">
              <span className="field-key">Title</span>
              <input className="field-input" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} required />
            </div>
            <div className="field-row">
              <span className="field-key">Bullets</span>
              <textarea className="field-textarea" rows={6} value={manualBullets} onChange={(e) => setManualBullets(e.target.value)} />
            </div>
            <div className="field-row">
              <span className="field-key">Backend Search Terms (optional)</span>
              <input className="field-input" value={manualSearchTerms} onChange={(e) => setManualSearchTerms(e.target.value)} />
            </div>
            <div className="field-row">
              <span className="field-key">Browse path (optional)</span>
              <input className="field-input" value={manualBrowsePath} onChange={(e) => setManualBrowsePath(e.target.value)} placeholder="Health > Medical > ..." />
            </div>
            <div className="field-row">
              <span className="field-key">Description (optional)</span>
              <textarea className="field-textarea" rows={3} value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} />
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? "Auditing..." : "Audit pasted listing"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
