"use client";

import { useEffect, useState } from "react";
import type { ImageRecord } from "@/lib/types";
import { PageFrame, type MetadataLightboxPayload } from "@/app/metadata-lightbox";
import { listLocalHistoryRecords, parseManualNoteAi } from "@/lib/client/history-store";
import { BrandLink } from "@/app/brand-link";

function formatTime(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

export default function HistoryPage() {
  const [records, setRecords] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<MetadataLightboxPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const records = await listLocalHistoryRecords();
        if (!cancelled) setRecords(records);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载历史记录失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function openRecord(record: ImageRecord) {
    const ai = parseManualNoteAi(record.manualNote);
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
