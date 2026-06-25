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
  const [originalFileName, setOriginalFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImageRecord | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          original_file_name: originalFileName || undefined,
          source: "web",
        }),
      });
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
        <h1 style={{ marginTop: 0, fontSize: "1.8rem" }}>提交图片链接</h1>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          输入公开可访问的产品图 URL，系统会调用 Gemini 生成文件名、Alt Text、Caption 和 Tags，并写入飞书多维表格等待审核。
        </p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem", marginTop: "1.25rem" }}>
          <div>
            <label className="label" htmlFor="image_url">图片链接 *</label>
            <input
              id="image_url"
              className="input"
              type="url"
              required
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
            {loading ? "识别中..." : "开始识别"}
          </button>
        </form>
        {error ? <div style={{ marginTop: "1rem", color: "var(--bad)" }}>{error}</div> : null}
      </section>

      <section>
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ marginTop: 0 }}>使用说明</h2>
          <ul className="muted" style={{ lineHeight: 1.8, paddingLeft: "1.1rem" }}>
            <li>第一阶段只支持图片 URL，不上传本地文件。</li>
            <li>识别结果会同步到飞书多维表格。</li>
            <li>审核请在「审核列表」页修改并更新状态。</li>
            <li>部署到 Vercel 后，在环境变量里配置 Gemini 和飞书凭证。</li>
          </ul>
        </div>
        {result ? <ResultCard record={result} /> : null}
      </section>
    </div>
  );
}
