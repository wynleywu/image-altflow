"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ImageRecord } from "@/lib/types";

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

function formatTime(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

export default function HistoryPage() {
  const [records, setRecords] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/records");
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "加载历史记录失败");
        if (!cancelled) setRecords(data.records as ImageRecord[]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载历史记录失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="upload-page history-page">
      <BrandLink />
      <div className="mode-tabs">
        <Link href="/" className="mode-tab mode-tab-link">
          图片 SEO
        </Link>
        <span className="mode-tab is-active">历史记录</span>
      </div>

      {loading ? (
        <p className="history-empty">加载中…</p>
      ) : error ? (
        <p className="history-empty history-error">{error}</p>
      ) : records.length === 0 ? (
        <p className="history-empty">还没有处理记录。</p>
      ) : (
        <div className="history-grid">
          {records.map((record) => (
            <div key={record.recordId} className="history-card">
              <div className="history-thumb">
                {record.thumbnailDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={record.thumbnailDataUrl} alt={record.altText || record.originalFileName} />
                ) : (
                  <div className="history-thumb-placeholder" aria-hidden="true" />
                )}
              </div>
              <div className="history-card-body">
                <p className="history-filename">{record.newFileName || record.originalFileName}</p>
                <p className="history-alt">{record.altText || "（无 Alt Text）"}</p>
                <div className="history-card-footer">
                  <span className={`history-status history-status-${record.flowStatus}`}>
                    {record.flowStatus === "success" ? "成功" : record.flowStatus === "failed" ? "失败" : record.flowStatus}
                  </span>
                  <span className="history-time">{formatTime(record.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
