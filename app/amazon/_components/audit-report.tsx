"use client";

import { useState } from "react";
import type { AmazonListingSnapshot, ListingAuditResult } from "@/lib/amazon/types";

// ─── Helpers ────────────────────────────────────────────

function scoreGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

function scoreColor(score: number): string {
  if (score >= 80) return "var(--ok)";
  if (score >= 60) return "var(--warn)";
  return "var(--bad)";
}

function countIssues(issues: { severity: string }[]): { high: number; medium: number; low: number } {
  return issues.reduce(
    (acc, i) => {
      if (i.severity === "high") acc.high++;
      else if (i.severity === "medium") acc.medium++;
      else acc.low++;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );
}

function mergeIssueCounts(
  ...groups: { high: number; medium: number; low: number }[]
): { high: number; medium: number; low: number } {
  return groups.reduce(
    (acc, g) => ({ high: acc.high + g.high, medium: acc.medium + g.medium, low: acc.low + g.low }),
    { high: 0, medium: 0, low: 0 },
  );
}

function sectionBadge(counts: { high: number; medium: number; low: number }) {
  const total = counts.high + counts.medium + counts.low;
  if (!total) return null;
  const cls = counts.high > 0 ? "audit-section-badge-bad" : counts.medium > 0 ? "audit-section-badge-warn" : "audit-section-badge-ok";
  return (
    <span className={`audit-section-badge ${cls}`}>
      {total} 项问题
    </span>
  );
}

// ─── Sub-components ─────────────────────────────────────

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost audit-copy-btn"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "已复制" : label}
    </button>
  );
}

