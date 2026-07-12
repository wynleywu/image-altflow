"use client";

import type { AiImageResult } from "@/lib/types";
import { BrandLink } from "@/app/brand-link";
import { RotateCwIcon } from "@/app/_components/home/icons";
import { DonePageLayout } from "@/app/_components/home/done-page-layout";
import type { DoneThumb } from "@/app/_components/home/types";

export function SingleConfirmStep({
  previewUrl,
  fileName,
  fileSize,
  wasCompressed,
  brand,
  model,
  error,
  onBrandChange,
  onModelChange,
  onReset,
  onAnalyze,
}: {
  previewUrl: string;
  fileName?: string;
  fileSize?: string;
  wasCompressed: boolean;
  brand: string;
  model: string;
  error: string;
  onBrandChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onReset: () => void;
  onAnalyze: () => void;
}) {
  return (
    <div className="upload-page fade-up">
      <BrandLink className="page-logo" />

      <div className="confirm-preview-wrap">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={fileName ? `产品预览：${fileName}` : "已上传的产品图片预览"}
            className="confirm-preview-img"
          />
        ) : null}
      </div>

      <div className="confirm-meta">
        <p className="confirm-filename">{fileName}</p>
        <p className="confirm-filesize">{fileSize}</p>
        {wasCompressed ? (
          <p className="confirm-compressed">图片已自动压缩至 {fileSize}</p>
        ) : null}
      </div>

      <div className="confirm-fields">
        <label className="confirm-field-label confirm-field-label-inline">
          <input
            className="confirm-field-input"
            value={brand}
            onChange={(e) => onBrandChange(e.target.value)}
            placeholder="品牌"
            aria-label="品牌"
          />
        </label>
        <label className="confirm-field-label confirm-field-label-inline">
          <input
            className="confirm-field-input"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder="型号"
            aria-label="型号"
          />
        </label>
      </div>

      {error ? <div className="upload-error"><span>{error}</span></div> : null}

      <div className="confirm-actions">
        <button type="button" className="btn-ghost" onClick={onReset}>
          ← 重新选择
        </button>
        <button type="button" className="btn" onClick={onAnalyze}>
          开始分析
        </button>
      </div>
    </div>
  );
}

