"use client";

import { useMemo, useState } from "react";
import type {
  AmazonAuditEditableSection,
  AmazonAuditWorkspace,
  ListingAuditArea,
  ListingAuditIssue,
} from "@/lib/amazon/types";
import { getAmazonAuditRules } from "@/lib/amazon/rules";

const SECTION_IDS: Record<ListingAuditArea, string> = {
  title: "title",
  highlights: "highlights",
  bullets: "bullets",
  searchTerms: "search-terms",
  attributes: "attributes",
  category: "priorities",
  aPlus: "aplus",
  conversion: "priorities",
};

const EDITABLE_SECTIONS: AmazonAuditEditableSection[] = ["title", "highlights", "bullets", "searchTerms"];
const SEVERITY_LABEL = { high: "严重", medium: "中等", low: "轻微" } as const;
const IMPACT_LABEL = {
  compliance: "合规",
  discoverability: "搜索曝光",
  conversion: "转化",
  completeness: "完整度",
  readability: "可读性",
} as const;
const BASIS_LABEL = {
  confirmed_rule: "已确认规则",
  listing_evidence: "Listing 原文",
  category_guidance: "类目建议",
  heuristic: "优化经验",
} as const;

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

function countIssues(issues: ListingAuditIssue[]) {
  return issues.reduce((acc, issue) => ({ ...acc, [issue.severity]: acc[issue.severity] + 1 }), { high: 0, medium: 0, low: 0 });
}

function CopyButton({ text, label = "复制" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost audit-copy-btn"
      onClick={() => void navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })}
      aria-live="polite"
    >
      {copied ? "已复制" : label}
    </button>
  );
}

