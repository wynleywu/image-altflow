"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AiImageResult, EmbedApiResponse, AnalyzeApiResponse } from "@/lib/types";

type Step = "upload" | "analyzing" | "edit" | "done";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadBase64(base64: string, fileName: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function HomePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [tab, setTab] = useState<"single" | "batch">("single");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [ai, setAi] = useState<AiImageResult | null>(null);
  const [originalBase64, setOriginalBase64] = useState("");
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [doneFileName, setDoneFileName] = useState("");
  const [error, setError] = useState("");
  const [embedding, setEmbedding] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const fileMeta = useMemo(() => {
    if (!file) return null;
    return { name: file.name, size: formatSize(file.size) };
  }, [file]);

  function resetAll() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStep("upload");
    setFile(null);
    setPreviewUrl("");
    setAi(null);
    setOriginalBase64("");
    setMimeType("image/jpeg");
    setDoneFileName("");
    setError("");
    setEmbedding(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function pickFile(next: File | null) {
    if (!next || !next.type.startsWith("image/")) {
      setError("请选择图片文件（JPEG / PNG 推荐）");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setError("");
    void startAnalyze(next);
  }

  async function startAnalyze(selected: File) {
    setStep("analyzing");
    setError("");

    try {
      const form = new FormData();
      form.append("image", selected);

      let response: Response;
      try {
        response = await fetch("/api/analyze", { method: "POST", body: form });
      } catch {
        throw new Error("无法连接分析接口，请确认 npm run dev 正在运行");
      }

      let data: AnalyzeApiResponse;
      try {
        data = (await response.json()) as AnalyzeApiResponse;
      } catch {
        throw new Error(`分析接口返回异常（HTTP ${response.status}）`);
      }

      if (!response.ok || !data.ok || !data.ai || !data.originalImageBase64) {
        const message = data.error || "识图失败";
        if (message.includes("GEMINI_API_KEY")) {
          throw new Error("未配置 GEMINI_API_KEY，请在 .env.local 中设置后重启 dev server");
        }
        throw new Error(message);
      }

      setAi(data.ai);
      setOriginalBase64(data.originalImageBase64);
      setMimeType(data.mimeType || selected.type || "image/jpeg");
      setStep("edit");
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "识图失败");
      setStep("upload");
    }
  }

  async function handleEmbedDownload() {
    if (!ai || !originalBase64) return;
    setEmbedding(true);
    setError("");

    try {
      const response = await fetch("/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: originalBase64,
          mimeType,
          ai,
          originalFileName: file?.name,
        }),
      });
      const data = (await response.json()) as EmbedApiResponse;
      if (!response.ok || !data.ok || !data.download) {
        throw new Error(data.error || "写入失败");
      }

      downloadBase64(data.download.base64, data.download.fileName, data.download.mimeType);
      setDoneFileName(data.download.fileName);
      setStep("done");
    } catch (embedError) {
      setError(embedError instanceof Error ? embedError.message : "写入失败");
    } finally {
      setEmbedding(false);
    }
  }

  function updateAi(patch: Partial<AiImageResult>) {
    setAi((current) => (current ? { ...current, ...patch } : current));
  }

  /* ─── UPLOAD ─── */
  if (step === "upload") {
    return (
      <div className="upload-page">
        <a href="/" className="nav-logo page-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#0D0D0D" />
            <path d="M7.5 17.5l4.5-11 4.5 11" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9.5 13.5h5" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          altflow
        </a>
        <div className="mode-tabs">
          <button
            type="button"
            className={`mode-tab ${tab === "single" ? "is-active" : ""}`}
            onClick={() => setTab("single")}
          >
            单张图片
          </button>
          <button type="button" className="mode-tab" disabled title="批量处理将在后续版本开放">
            批量处理
          </button>
        </div>

        <h1 className="upload-h1">上传产品图片，获取嵌入式 SEO 元数据。</h1>

        <label
          className={`drop-zone ${dragOver ? "is-dragover" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <rect x="1" y="1" width="54" height="54" rx="14" stroke="#D2D2CC" strokeWidth="1.5" strokeDasharray="5 3.5" />
            <path d="M28 38V24" stroke="#0D0D0D" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M21 30l7-7 7 7" stroke="#0D0D0D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 41h18" stroke="#0D0D0D" strokeWidth="2.2" strokeLinecap="round" opacity="0.18" />
          </svg>
          <div className="drop-zone-text">
            <p className="drop-zone-main">拖拽图片到此处</p>
            <p className="drop-zone-sub">
              或 <span>点击浏览文件</span>
            </p>
          </div>
          <p className="drop-zone-caption">JPEG · PNG · WEBP · RAW · HEIF</p>
        </label>

        {error ? <div className="upload-error">{error}</div> : null}

        <div className="steps-strip">
          <div className="steps-strip-item">
            <p>① 上传</p>
            <p>产品图片</p>
          </div>
          <div className="steps-strip-item">
            <p>② Gemini</p>
            <p>双语分析</p>
          </div>
          <div className="steps-strip-item">
            <p>③ 下载</p>
            <p>EXIF · XMP · IPTC</p>
          </div>
        </div>
      </div>
    );
  }

  /* ─── ANALYZING ─── */
  if (step === "analyzing") {
    return (
      <div className="analyze-split fade-up">
        <div className="analyze-left">
          <div className="analyze-left-inner">
            <a href="/" className="nav-logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="6" fill="#0D0D0D" />
                <path d="M7.5 17.5l4.5-11 4.5 11" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9.5 13.5h5" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              altflow
            </a>
            <div className="analyze-preview">
              {previewUrl ? <img src={previewUrl} alt="" /> : null}
            </div>
            <div className="analyze-file-meta">
              <span className="analyze-file-name">{fileMeta?.name}</span>
              <span className="analyze-file-size">{fileMeta?.size}</span>
            </div>
          </div>
        </div>

        <div className="analyze-right">
          <div className="spin-ring-wrap">
            <svg className="spin-ring-track" width="60" height="60" viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="25" stroke="#F0F0EE" strokeWidth="3.5" fill="none" />
            </svg>
            <svg className="spin-ring-arc" width="60" height="60" viewBox="0 0 60 60">
              <path d="M30 5a25 25 0 0 1 25 25" stroke="#C9F178" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </svg>
          </div>

          <div className="analyze-heading">
            <h2>分析中…</h2>
            <p>Gemini 正在识别产品内容</p>
            <p>生成中英双语 SEO 元数据</p>
          </div>

          <div className="dot-bounce-row">
            <span className="dot-bounce" />
            <span className="dot-bounce" />
            <span className="dot-bounce" />
          </div>

          <div className="analyze-steps-box">
            <p className="analyze-steps-label">处理步骤</p>
            <div className="analyze-step" style={{ animation: "step-in 0.3s ease 0.1s both" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="7" fill="#16A34A" />
                <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              已接收图片
            </div>
            <div className="analyze-step" style={{ animation: "step-in 0.3s ease 0.75s both" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="7" fill="#16A34A" />
                <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              产品类型已识别
            </div>
            <div className="analyze-step is-pending" style={{ animation: "step-in 0.3s ease 1.4s both" }}>
              <svg
                className="analyze-step-spin"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                style={{ flexShrink: 0 }}
              >
                <circle
                  cx="8" cy="8" r="6"
                  stroke="#C9F178" strokeWidth="2" fill="none"
                  strokeDasharray="8 5" strokeLinecap="round"
                />
              </svg>
              生成元数据中…
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── EDIT ─── */
  if (step === "edit" && ai) {
    return (
      <div className="meta-split fade-up">
        <aside className="meta-sidebar">
          <a href="/" className="nav-logo sidebar-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="#0D0D0D" />
              <path d="M7.5 17.5l4.5-11 4.5 11" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9.5 13.5h5" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            altflow
          </a>
          <div className="sidebar-preview">
            {previewUrl ? <img src={previewUrl} alt="" /> : null}
          </div>
          <div className="sidebar-info">
            <div>
              <p className="sidebar-info-label">原始文件</p>
              <p className="sidebar-info-value">{fileMeta?.name}</p>
            </div>
            <div>
              <p className="sidebar-info-label">文件大小</p>
              <p className="sidebar-info-value is-muted">{fileMeta?.size}</p>
            </div>
            <div>
              <p className="sidebar-info-label">状态</p>
              <span className="sidebar-status">
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <circle cx="5" cy="5" r="4.5" fill="#16A34A" />
                  <path d="M3 5l1.5 1.5 2.5-2.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                分析完成
              </span>
            </div>
          </div>
        </aside>

        <div className="meta-content">
          <div className="meta-content-header">
            <div>
              <h2 className="meta-content-h2">下载前可编辑</h2>
              <p className="meta-content-sub">英文字段将写入图片 EXIF / XMP / IPTC。</p>
            </div>
            <div className="meta-header-actions">
              <button type="button" className="btn-ghost" onClick={resetAll}>
                ← 重新选择
              </button>
              <button type="button" className="btn" onClick={handleEmbedDownload} disabled={embedding}>
                {embedding ? "写入中…" : "写入并下载"}
              </button>
            </div>
          </div>

          <div className="fields-card">
            {/* Filename */}
            <div className="field-row">
              <div className="field-label-row">
                <span className="field-key">文件名</span>
                <span className="field-badge">EXIF · 下载文件名</span>
              </div>
              <input
                className="field-input"
                value={ai.new_file_name}
                onChange={(e) => updateAi({ new_file_name: e.target.value })}
              />
            </div>

            {/* Alt Text */}
            <div className="field-row">
              <div className="field-label-row">
                <span className="field-key">Alt Text</span>
                <span className="field-badge">XMP · IPTC</span>
              </div>
              <div className="field-bilingual">
                <div className="field-col-en">
                  <textarea
                    className="field-textarea"
                    rows={2}
                    value={ai.alt_text_en}
                    onChange={(e) => updateAi({ alt_text_en: e.target.value })}
                  />
                </div>
                <div className="field-col-zh">
                  <p className="field-zh-text">{ai.alt_text_zh}</p>
                </div>
              </div>
            </div>

            {/* Caption */}
            <div className="field-row">
              <div className="field-label-row">
                <span className="field-key">Caption</span>
                <span className="field-badge">IPTC Caption</span>
              </div>
              <div className="field-bilingual">
                <div className="field-col-en">
                  <input
                    className="field-input sm"
                    value={ai.caption_en}
                    onChange={(e) => updateAi({ caption_en: e.target.value })}
                  />
                </div>
                <div className="field-col-zh">
                  <p className="field-zh-text">{ai.caption_zh}</p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="field-row">
              <div className="field-label-row">
                <span className="field-key">Tags</span>
                <span className="field-badge">XMP Subject · IPTC Keywords</span>
              </div>
              <div className="field-bilingual">
                <div className="field-col-en">
                  <div className="tags-en-row">
                    {ai.tags_en.map((tag) => (
                      <span key={tag} className="tag-pill-dark">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="field-col-zh">
                  <p className="field-zh-text">{ai.tags_zh.join("、")}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="field-row">
              <div className="field-label-row">
                <span className="field-key">Description</span>
                <span className="field-badge">XMP dc:description</span>
              </div>
              <textarea
                className="field-textarea"
                rows={4}
                value={ai.image_description_en}
                onChange={(e) => updateAi({ image_description_en: e.target.value })}
              />
            </div>
          </div>

          {error ? <div className="meta-error">{error}</div> : null}
        </div>
      </div>
    );
  }

  /* ─── DONE ─── */
  return (
    <div className="done-page fade-up">
      <a href="/" className="nav-logo page-logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#0D0D0D" />
          <path d="M7.5 17.5l4.5-11 4.5 11" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 13.5h5" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        altflow
      </a>
      <div className="done-check">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path
            d="M8 18l7 7 13-13"
            stroke="#0D0D0D"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="done-heading">
        <h2>元数据已写入。</h2>
        <p>您的图片已准备好，SEO 元数据已写入 EXIF / XMP / IPTC。</p>
      </div>

      <div className="done-filename">
        <p className="done-filename-label">下载文件名</p>
        <p className="done-filename-value">{doneFileName}</p>
      </div>

      <div className="done-written">
        <p className="done-written-label">已写入内容</p>
        <div className="done-written-list">
          <div className="done-written-row">
            <span className="done-written-key">EXIF</span>
            <span>Alt text、图片标题、文件名</span>
          </div>
          <div className="done-written-row">
            <span className="done-written-key">IPTC</span>
            <span>Caption、关键词标签</span>
          </div>
          <div className="done-written-row">
            <span className="done-written-key">XMP</span>
            <span>Description、主题标签</span>
          </div>
        </div>
      </div>

      <div className="done-action-row">
        <button type="button" className="btn" onClick={handleEmbedDownload} disabled={embedding}>
          {embedding ? "写入中…" : "再次下载"}
        </button>
        <button type="button" className="btn-ghost" onClick={resetAll}>
          处理下一张图片
        </button>
      </div>

      {error ? <div className="meta-error">{error}</div> : null}
    </div>
  );
}