export function SingleAnalyzingStep({
  previewUrl,
  fileName,
  fileSize,
}: {
  previewUrl: string;
  fileName?: string;
  fileSize?: string;
}) {
  return (
    <div className="analyze-split fade-up">
      <div className="analyze-left">
        <div className="analyze-left-inner">
          <BrandLink className="" />
          <div className="analyze-preview">
            {previewUrl ? (
              <img src={previewUrl} alt={fileName ? `产品预览：${fileName}` : "已上传的产品图片预览"} />
            ) : null}
          </div>
          <div className="analyze-file-meta">
            <span className="analyze-file-name">{fileName}</span>
            <span className="analyze-file-size">{fileSize}</span>
          </div>
        </div>
      </div>

      <div className="analyze-right">
        <div className="spin-ring-wrap">
          <svg className="spin-ring-track" width="60" height="60" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="25" stroke="var(--track)" strokeWidth="3.5" fill="none" />
          </svg>
          <svg className="spin-ring-arc" width="60" height="60" viewBox="0 0 60 60">
            <path d="M30 5a25 25 0 0 1 25 25" stroke="#C9F178" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          </svg>
        </div>

        <div className="analyze-heading">
          <h2>分析中…</h2>
          <p>AI 模型正在识别产品内容</p>
          <p>生成中英双语 SEO 元数据</p>
        </div>

        <div className="dot-bounce-row">
          <span className="dot-bounce" />
          <span className="dot-bounce" />
          <span className="dot-bounce" />
        </div>

        <div className="analyze-steps-box">
          <p className="analyze-steps-label">处理步骤</p>
          <div className="analyze-step">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="7" fill="#16A34A" />
              <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            已接收图片
          </div>
          <div className="analyze-step">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="7" fill="#16A34A" />
              <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            产品类型已识别
          </div>
          <div className="analyze-step is-pending">
            <svg
              className="analyze-step-spin"
              width="16"
              height="16"
              viewBox="0 0 16 16"
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

export function SingleEditStep({
  ai,
  previewUrl,
  fileName,
  fileSize,
  embedding,
  error,
  canReanalyze,
  onUpdateAi,
  onReanalyze,
  onReset,
  onEmbed,
}: {
  ai: AiImageResult;
  previewUrl: string;
  fileName?: string;
  fileSize?: string;
  embedding: boolean;
  error: string;
  canReanalyze: boolean;
  onUpdateAi: (patch: Partial<AiImageResult>) => void;
  onReanalyze: () => void;
  onReset: () => void;
  onEmbed: () => void;
}) {
  return (
    <div className="meta-split fade-up">
      <aside className="meta-sidebar">
        <BrandLink className="sidebar-logo" />
        <div className="sidebar-preview">
          {previewUrl ? <img src={previewUrl} alt="" /> : null}
        </div>
        <div className="sidebar-info">
          <div>
            <p className="sidebar-info-label">原始文件</p>
            <p className="sidebar-info-value">{fileName}</p>
          </div>
          <div>
            <p className="sidebar-info-label">文件大小</p>
            <p className="sidebar-info-value is-muted">{fileSize}</p>
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
            {canReanalyze ? (
              <button
                type="button"
                className="btn-icon"
                onClick={onReanalyze}
                aria-label="重新分析"
                title="重新分析"
              >
                <RotateCwIcon />
              </button>
            ) : null}
            <button type="button" className="btn-ghost" onClick={onReset}>
              ← 重新选择
            </button>
            <button type="button" className="btn" onClick={onEmbed} disabled={embedding}>
              {embedding ? "写入中…" : "写入并继续"}
            </button>
          </div>
        </div>

        <div className="fields-card">
          <div className="field-row">
            <div className="field-label-row">
              <span className="field-key">品牌 / 型号</span>
              <span className="field-badge">仅 Prompt 上下文</span>
            </div>
            <div className="field-pair">
              <input
                className="field-input sm"
                value={ai.brand ?? ""}
                onChange={(e) => onUpdateAi({ brand: e.target.value })}
                placeholder="品牌"
              />
              <input
                className="field-input sm"
                value={ai.model ?? ""}
                onChange={(e) => onUpdateAi({ model: e.target.value })}
                placeholder="型号"
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field-label-row">
              <span className="field-key">文件名</span>
              <span className="field-badge">下载 File Name</span>
            </div>
            <input
              className="field-input"
              value={ai.new_file_name}
              onChange={(e) => onUpdateAi({ new_file_name: e.target.value })}
            />
          </div>

          <div className="field-row">
            <div className="field-label-row">
              <span className="field-key">Alt Text</span>
              <span className="field-badge">XMP AltTextAccessibility</span>
            </div>
            <div className="field-bilingual">
              <div className="field-col-en">
                <textarea
                  className="field-textarea"
                  rows={2}
                  value={ai.alt_text_en}
                  onChange={(e) => onUpdateAi({ alt_text_en: e.target.value })}
                />
              </div>
              <div className="field-col-zh">
                <p className="field-zh-text">{ai.alt_text_zh}</p>
              </div>
            </div>
          </div>

          <div className="field-row">
            <div className="field-label-row">
              <span className="field-key">Headline</span>
              <span className="field-badge">IPTC:Headline · XMP photoshop:Headline</span>
            </div>
            <div className="field-bilingual">
              <div className="field-col-en">
                <input
                  className="field-input sm"
                  value={ai.caption_en}
                  onChange={(e) => onUpdateAi({ caption_en: e.target.value })}
                  placeholder="一句话摘要"
                />
              </div>
              <div className="field-col-zh">
                <p className="field-zh-text">{ai.caption_zh}</p>
              </div>
            </div>
          </div>

          <div className="field-row">
            <div className="field-label-row">
              <span className="field-key">Keywords</span>
              <span className="field-badge">IPTC Keywords · XMP dc:subject</span>
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

          <div className="field-row">
            <div className="field-label-row">
              <span className="field-key">Description</span>
              <span className="field-badge">IPTC Caption · EXIF · XMP dc:description</span>
            </div>
            <textarea
              className="field-textarea"
              rows={4}
              value={ai.image_description_en}
              onChange={(e) => onUpdateAi({ image_description_en: e.target.value })}
            />
          </div>
        </div>

        {error ? <div className="meta-error">{error}</div> : null}
      </div>
    </div>
  );
}

export function SingleDoneStep({
  thumbs,
  summary,
  error,
  canDownload,
  onDownload,
  onReset,
}: {
  thumbs: DoneThumb[];
  summary: string;
  error?: string;
  canDownload: boolean;
  onDownload: () => void;
  onReset: () => void;
}) {
  return (
    <DonePageLayout
      thumbs={thumbs}
      summary={summary}
      error={error}
      actions={(
        <>
          <button type="button" className="btn done-actions-btn" onClick={onDownload} disabled={!canDownload}>
            下载
          </button>
          <button type="button" className="btn-ghost done-actions-btn" onClick={onReset}>
            处理下一张图片
          </button>
        </>
      )}
    />
  );
}
