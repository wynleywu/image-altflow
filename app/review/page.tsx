"use client";

import { useEffect, useState } from "react";
import { loadReviewRecords, saveReviewRecord } from "@/app/review/actions";
import type { ImageRecord, ReviewStatus } from "@/lib/types";

const FILTERS: Array<{ label: string; value: string }> = [
  { label: "全部", value: "" },
  { label: "待审核", value: "待审核" },
  { label: "通过", value: "通过" },
  { label: "退回", value: "退回" },
];

function ReviewEditor({ record, onSaved }: { record: ImageRecord; onSaved: (record: ImageRecord) => void }) {
  const [newFileName, setNewFileName] = useState(record.newFileName);
  const [altText, setAltText] = useState(record.altText);
  const [caption, setCaption] = useState(record.caption);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | "">(record.reviewStatus || "待审核");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNewFileName(record.newFileName);
    setAltText(record.altText);
    setCaption(record.caption);
    setReviewStatus(record.reviewStatus || "待审核");
  }, [record]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const data = await saveReviewRecord({
        recordId: record.recordId,
        newFileName,
        altText,
        caption,
        reviewStatus,
      });
      if (!data.ok || !data.record) {
        throw new Error(data.error || "保存失败");
      }
      onSaved(data.record);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700 }}>{record.originalFileName}</div>
          <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            {record.traceId || record.recordId}
          </div>
        </div>
        <span className={`badge ${reviewStatus === "通过" ? "badge-pass" : reviewStatus === "退回" ? "badge-fail" : "badge-pending"}`}>
          {reviewStatus || "待审核"}
        </span>
      </div>

      {record.imageUrl ? (
        <img
          src={record.imageUrl}
          alt={altText || record.originalFileName}
          style={{ width: "100%", maxHeight: 220, objectFit: "contain", marginTop: "1rem", borderRadius: 12, background: "#f7f2ea" }}
        />
      ) : null}
      {record.sourceImageUrl ? (
        <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.5rem", wordBreak: "break-all" }}>
          原始来源：<a href={record.sourceImageUrl} target="_blank" rel="noreferrer">{record.sourceImageUrl}</a>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: "0.9rem", marginTop: "1rem" }}>
        <div>
          <label className="label">新文件名</label>
          <input className="input" value={newFileName} onChange={(event) => setNewFileName(event.target.value)} />
        </div>
        <div>
          <label className="label">Alt Text</label>
          <textarea className="textarea" value={altText} onChange={(event) => setAltText(event.target.value)} />
        </div>
        <div>
          <label className="label">Caption</label>
          <textarea className="textarea" value={caption} onChange={(event) => setCaption(event.target.value)} />
        </div>
        <div>
          <label className="label">审核状态</label>
          <select className="select" value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as ReviewStatus)}>
            <option value="待审核">待审核</option>
            <option value="通过">通过</option>
            <option value="退回">退回</option>
          </select>
        </div>
        <button className="button" onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存审核结果"}
        </button>
        {error ? <div style={{ color: "var(--bad)" }}>{error}</div> : null}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const [filter, setFilter] = useState("");
  const [records, setRecords] = useState<ImageRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecords(nextFilter = filter) {
    setLoading(true);
    setError("");
    try {
      const data = await loadReviewRecords(nextFilter || undefined);
      if (!data.ok || !data.records) {
        throw new Error(data.error || "加载失败");
      }
      setRecords(data.records);
      if (!selectedId && data.records[0]) {
        setSelectedId(data.records[0].recordId);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  const selected = records.find((record) => record.recordId === selectedId) || records[0] || null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>审核列表</h1>
          <p className="muted" style={{ marginBottom: 0 }}>数据保存在自有数据库，可直接在此修改并保存。</p>
        </div>
        <button className="button button-secondary" onClick={() => loadRecords()} disabled={loading}>
          刷新
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "1rem 0" }}>
        {FILTERS.map((item) => (
          <button
            key={item.label}
            className={`button ${filter === item.value ? "" : "button-secondary"}`}
            onClick={() => {
              setFilter(item.value);
              loadRecords(item.value);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <div className="muted">加载中...</div> : null}
      {error ? <div style={{ color: "var(--bad)", marginBottom: "1rem" }}>{error}</div> : null}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {records.map((record) => (
            <button
              key={record.recordId}
              className="card"
              style={{
                padding: "1rem",
                textAlign: "left",
                cursor: "pointer",
                borderColor: selected?.recordId === record.recordId ? "var(--accent)" : "var(--line)",
              }}
              onClick={() => setSelectedId(record.recordId)}
            >
              <div style={{ fontWeight: 600 }}>{record.newFileName || record.originalFileName}</div>
              <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                {record.reviewStatus || "待审核"} · {record.altText.slice(0, 60) || "无 Alt Text"}
              </div>
            </button>
          ))}
          {!loading && records.length === 0 ? <div className="muted">暂无记录</div> : null}
        </div>

        <div>
          {selected ? (
            <ReviewEditor
              record={selected}
              onSaved={(record) => {
                setRecords((current) => current.map((item) => (item.recordId === record.recordId ? record : item)));
              }}
            />
          ) : (
            <div className="card muted" style={{ padding: "1.25rem" }}>选择一条记录开始审核</div>
          )}
        </div>
      </div>
    </div>
  );
}