export function IssueList({ issues }: { issues: ListingAuditResult["title"]["issues"] }) {
  if (!issues.length) return <p className="audit-muted" style={{ marginTop: 12 }}>无显著问题</p>;
  return (
    <ul className="audit-issue-list" style={{ marginTop: 12 }}>
      {issues.map((issue, i) => (
        <li key={`${issue.area}-${i}`} className={`audit-issue audit-issue-${issue.severity}`}>
          <span className="field-badge">{issue.severity}</span>
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const fill = (score / 100) * C;
  const color = scoreColor(score);
  return (
    <svg viewBox="0 0 120 120" width="160" height="160" aria-label={`综合分 ${score}`}>
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
      <circle
        cx="60" cy="60" r={R}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={`${fill} ${C - fill}`}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="60" textAnchor="middle" dominantBaseline="middle" fontSize="32" fontWeight="700" fill="var(--ink)">{score}</text>
    </svg>
  );
}

function SidebarNav({ audit }: { audit: ListingAuditResult }) {
  const titleIssues = countIssues(audit.title.issues);
  const bulletIssues = countIssues(audit.bullets.issues);
  const stIssues = countIssues(audit.searchTerms.issues);

  const sections = [
    { id: "priorities", label: "优化优先级", dot: false },
    { id: "title", label: "标题 Title", dot: titleIssues.high + titleIssues.medium > 0 },
    { id: "highlights", label: "Item Highlights", dot: false },
    { id: "bullets", label: "五点描述", dot: bulletIssues.high + bulletIssues.medium > 0 },
    { id: "search-terms", label: "搜索词", dot: stIssues.high + stIssues.medium > 0 },
    { id: "attributes", label: "产品属性", dot: audit.attributes.missing.length > 0 },
    { id: "aplus", label: "A+ Content", dot: false },
  ];

  return (
    <nav className="audit-sidebar" aria-label="审查报告目录">
      <p className="audit-sidebar-label">报告目录</p>
      <ul className="audit-sidebar-nav">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="audit-sidebar-item"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {s.label}
              {s.dot && <span className="audit-sidebar-dot" aria-hidden="true" />}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SectionCard({
  id,
  num,
  title,
  issueBadge,
  action,
  children,
}: {
  id: string;
  num: number;
  title: string;
  issueBadge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="audit-section-v2" style={{ scrollMarginTop: 72 }}>
      <div className="audit-section-header">
        <div className="audit-section-title-row">
          <span className="audit-section-num">{num}</span>
          <h3 className="audit-section-title-v2">{title}</h3>
          {issueBadge}
        </div>
        {action}
      </div>
      <div className="audit-section-body">{children}</div>
    </section>
  );
}

// ─── Main ───────────────────────────────────────────────

export function AuditReport({
  snapshot,
  audit,
  onBack,
}: {
  snapshot: AmazonListingSnapshot;
  audit: ListingAuditResult;
  onBack?: () => void;
}) {
  const grade = scoreGrade(audit.overallScore);
  const color = scoreColor(audit.overallScore);

  const titleCounts = countIssues(audit.title.issues);
  const bulletCounts = countIssues(audit.bullets.issues);
  const stCounts = countIssues(audit.searchTerms.issues);
  const totalCounts = mergeIssueCounts(titleCounts, bulletCounts, stCounts);

  const fetchedDate = snapshot.fetchedAt
    ? new Date(snapshot.fetchedAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
    : null;

  return (
    <div className="audit-result-page">
      <div className="audit-result-inner">
        {/* Back button */}
        {onBack && (
          <div className="audit-back-row">
            <button type="button" className="btn-ghost audit-back-btn" onClick={onBack}>
              ← 重新审查
            </button>
          </div>
        )}

        {/* Hero — full width above two-column layout */}
        <div className="audit-hero">
          <div className="audit-hero-gauge">
            <ScoreGauge score={audit.overallScore} />
            <span className={`audit-grade audit-grade-${grade}`} title={`等级 ${grade}`}>
              {grade}
            </span>
          </div>

          <div className="audit-hero-body">
            <p className="audit-hero-summary">{audit.summary}</p>

            <div className="audit-issue-stat">
              {totalCounts.high > 0 && (
                <span className="audit-issue-stat-item">
                  <span className="audit-issue-dot audit-issue-dot-high" />
                  {totalCounts.high} 严重
                </span>
              )}
              {totalCounts.medium > 0 && (
                <span className="audit-issue-stat-item">
                  <span className="audit-issue-dot audit-issue-dot-medium" />
                  {totalCounts.medium} 中等
                </span>
              )}
              {totalCounts.low > 0 && (
                <span className="audit-issue-stat-item">
                  <span className="audit-issue-dot audit-issue-dot-low" />
                  {totalCounts.low} 轻微
                </span>
              )}
              {totalCounts.high + totalCounts.medium + totalCounts.low === 0 && (
                <span className="audit-issue-stat-item" style={{ color: "var(--ok)" }}>无明显问题</span>
              )}
            </div>

            <div className="audit-hero-product">
              {snapshot.mainImageUrl && (
                <img src={snapshot.mainImageUrl} alt="" className="audit-product-thumb-lg" />
              )}
              <div className="audit-product-meta">
                <p className="audit-product-asin" style={{ margin: "0 0 2px" }}>
                  {snapshot.asin}
                </p>
                <p style={{ margin: 0 }}>
                  {snapshot.marketplace}
                  {snapshot.browsePath ? ` · ${snapshot.browsePath}` : ""}
                  {fetchedDate ? ` · 抓取于 ${fetchedDate}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Two-column layout: sidebar + main */}
        <div className="audit-result-body">
          <SidebarNav audit={audit} />

          <div className="audit-main">
            {/* 1. 优化优先级 */}
            {audit.priorities.length > 0 && (
              <SectionCard id="priorities" num={1} title="优化优先级">
                <div className="audit-priority-cards">
                  {audit.priorities
                    .sort((a, b) => a.rank - b.rank)
                    .map((p) => (
                      <div key={p.rank} className="audit-priority-card">
                        <span className="audit-priority-rank">{p.rank}</span>
                        <div className="audit-priority-content">
                          <p className="audit-priority-item">{p.item}</p>
                          <p className="audit-priority-reason">{p.reason}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </SectionCard>
            )}

            {/* 2. 标题 */}
            <SectionCard
              id="title"
              num={2}
              title="标题 Title"
              issueBadge={sectionBadge(titleCounts)}
              action={<CopyButton text={audit.title.suggested} label="复制" />}
            >
              <p className="audit-diff-label-v2">
                当前
                <span className="audit-char-count">{audit.title.charCount} 字符</span>
              </p>
              <p className="audit-text-current">{audit.title.current}</p>
              <IssueList issues={audit.title.issues} />
              <p className="audit-diff-label-v2">
                建议
                <span className="audit-char-count">{audit.title.suggested.length} / 75 字符</span>
              </p>
              <p className="audit-text-suggested">{audit.title.suggested}</p>
            </SectionCard>

            {/* 3. Item Highlights */}
            <SectionCard
              id="highlights"
              num={3}
              title="Item Highlights"
              action={<CopyButton text={audit.itemHighlights.suggested} label="复制" />}
            >
              <p className="audit-text-suggested">{audit.itemHighlights.suggested}</p>
              <p className="audit-muted" style={{ marginTop: 10 }}>
                {audit.itemHighlights.charCount} / 125 字符 · {audit.itemHighlights.rationale}
              </p>
            </SectionCard>

            {/* 4. 五点 Bullets */}
            <SectionCard
              id="bullets"
              num={4}
              title="五点 Bullet Points"
              issueBadge={sectionBadge(bulletCounts)}
              action={<CopyButton text={audit.bullets.suggested.join("\n")} label="复制" />}
            >
              <IssueList issues={audit.bullets.issues} />
              <div className="audit-diff-grid" style={{ marginTop: 16 }}>
                <div>
                  <p className="audit-diff-label-v2">当前</p>
                  <ol className="audit-bullet-list">
                    {audit.bullets.current.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="audit-diff-label-v2">建议</p>
                  <ol className="audit-bullet-list audit-bullet-suggested">
                    {audit.bullets.suggested.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </SectionCard>

            {/* 5. Search Terms */}
            <SectionCard
              id="search-terms"
              num={5}
              title="后台 Search Terms"
              issueBadge={sectionBadge(stCounts)}
              action={<CopyButton text={audit.searchTerms.suggested} label="复制" />}
            >
              <IssueList issues={audit.searchTerms.issues} />
              <p className="audit-suggested audit-search-terms" style={{ marginTop: 12 }}>
                {audit.searchTerms.suggested}
              </p>
            </SectionCard>

            {/* 6. 属性 */}
            <SectionCard id="attributes" num={6} title="产品属性 Attributes">
              {audit.attributes.missing.length > 0 ? (
                <>
                  <p className="audit-diff-label-v2">建议补充字段</p>
                  <ul className="audit-tag-list">
                    {audit.attributes.missing.map((f) => (
                      <li key={f} className="tag-pill-dark">{f}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {Object.keys(audit.attributes.suggested).length > 0 ? (
                <dl className="audit-attr-list">
                  {Object.entries(audit.attributes.suggested).map(([k, v]) => (
                    <div key={k} className="audit-attr-row">
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {audit.attributes.missing.length === 0 && Object.keys(audit.attributes.suggested).length === 0 && (
                <p className="audit-muted">属性填写完整</p>
              )}
            </SectionCard>

            {/* 7. A+ Content */}
            {audit.aPlusOutline.length > 0 && (
              <SectionCard id="aplus" num={7} title="A+ Content 模块建议">
                <ul className="audit-aplus-list">
                  {audit.aPlusOutline.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
