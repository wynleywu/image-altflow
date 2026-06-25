"use client";

import { useState } from "react";
import type { ImageRecord } from "@/lib/types";

function ResultCard({ record }: { record: ImageRecord }) {
  return (
    <div className="card" style={{ padding: "1.25rem", marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700 }}>{record.newFileName || record.originalFileName}</div>
          <div className="muted" style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Trace: {record.traceId || "—"}
          </div>
        </div>
        <span className={`badge ${record.reviewStatus === "通过" ? "badge-pass" : record.flowStatus === "failed" ? "badge-fail" : "badge-pending"}`}>
          {record.reviewStatus || record.flowStatus}
        </span>
      </div>
      {record.imageUrl ? (
        <img
          src={record.imageUrl}
          alt={record.altText || record.originalFileName}
          style={{ width: "100%", maxHeight: 280, objectFit: "contain", marginTop: "1rem", borderRadius: 12, background: "#f7f2ea" }}
        />
      ) : null}
      {record.sourceImageUrl ? (
        <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.5rem", wordBreak: "break-all" }}>
          原始来源：<a href={record.sourceImageUrl} target="_blank" rel="noreferrer">{record.sourceImageUrl}</a>
        </div>
      ) : null}
      <div className="grid-2" style={{ marginTop: "1rem" }}>
        <div>
          <div className="label">Alt Text</div>
          <div>{record.altText || "—"}</div>
        </div>
        <div>
          <div className="label">Caption</div>
          <div>{record.caption || "—"}</div>
        </div>
        <div>
          <div className="label">产品类型</div>
          <div>{record.productType || "—"}</div>
        </div>
        <div>
          <div className="label">Tags</div>
          <div>{record.tags.join(", ") || "—"}</div>
        </div>
      </div>
      {record.errorMessage ? (
        <div style={{ marginTop: "1rem", color: "var(--bad)" }}>
          {record.errorType}: {record.errorMessage}
        </div>
      ) : null}
    </div>
  );
}

export default function HomePage() {
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalFileName, setOriginalFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImageRecord | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!imageFile && !imageUrl.trim()) {
      setError("请上传图片或填写图片链接");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      let response: Response;
      if (imageFile) {
        const form = new FormData();
        form.append("image", imageFile);
        if (imageUrl.trim()) form.append("image_url", imageUrl.trim());
        if (originalFileName.trim()) form.append("original_file_name", originalFileName.trim());
        form.append("source", "web");
        response = await fetch("/api/analyze", { method: "POST", body: form });
      } else {
        response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: imageUrl.trim(),
            original_file_name: originalFileName.trim() || undefined,
            source: "web",
          }),
        });
      }

      const data = await response.json();
      if (data.record) {
        setResult(data.record);
      }
      if (!response.ok || !data.ok) {
        setError(data.error || "分析失败");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid-2">
      <section className="card" style={{ padding: "1.5rem" }}>
        <h1 style={{ marginTop: 0, fontSize: "1.8rem" }}>提交图片</h1>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          上传本地图片或填写公开可访问的产品图 URL。图片会先存入 Blob 永久保存，再调用 Gemini 生成文件名、Alt Text、Caption 和 Tags。
        </p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem", marginTop: "1.25rem" }}>
          <div>
            <label className="label" htmlFor="image_file">本地上传</label>
            <input
              id="image_file"
              className="input"
              type="file"
              accept="image/*"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            />
            {imageFile ? (
              <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                已选：{imageFile.name}
              </div>
            ) : null}
          </div>
          <div>
            <label className="label" htmlFor="image_url">或填写图片链接</label>
            <input
              id="image_url"
              className="input"
              type="url"
              placeholder="https://example.com/product.jpg"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="original_file_name">原文件名（可选）</label>
            <input
              id="original_file_name"
              className="input"
              type="text"
              placeholder="IMG_001.jpg"
              value={originalFileName}
              onChange={(event) => setOriginalFileName(event.target.value)}
            />
          </div>
          <button className="button" type="submit" disabled={loading}>
            {loading ? "保存并识别中..." : "开始识别"}
          </button>
        </form>
        {error ? <div style={{ marginTop: "1rem", color: "var(--bad)" }}>{error}</div> : null}
      </section>

      <section>
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ marginTop: 0 }}>使用说明</h2>
          <ul className="muted" style={{ lineHeight: 1.8, paddingLeft: "1.1rem" }}>
            <li>支持本地上传或图片 URL，二选一即可。</li>
            <li>图片会持久化到 Vercel Blob，不依赖外链是否失效。</li>
            <li>识别结果保存到 Postgres，审核在「审核列表」页进行。</li>
            <li>部署时需同时配置 Postgres 与 Blob Storage。</li>
          </ul>
        </div>
        {result ? <ResultCard record={result} /> : null}
      </section>
    </div>
  );
}
