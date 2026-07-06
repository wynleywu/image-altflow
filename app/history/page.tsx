"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AiImageResult, ImageRecord, ReviewStatus } from "@/lib/types";
import { PageFrame, type MetadataLightboxPayload } from "@/app/metadata-lightbox";
import { listLocalHistoryRecords } from "@/lib/client/history-store";

function BrandLink() {
  return (
    <Link href="/" className="nav-logo" aria-label="altflow 首页">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="#0D0D0D" />
        <path d="M7.5 17.5l4.5-11 4.5 11" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 13.5h5" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      altflow
    </Link>
  );
}

const REVIEW_FILTERS: { label: string; value: ReviewStatus | "" }[] = [
  { label: "全部", value: "" },
  { label: "待审核", value: "待审核" },
  { label: "通过", value: "通过" },
  { label: "退回", value: "退回" },
];

const REVIEW_BADGE_CLASS: Record<string, string> = {
  待审核: "history-badge-pending",
  通过: "history-badge-approved",
  退回: "history-badge-rejected",
};

function formatTime(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function parseAi(manualNote: string): AiImageResult | null {
  if (!manualNote) return null;
  try {
    const parsed = JSON.parse(manualNote);
    return parsed && typeof parsed === "object" && "alt_text_en" in parsed ? (parsed as AiImageResult) : null;
  } catch {
    return null;
  }
}

export default function HistoryPage() {
  const [records, setRecords] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ReviewStatus | "">("");
  const [lightbox, setLightbox] = useState<MetadataLightboxPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const records = await listLocalHistoryRecords(filter);
        if (!cancelled) setRecords(records);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载历史记录失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  function openRecord(record: ImageRecord) {
    const ai = parseAi(record.manualNote);
    if (!ai || !record.thumbnailDataUrl) return;
    setLightbox({
      imageUrl: record.thumbnailDataUrl,
      fileName: record.newFileName || record.originalFileName,
      ai,
    });
  }

  return (
    <PageFrame lightbox={lightbox} onCloseLightbox={() => setLightbox(null)}>
      <div className="audit-result-topbar">
        <div className="audit-topbar-left">
          <BrandLink />
        </div>
      </div>

      <div className="audit-result-inner">
        <div className="history-filter-row">
          {REVIEW_FILTERS.map((item) => (
            <button
              key={item.value || "all"}
              type="button"
              className={`history-filter-pill${filter === item.value ? " is-active" : ""}`}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="history-empty-state">
            <p className="history-empty-kicker">加载中</p>
            <h2 className="history-empty-title">正在获取历史记录…</h2>
          </div>
        ) : error ? (
          <div className="history-empty-state">
            <p className="history-empty-kicker is-error">错误</p>
            <h2 className="history-empty-title">加载历史记录失败</h2>
            <p className="history-empty-desc">{error}</p>
          </div>
        ) : records.length === 0 ? (
          <div className="history-empty-state">
            <p className="history-empty-kicker">暂无记录</p>
            <h2 className="history-empty-title">还没有处理记录</h2>
            <p className="history-empty-desc">上传并分析图片后，记录会出现在这里。</p>
          </div>
        ) : (
          <div className="history-list">
            {records.map((record) => {
              const clickable = Boolean(record.manualNote && record.thumbnailDataUrl);
              return (
                <button
                  key={record.recordId}
                  type="button"
                  className={`history-row${clickable ? "" : " is-static"}`}
                  onClick={() => openRecord(record)}
                  disabled={!clickable}
                >
                  <div className="history-row-thumb">
                    {record.thumbnailDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={record.thumbnailDataUrl} alt={record.altText || record.originalFileName} />
                    ) : null}
                  </div>
                  <div className="history-row-body">
                    <p className="history-filename">{record.newFileName || record.originalFileName}</p>
                    <p className="history-alt">{record.altText || "（无 Alt Text）"}</p>
                  </div>
                  <div className="history-row-meta">
                    <div className="history-badges">
                      <span className={`history-badge history-badge-${record.flowStatus === "success" ? "success" : "failed"}`}>
                        {record.flowStatus === "success" ? "成功" : "失败"}
                      </span>
                      {record.reviewStatus ? (
                        <span className={`history-badge ${REVIEW_BADGE_CLASS[record.reviewStatus] ?? ""}`}>
                          {record.reviewStatus}
                        </span>
                      ) : null}
                    </div>
                    <span className="history-time">{formatTime(record.createdAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </PageFrame>
  );
}