function IssueList({ issues }: { issues: ListingAuditIssue[] }) {
  if (!issues.length) return <p className="audit-muted">未发现明显问题</p>;
  return (
    <ul className="audit-issue-list audit-issue-list-v2">
      {issues.map((issue) => (
        <li key={issue.id} className={`audit-issue-card audit-issue-${issue.severity}`}>
          <div className="audit-issue-head">
            <span className={`audit-severity audit-severity-${issue.severity}`}>{SEVERITY_LABEL[issue.severity]}</span>
            <span>{IMPACT_LABEL[issue.impact]}</span>
            <span>{BASIS_LABEL[issue.basisType]}</span>
            <span>置信度 {Math.round(issue.confidence * 100)}%</span>
          </div>
          <p className="audit-issue-message">{issue.message}</p>
          {issue.reason !== issue.message && <p className="audit-issue-reason">为什么：{issue.reason}</p>}
          {issue.evidence.length > 0 && (
            <div className="audit-evidence">
              <span>原文证据</span>
              {issue.evidence.map((item, index) => <q key={index}>{item}</q>)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const fill = score / 100 * circumference;
  return (
    <svg viewBox="0 0 120 120" width="150" height="150" aria-label={`综合分 ${score}`}>
      <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--line)" strokeWidth="10" />
      <circle cx="60" cy="60" r={radius} fill="none" stroke={scoreColor(score)} strokeWidth="10" strokeDasharray={`${fill} ${circumference - fill}`} strokeLinecap="round" transform="rotate(-90 60 60)" />
      <text x="60" y="60" textAnchor="middle" dominantBaseline="middle" fontSize="32" fontWeight="700" fill="var(--ink)">{score}</text>
    </svg>
  );
}

type DiffPart = { text: string; changed: boolean };

function wordDiff(before: string, after: string): { before: DiffPart[]; after: DiffPart[] } {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);
  const table = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const beforeParts: DiffPart[] = [];
  const afterParts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      beforeParts.push({ text: a[i], changed: false });
      afterParts.push({ text: b[j], changed: false });
      i++;
      j++;
    } else if (j < b.length && (i === a.length || table[i][j + 1] >= table[i + 1][j])) {
      afterParts.push({ text: b[j++], changed: true });
    } else if (i < a.length) {
      beforeParts.push({ text: a[i++], changed: true });
    }
  }
  return { before: beforeParts, after: afterParts };
}

function DiffText({ before, after, side }: { before: string; after: string; side: "before" | "after" }) {
  const parts = useMemo(() => wordDiff(before, after)[side], [before, after, side]);
  return <>{parts.map((part, index) => part.changed ? <mark key={index} className={`audit-diff-${side}`}>{part.text}</mark> : <span key={index}>{part.text}</span>)}</>;
}

function SectionStatus({ accepted }: { accepted: boolean }) {
  return <span className={`audit-status ${accepted ? "is-done" : "is-pending"}`}>{accepted ? "已确认" : "待确认"}</span>;
}

function SectionActions({ accepted, onAccept, onReset, copyText }: { accepted: boolean; onAccept: () => void; onReset: () => void; copyText: string }) {
  return (
    <div className="audit-section-actions">
      <CopyButton text={copyText} />
      <button type="button" className="btn-ghost" onClick={onReset}>重置</button>
      <button type="button" className={accepted ? "btn-ghost audit-accepted-btn" : "btn audit-accept-btn"} onClick={onAccept}>
        {accepted ? "已确认" : "接受并确认"}
      </button>
    </div>
  );
}

function SectionCard({ id, num, title, status, actions, children }: { id: string; num: number; title: string; status?: boolean; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="audit-section-v2" style={{ scrollMarginTop: 72 }}>
      <div className="audit-section-header">
        <div className="audit-section-title-row">
          <span className="audit-section-num">{num}</span>
          <h2 className="audit-section-title-v2">{title}</h2>
          {status !== undefined && <SectionStatus accepted={status} />}
        </div>
        {actions}
      </div>
      <div className="audit-section-body">{children}</div>
    </section>
  );
}

export function AuditReport({ workspace, onChange, onBack }: { workspace: AmazonAuditWorkspace; onChange: (next: AmazonAuditWorkspace) => void; onBack?: () => void }) {
  const { audit, snapshot, draft, accepted } = workspace;
  const rules = getAmazonAuditRules(snapshot.marketplace as import("@/lib/amazon/types").AmazonMarketplace);
  const grade = scoreGrade(audit.overallScore);
  const titleCounts = countIssues(audit.title.issues);
  const bulletCounts = countIssues(audit.bullets.issues);
  const searchCounts = countIssues(audit.searchTerms.issues);
  const acceptedCount = EDITABLE_SECTIONS.filter((key) => accepted[key]).length;
  const pendingCount = EDITABLE_SECTIONS.length - acceptedCount;
  const unverifiedAttributeCount = new Set([...audit.attributes.missing, ...Object.keys(audit.attributes.suggested)]).size;
  const fetchedDate = snapshot.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) : null;

  function updateDraft(patch: Partial<typeof draft>, section: AmazonAuditEditableSection) {
    onChange({ ...workspace, draft: { ...draft, ...patch }, accepted: { ...accepted, [section]: false } });
  }

  function acceptSection(section: AmazonAuditEditableSection) {
    onChange({ ...workspace, accepted: { ...accepted, [section]: true } });
  }

  function resetSection(section: AmazonAuditEditableSection) {
    const reset = {
      title: { title: audit.title.suggested },
      highlights: { itemHighlights: audit.itemHighlights.suggested },
      bullets: { bullets: [...audit.bullets.suggested] },
      searchTerms: { searchTerms: audit.searchTerms.suggested },
    }[section];
    onChange({ ...workspace, draft: { ...draft, ...reset }, accepted: { ...accepted, [section]: false } });
  }

  const fullListing = [
    `TITLE\n${draft.title}`,
    `ITEM HIGHLIGHTS\n${draft.itemHighlights}`,
    `BULLET POINTS\n${draft.bullets.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    `SEARCH TERMS\n${draft.searchTerms}`,
  ].join("\n\n");

  const sidebarItems = [
    { id: "priorities", label: "优化优先级", count: audit.priorities.length, done: false },
    { id: "title", label: "标题 Title", count: titleCounts.high + titleCounts.medium + titleCounts.low, done: accepted.title },
    { id: "highlights", label: "Item Highlights", count: 0, done: accepted.highlights },
    { id: "bullets", label: "五点描述", count: bulletCounts.high + bulletCounts.medium + bulletCounts.low, done: accepted.bullets },
    { id: "search-terms", label: "搜索词", count: searchCounts.high + searchCounts.medium + searchCounts.low, done: accepted.searchTerms },
    { id: "attributes", label: "产品属性", count: unverifiedAttributeCount, done: false },
    { id: "aplus", label: "A+ Content", count: 0, done: false },
    { id: "final-listing", label: "最终 Listing", count: pendingCount, done: pendingCount === 0 },
  ];

  return (
    <main className="audit-result-page">
      <div className="audit-result-inner">
        {onBack && <div className="audit-back-row"><button type="button" className="btn-ghost audit-back-btn" onClick={onBack}>← 重新审查</button></div>}

        <section className="audit-hero">
          <div className="audit-hero-gauge">
            <ScoreGauge score={audit.overallScore} />
            <span className={`audit-grade audit-grade-${grade}`} title={`等级 ${grade}`}>{grade}</span>
          </div>
          <div className="audit-hero-body">
            <p className="audit-hero-summary">{audit.summary}</p>
            <div className="audit-progress-row">
              <strong>{acceptedCount}/{EDITABLE_SECTIONS.length} 项已确认</strong>
              <span>{pendingCount ? `还有 ${pendingCount} 项待确认` : "编辑内容已全部确认"}</span>
              <button type="button" className="btn audit-final-cta" onClick={() => document.getElementById("final-listing")?.scrollIntoView({ behavior: "smooth" })}>查看最终稿</button>
            </div>
            <div className="audit-score-grid" aria-label="分项评分">
              {Object.entries(audit.scoreBreakdown).map(([key, value]) => (
                <div key={key} className="audit-score-item">
                  <span>{IMPACT_LABEL[key as keyof typeof IMPACT_LABEL]}</span><strong>{value}</strong>
                  <span className="audit-score-bar"><i style={{ width: `${value}%` }} /></span>
                </div>
              ))}
            </div>
            <div className="audit-hero-product">
              {snapshot.mainImageUrl && <img src={snapshot.mainImageUrl} alt="" className="audit-product-thumb-lg" />}
              <div className="audit-product-meta"><p className="audit-product-asin">{snapshot.asin}</p><p>{snapshot.marketplace}{snapshot.browsePath ? ` · ${snapshot.browsePath}` : ""}{fetchedDate ? ` · 抓取于 ${fetchedDate}` : ""}</p></div>
            </div>
          </div>
        </section>

        <nav className="audit-mobile-nav" aria-label="移动端报告目录">
          <label htmlFor="audit-section-select">跳转到</label>
          <select id="audit-section-select" onChange={(event) => document.getElementById(event.target.value)?.scrollIntoView({ behavior: "smooth" })}>
            {sidebarItems.map((item) => <option key={item.id} value={item.id}>{item.label}{item.count ? ` (${item.count})` : ""}</option>)}
          </select>
        </nav>

        <div className="audit-result-body">
          <nav className="audit-sidebar" aria-label="审查报告目录">
            <p className="audit-sidebar-label">报告目录</p>
            <ul className="audit-sidebar-nav">
              {sidebarItems.map((item) => (
                <li key={item.id}><a href={`#${item.id}`} className="audit-sidebar-item">{item.label}<span className={item.done ? "audit-nav-done" : "audit-nav-count"}>{item.done ? "✓" : item.count || ""}</span></a></li>
              ))}
            </ul>
          </nav>

          <div className="audit-main">
            {audit.priorities.length > 0 && (
              <SectionCard id="priorities" num={1} title="优化优先级">
                <div className="audit-priority-cards">
                  {[...audit.priorities].sort((a, b) => a.rank - b.rank).map((priority) => (
                    <button key={`${priority.rank}-${priority.item}`} type="button" className="audit-priority-card" onClick={() => document.getElementById(SECTION_IDS[priority.area])?.scrollIntoView({ behavior: "smooth" })}>
                      <span className="audit-priority-rank">{priority.rank}</span>
                      <span className="audit-priority-content"><strong>{priority.item}</strong><span>{priority.reason}</span></span>
                      <span className={`audit-impact audit-impact-${priority.impact}`}>{priority.impact === "high" ? "高影响" : priority.impact === "medium" ? "中影响" : "低影响"}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>
            )}

            <SectionCard id="title" num={2} title="标题 Title" status={accepted.title} actions={<SectionActions accepted={accepted.title} onAccept={() => acceptSection("title")} onReset={() => resetSection("title")} copyText={draft.title} />}>
              <IssueList issues={audit.title.issues} />
              <div className="audit-diff-panel"><div><span>当前 · {audit.title.charCount} 字符</span><p><DiffText before={audit.title.current} after={draft.title} side="before" /></p></div><div><span>编辑稿 · {draft.title.length} / {rules.title.recommendedMaxCharacters} 建议字符</span><p><DiffText before={audit.title.current} after={draft.title} side="after" /></p></div></div>
              <label className="audit-editor-label" htmlFor="audit-title-editor">编辑建议标题</label>
              <textarea id="audit-title-editor" className="audit-editor" rows={3} value={draft.title} onChange={(event) => updateDraft({ title: event.target.value }, "title")} />
              <p className="audit-guidance">{rules.title.label}</p>
            </SectionCard>

            <SectionCard id="highlights" num={3} title="Item Highlights" status={accepted.highlights} actions={<SectionActions accepted={accepted.highlights} onAccept={() => acceptSection("highlights")} onReset={() => resetSection("highlights")} copyText={draft.itemHighlights} />}>
              <p className="audit-guidance">{audit.itemHighlights.rationale}</p>
              <label className="audit-editor-label" htmlFor="audit-highlights-editor">编辑建议内容 · {draft.itemHighlights.length} / {rules.itemHighlights.recommendedMaxCharacters} 建议字符</label>
              <textarea id="audit-highlights-editor" className="audit-editor" rows={3} value={draft.itemHighlights} onChange={(event) => updateDraft({ itemHighlights: event.target.value }, "highlights")} />
            </SectionCard>

            <SectionCard id="bullets" num={4} title="五点 Bullet Points" status={accepted.bullets} actions={<SectionActions accepted={accepted.bullets} onAccept={() => acceptSection("bullets")} onReset={() => resetSection("bullets")} copyText={draft.bullets.join("\n")} />}>
              <IssueList issues={audit.bullets.issues} />
              <div className="audit-bullet-editors">
                {Array.from({ length: 5 }, (_, index) => {
                  const current = audit.bullets.current[index] ?? "";
                  const value = draft.bullets[index] ?? "";
                  return <div key={index} className="audit-bullet-editor"><p className="audit-bullet-current"><strong>原文 {index + 1}</strong><br /><DiffText before={current} after={value} side="before" /></p><label htmlFor={`audit-bullet-${index}`}>编辑稿 {index + 1} · {value.length} 字符</label><textarea id={`audit-bullet-${index}`} className="audit-editor" rows={4} value={value} onChange={(event) => { const bullets = [...draft.bullets]; bullets[index] = event.target.value; updateDraft({ bullets }, "bullets"); }} /></div>;
                })}
              </div>
            </SectionCard>

            <SectionCard id="search-terms" num={5} title="后台 Search Terms" status={accepted.searchTerms} actions={<SectionActions accepted={accepted.searchTerms} onAccept={() => acceptSection("searchTerms")} onReset={() => resetSection("searchTerms")} copyText={draft.searchTerms} />}>
              <IssueList issues={audit.searchTerms.issues} />
              <p className="audit-guidance">当前内容：{snapshot.searchTerms || "公开页面无法获取，需在 Seller Central 核验"}</p>
              <label className="audit-editor-label" htmlFor="audit-search-editor">编辑建议搜索词 · {new TextEncoder().encode(draft.searchTerms).length} / {rules.searchTerms.recommendedMaxBytes} 建议字节</label>
              <textarea id="audit-search-editor" className="audit-editor" rows={4} value={draft.searchTerms} onChange={(event) => updateDraft({ searchTerms: event.target.value }, "searchTerms")} />
              <p className="audit-guidance">{rules.searchTerms.label}</p>
            </SectionCard>

            <SectionCard id="attributes" num={6} title="产品属性 Attributes">
              <div className="audit-warning-box"><strong>需要人工核验</strong><p>以下属性不会自动写入最终稿。请以包装、说明书或 Seller Central 中的产品事实为准。</p></div>
              {audit.attributes.missing.length > 0 && <><p className="audit-editor-label">建议补充字段</p><ul className="audit-tag-list">{audit.attributes.missing.map((field) => <li key={field} className="tag-pill-dark">{field}</li>)}</ul></>}
              {Object.keys(audit.attributes.suggested).length > 0 && <dl className="audit-attr-list">{Object.entries(audit.attributes.suggested).map(([key, value]) => <div key={key} className="audit-attr-row"><dt>{key}</dt><dd>{value}<span>待核验</span></dd></div>)}</dl>}
            </SectionCard>

            {audit.aPlusOutline.length > 0 && <SectionCard id="aplus" num={7} title="A+ Content 模块建议"><ul className="audit-aplus-list">{audit.aPlusOutline.map((line, index) => <li key={index}>{line}</li>)}</ul></SectionCard>}

            <SectionCard id="final-listing" num={8} title="最终 Listing">
              <div className={pendingCount || unverifiedAttributeCount ? "audit-final-warning" : "audit-final-ready"} role="status">
                <strong>{pendingCount ? `${pendingCount} 个内容区尚未确认` : "内容区已全部确认"}</strong>
                <span>{unverifiedAttributeCount ? `另有 ${unverifiedAttributeCount} 项产品属性待核验，不包含在最终稿中。` : "没有待核验属性。"}</span>
              </div>
              <div className="audit-final-toolbar"><CopyButton text={fullListing} label="一键复制全部" /></div>
              <div className="audit-final-fields">
                <article><header><h3>Title</h3><SectionStatus accepted={accepted.title} /><CopyButton text={draft.title} /></header><p>{draft.title}</p></article>
                <article><header><h3>Item Highlights</h3><SectionStatus accepted={accepted.highlights} /><CopyButton text={draft.itemHighlights} /></header><p>{draft.itemHighlights}</p></article>
                <article><header><h3>Bullet Points</h3><SectionStatus accepted={accepted.bullets} /><CopyButton text={draft.bullets.join("\n")} /></header><ol>{draft.bullets.map((item, index) => <li key={index}>{item}</li>)}</ol></article>
                <article><header><h3>Search Terms</h3><SectionStatus accepted={accepted.searchTerms} /><CopyButton text={draft.searchTerms} /></header><p>{draft.searchTerms}</p></article>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </main>
  );
}
