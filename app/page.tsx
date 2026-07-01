"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import JSZip from "jszip";
import type { AiImageResult, EmbedApiResponse, AnalyzeApiResponse } from "@/lib/types";
import { buildEmbeddedImageUrl, getEmbeddedMetadataGroups } from "@/lib/embedded-metadata-display";
import { runWithConcurrency, withRetry } from "@/lib/concurrency";
import { MetadataHelpFab } from "@/app/metadata-help";

type MetadataLightboxPayload = {
  imageUrl: string;
  fileName: string;
  ai: AiImageResult;
};

type Step = "upload" | "confirm" | "analyzing" | "edit" | "done";

const BATCH_MAX_FILES = 20;
const BATCH_CONCURRENCY = 1;

type BatchStatus = "queued" | "analyzing" | "embedding" | "done" | "error";

interface BatchItem {
  id: string;
  file: File;
  previewUrl: string;
  status: BatchStatus;
  ai?: AiImageResult;
  download?: EmbedApiResponse["download"];
  errorMessage?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function compressImage(file: File, maxBytes = 5 * 1024 * 1024): Promise<File> {
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file);
  const MAX_SIDE = 2048;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let quality = 0.85;
  let blob!: Blob;
  do {
    blob = await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), "image/jpeg", quality)
    );
    quality -= 0.1;
  } while (blob.size > maxBytes && quality >= 0.4);

  canvas.width = 0;
  canvas.height = 0;

  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

function downloadBase64(base64: string, fileName: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  downloadBlob(blob, fileName);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function BrandLink({ className = "page-logo" }: { className?: string }) {
  return (
    <a href="/" className={`nav-logo ${className}`.trim()} aria-label="altflow 首页">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="#0D0D0D" />
        <path d="M7.5 17.5l4.5-11 4.5 11" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 13.5h5" stroke="#C9F178" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      altflow
    </a>
  );
}

function MetadataLightbox({
  imageUrl,
  fileName,
  ai,
  onClose,
}: MetadataLightboxPayload & { onClose: () => void }) {
  const groups = useMemo(() => getEmbeddedMetadataGroups(ai, fileName), [ai, fileName]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="lightbox-scrim"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lightbox-panel" role="dialog" aria-modal="true" aria-labelledby="lightbox-title">
        <button type="button" className="lightbox-close" onClick={onClose} aria-label="关闭">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <div className="lightbox-split">
          <div className="lightbox-media">
            <img src={imageUrl} alt={fileName} className="lightbox-img" />
            <p className="lightbox-filename">{fileName}</p>
          </div>
          <div className="lightbox-meta">
            <h3 id="lightbox-title" className="lightbox-meta-title">已写入元数据</h3>
            {groups.map((group) => (
              <section key={group.name} className="lightbox-meta-group">
                <h4 className="lightbox-meta-group-name">{group.name}</h4>
                <div className="lightbox-meta-fields">
                  {group.fields.map((field) => (
                    <div key={`${group.name}-${field.tag}`} className="lightbox-meta-field">
                      <div className="lightbox-meta-field-head">
                        <span className="field-key">{field.label}</span>
                        <span className="field-badge">{field.tag}</span>
                      </div>
                      <p className="lightbox-meta-value">{field.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PageFrame({
  children,
  lightbox,
  onCloseLightbox,
}: {
  children: ReactNode;
  lightbox: MetadataLightboxPayload | null;
  onCloseLightbox: () => void;
}) {
  return (
    <>
      {children}
      {lightbox ? <MetadataLightbox {...lightbox} onClose={onCloseLightbox} /> : null}
    </>
  );
}

type DoneThumb = {
  id: string;
  imageUrl: string;
  fileName: string;
  onClick: () => void;
};

const DONE_THUMB_MAX = 6;

function DoneCheckIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path
        d="M8 18l7 7 13-13"
        stroke="#0D0D0D"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DonePageLayout({
  thumbs,
  title = "元数据已写入。",
  summary,
  actions,
  error,
}: {
  thumbs: DoneThumb[];
  title?: string;
  summary: string;
  actions: ReactNode;
  error?: string;
}) {
  const visibleThumbs = thumbs.slice(0, DONE_THUMB_MAX);
  const overflow = thumbs.length - DONE_THUMB_MAX;

  return (
    <div className="done-page fade-up">
      <BrandLink />

      <div className="done-check-sm">
        <DoneCheckIcon size={28} />
      </div>

      <div className="done-hero">
        {visibleThumbs.length > 0 ? (
          <div className="done-thumb-row">
            {visibleThumbs.map((thumb) => (
              <button
                key={thumb.id}
                type="button"
                className="done-thumb-btn-inline"
                onClick={thumb.onClick}
                aria-label={`查看 ${thumb.fileName} 的写入详情`}
              >
                <img src={thumb.imageUrl} alt={thumb.fileName} className="done-thumb-img-xs" />
              </button>
            ))}
            {overflow > 0 ? <span className="done-thumb-more">+{overflow}</span> : null}
          </div>
        ) : null}
      </div>

      <h2 className="done-title">{title}</h2>
      <p className="done-summary">{summary}</p>

      <div className="done-actions">{actions}</div>

      {error ? <div className="meta-error">{error}</div> : null}
    </div>
  );
}

function batchStatusLabel(item: BatchItem): string {
  switch (item.status) {
    case "queued":
      return "排队中";
    case "analyzing":
      return "分析中…";
    case "embedding":
      return "写入中…";
    case "done":
      return "完成";
    case "error":
      return item.errorMessage ? `失败：${item.errorMessage}` : "失败";
  }
}

function BatchStatusIcon({ status }: { status: BatchStatus }) {
  if (status === "analyzing" || status === "embedding") {
    return (
      <svg className="analyze-step-spin" width="16" height="16" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6" stroke="#C9F178" strokeWidth="2" fill="none" strokeDasharray="8 5" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "done") {
    return (
      <svg className="batch-check-pop" width="16" height="16" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="7" fill="#16A34A" />
        <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="7" fill="#A33D2D" />
        <path d="M8 4.5v4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.2" r="0.9" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" fill="none" stroke="#D2D2CC" strokeWidth="1.5" />
    </svg>
  );
}

interface BatchThumbGridProps {
  items: BatchItem[];
  processing?: boolean;
  showAddTile?: boolean;
  onAddClick?: () => void;
  onRemoveItem?: (id: string) => void;
  onRetryItem?: (id: string) => void;
  onViewMetadata?: (item: BatchItem) => void;
}

function BatchThumbGrid({
  items,
  processing = false,
  showAddTile = false,
  onAddClick,
  onRemoveItem,
  onRetryItem,
  onViewMetadata,
}: BatchThumbGridProps) {
  return (
    <div className="batch-thumb-grid">
      {items.map((item) => {
        const isActive = item.status === "analyzing" || item.status === "embedding";
        const isViewable = item.status === "done" && item.ai && item.download && onViewMetadata;
        return (
          <div
            key={item.id}
            className={`batch-thumb-card batch-thumb-card-${item.status}${isActive && processing ? " is-active" : ""}${isViewable ? " is-viewable" : ""}`}
            role={isViewable ? "button" : undefined}
            tabIndex={isViewable ? 0 : undefined}
            onClick={isViewable ? () => onViewMetadata(item) : undefined}
            onKeyDown={isViewable ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onViewMetadata(item);
              }
            } : undefined}
            aria-label={isViewable ? `查看 ${item.download!.fileName} 的写入元数据` : undefined}
          >
            <img src={item.previewUrl} alt="" className="batch-thumb-card-img" />
            <span className={`batch-thumb-status batch-thumb-status-${item.status}`} title={batchStatusLabel(item)}>
              <BatchStatusIcon status={item.status} />
              <span className="batch-thumb-status-text">{batchStatusLabel(item)}</span>
            </span>
            {!processing && (item.status === "queued" || item.status === "error") ? (
              <>
                {onRemoveItem ? (
                  <button
                    type="button"
                    className="batch-thumb-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item.id);
                    }}
                    aria-label={`移除 ${item.file.name}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                ) : null}
                {item.status === "error" && onRetryItem ? (
                  <div className="batch-thumb-actions">
                    <button type="button" className="batch-thumb-action-btn" onClick={(e) => {
                      e.stopPropagation();
                      onRetryItem(item.id);
                    }}>
                      重试
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        );
      })}
      {showAddTile && onAddClick ? (
        <button type="button" className="batch-thumb-add" onClick={onAddClick} aria-label="继续添加图片">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <path d="M14 6v16M6 14h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>继续添加</span>
        </button>
      ) : null}
    </div>
  );
}

function BatchAnalyzeSplit({
  items,
  onViewMetadata,
}: {
  items: BatchItem[];
  onViewMetadata?: (item: BatchItem) => void;
}) {
  const doneCount = items.filter((item) => item.status === "done").length;
  const errorCount = items.filter((item) => item.status === "error").length;
  const activeCount = items.filter((item) => item.status === "analyzing" || item.status === "embedding").length;
  const allReceived = items.length > 0;
  const hasActive = activeCount > 0;
  const allFinished = doneCount + errorCount === items.length;

  return (
    <div className="analyze-split fade-up">
      <div className="analyze-left analyze-left-batch">
        <div className="analyze-left-inner analyze-left-inner-batch">
          <BrandLink className="" />
          <BatchThumbGrid items={items} processing onViewMetadata={onViewMetadata} />
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
          <p>AI 模型正在识别产品内容</p>
          <p>生成中英双语 SEO 元数据</p>
        </div>

        <p className="batch-analyze-count">
          已完成 {doneCount} / {items.length}
          {errorCount > 0 ? `，失败 ${errorCount}` : ""}
        </p>

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
            已接收 {items.length} 张图片
          </div>
          <div className={`analyze-step${hasActive ? " is-pending" : allReceived ? "" : " is-pending"}`}>
            {hasActive ? (
              <svg className="analyze-step-spin" width="16" height="16" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="6" stroke="#C9F178" strokeWidth="2" fill="none" strokeDasharray="8 5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="7" fill="#16A34A" />
                <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {hasActive ? `正在处理 ${activeCount} 张…` : "产品内容已识别"}
          </div>
          <div className={`analyze-step${allFinished ? "" : " is-pending"}`}>
            {allFinished ? (
              <svg width="16" height="16" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="7" fill="#16A34A" />
                <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="analyze-step-spin" width="16" height="16" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="6" stroke="#C9F178" strokeWidth="2" fill="none" strokeDasharray="8 5" strokeLinecap="round" />
              </svg>
            )}
            {allFinished ? "元数据写入完成" : "写入元数据中…"}
          </div>
        </div>
      </div>
    </div>
  );
}

function BatchDonePage({
  items,
  zipping,
  onDownloadZip,
  onReset,
  onViewMetadata,
  onRetryFailed,
}: {
  items: BatchItem[];
  zipping: boolean;
  onDownloadZip: () => void;
  onReset: () => void;
  onViewMetadata: (item: BatchItem) => void;
  onRetryFailed: () => void;
}) {
  const doneItems = items.filter((item) => item.status === "done" && item.download && item.ai);
  const errorCount = items.filter((item) => item.status === "error").length;
  const canDownloadZip = doneItems.length > 0;

  const thumbs: DoneThumb[] = doneItems.flatMap((item) => {
    const imageUrl = buildEmbeddedImageUrl(item.download, item.previewUrl);
    if (!imageUrl || !item.ai) return [];
    return [{
      id: item.id,
      imageUrl,
      fileName: item.download!.fileName,
      onClick: () => onViewMetadata(item),
    }];
  });

  const summary = `本批 ${doneItems.length} 张已完成${errorCount > 0 ? ` · ${errorCount} 张失败` : ""}`;

  return (
    <DonePageLayout
      thumbs={thumbs}
      summary={summary}
      actions={(
        <>
          <button type="button" className="btn done-actions-btn" onClick={onDownloadZip} disabled={!canDownloadZip || zipping}>
            {zipping ? "打包中…" : "打包下载 ZIP"}
          </button>
          {errorCount > 0 ? (
            <button type="button" className="btn-ghost done-actions-btn" onClick={onRetryFailed}>
              重试失败项
            </button>
          ) : null}
          <button type="button" className="btn-ghost done-actions-btn" onClick={onReset}>
            处理新一批
          </button>
        </>
      )}
    />
  );
}

interface BatchPanelProps {
  items: BatchItem[];
  dragOver: boolean;
  setDragOver: (value: boolean) => void;
  brand: string;
  model: string;
  setBrand: (value: string) => void;
  setModel: (value: string) => void;
  processing: boolean;
  zipping: boolean;
  error: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onPickFiles: (files: FileList | File[] | null) => void;
  onRemoveItem: (id: string) => void;
  onRetryItem: (id: string) => void;
  onStart: () => void;
  onDownloadZip: () => void;
  onReset: () => void;
  onViewMetadata?: (item: BatchItem) => void;
}

function BatchPanel({
  items,
  dragOver,
  setDragOver,
  brand,
  model,
  setBrand,
  setModel,
  processing,
  zipping,
  error,
  inputRef,
  onPickFiles,
  onRemoveItem,
  onRetryItem,
  onStart,
  onDownloadZip,
  onReset,
  onViewMetadata,
}: BatchPanelProps) {
  const doneCount = items.filter((item) => item.status === "done").length;
  const hasPending = items.some((item) => item.status === "queued" || item.status === "error");
  const canDownloadZip = doneCount > 0;
  const hasItems = items.length > 0;
  const canAddMore = items.length < BATCH_MAX_FILES && !processing;

  return (
    <div
      className={`batch-page${hasItems ? " batch-page-ready" : ""}`}
      onDragOver={hasItems && !processing ? (e) => { e.preventDefault(); setDragOver(true); } : undefined}
      onDragLeave={hasItems && !processing ? () => setDragOver(false) : undefined}
      onDrop={hasItems && !processing ? (e) => {
        e.preventDefault();
        setDragOver(false);
        onPickFiles(e.dataTransfer.files);
      } : undefined}
    >
      <input
        ref={inputRef}
        id="batch-file-input"
        type="file"
        multiple
        className="batch-file-input"
        aria-label="选择要批量上传的产品图片"
        accept="image/jpeg,image/png,image/webp,image/*"
        onChange={(e) => onPickFiles(e.target.files)}
      />

      {!hasItems ? (
        <>
          <h1 className="upload-h1">批量上传产品图片，一次性生成 SEO 元数据。</h1>
          <label
            htmlFor="batch-file-input"
            className={`drop-zone ${dragOver ? "is-dragover" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onPickFiles(e.dataTransfer.files);
            }}
          >
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <rect x="1" y="1" width="54" height="54" rx="14" stroke="#D2D2CC" strokeWidth="1.5" strokeDasharray="5 3.5" />
              <path d="M28 38V24" stroke="#0D0D0D" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M21 30l7-7 7 7" stroke="#0D0D0D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19 41h18" stroke="#0D0D0D" strokeWidth="2.2" strokeLinecap="round" opacity="0.18" />
            </svg>
            <div className="drop-zone-text">
              <p className="drop-zone-main">拖拽多张图片到此处</p>
              <p className="drop-zone-sub">
                或 <span>点击浏览文件</span>（最多 {BATCH_MAX_FILES} 张）
              </p>
            </div>
            <p className="drop-zone-caption">JPEG · PNG · WEBP · RAW · HEIF</p>
          </label>
        </>
      ) : (
        <div className="batch-workspace">
          <header className="batch-workspace-header">
            <h1 className="batch-workspace-title">批量处理</h1>
          </header>

          <div className={`batch-workspace-body${dragOver ? " is-dragover" : ""}`}>
            <section className="batch-gallery-section" aria-label="已选图片">
              <h2 className="batch-gallery-title">图片预览</h2>
              <BatchThumbGrid
                items={items}
                showAddTile={canAddMore}
                onAddClick={() => inputRef.current?.click()}
                onRemoveItem={onRemoveItem}
                onRetryItem={onRetryItem}
                onViewMetadata={onViewMetadata}
              />
            </section>

            <aside className="batch-sidebar">
              <div className="batch-sidebar-card">
                <h3 className="batch-sidebar-heading">批量设置</h3>

                <div className="confirm-fields batch-sidebar-fields">
                  <label className="confirm-field-label confirm-field-label-inline">
                    <input
                      className="confirm-field-input"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="品牌"
                      aria-label="品牌"
                      disabled={processing}
                    />
                  </label>
                  <label className="confirm-field-label confirm-field-label-inline">
                    <input
                      className="confirm-field-input"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="型号"
                      aria-label="型号"
                      disabled={processing}
                    />
                  </label>
                </div>

                <div className="batch-actions batch-actions-stacked">
                  {hasPending ? (
                    <button type="button" className="btn" onClick={onStart} disabled={processing}>
                      开始处理全部
                    </button>
                  ) : (
                    <button type="button" className="btn" disabled={processing}>
                      开始处理全部
                    </button>
                  )}
                  {canDownloadZip ? (
                    <button type="button" className="btn btn-secondary" onClick={onDownloadZip} disabled={zipping || processing}>
                      {zipping ? "打包中…" : "打包下载 ZIP"}
                    </button>
                  ) : null}
                  <button type="button" className="btn-ghost batch-clear-btn" onClick={onReset} disabled={processing || zipping}>
                    清空全部
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {error ? (
        <div className="upload-error">
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function HomePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [tab, setTab] = useState<"single" | "batch">("single");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [wasCompressed, setWasCompressed] = useState(false);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [ai, setAi] = useState<AiImageResult | null>(null);
  const [download, setDownload] = useState<EmbedApiResponse["download"] | null>(null);
  const [doneFileName, setDoneFileName] = useState("");
  const [error, setError] = useState("");
  const [embedding, setEmbedding] = useState(false);

  const batchInputRef = useRef<HTMLInputElement>(null);
  const [batchDragOver, setBatchDragOver] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchBrand, setBatchBrand] = useState("");
  const [batchModel, setBatchModel] = useState("");
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchView, setBatchView] = useState<"ready" | "processing" | "complete">("ready");
  const [batchZipping, setBatchZipping] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [metadataLightbox, setMetadataLightbox] = useState<MetadataLightboxPayload | null>(null);

  const closeMetadataLightbox = () => setMetadataLightbox(null);

  function openBatchItemMetadata(item: BatchItem) {
    if (!item.ai || !item.download) return;
    const imageUrl = buildEmbeddedImageUrl(item.download, item.previewUrl);
    if (!imageUrl) return;
    setMetadataLightbox({
      imageUrl,
      fileName: item.download.fileName,
      ai: item.ai,
    });
  }

  const doneImageUrl = useMemo(
    () => (download ? buildEmbeddedImageUrl(download, previewUrl || undefined) : null),
    [download, previewUrl],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const batchItemsRef = useRef<BatchItem[]>([]);
  batchItemsRef.current = batchItems;
  useEffect(() => {
    return () => {
      batchItemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  useEffect(() => {
    if (batchItems.length === 0 && batchView !== "ready") {
      setBatchView("ready");
    }
  }, [batchItems.length, batchView]);

  const fileMeta = useMemo(() => {
    if (!file) return null;
    return { name: file.name, size: formatSize(file.size) };
  }, [file]);

  function resetAll() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setMetadataLightbox(null);
    setStep("upload");
    setFile(null);
    setPreviewUrl("");
    setAi(null);
    setDownload(null);
    setDoneFileName("");
    setError("");
    setEmbedding(false);
    setWasCompressed(false);
    setBrand("");
    setModel("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function pickFile(next: File | null) {
    if (!next || !next.type.startsWith("image/")) {
      setError("请选择图片文件（JPEG / PNG 推荐）");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const compressed = await compressImage(next);
    setWasCompressed(compressed !== next);
    setFile(compressed);
    setPreviewUrl(URL.createObjectURL(compressed));
    setError("");
    setStep("confirm");
  }

  async function startAnalyze(selected: File) {
    setStep("analyzing");
    setError("");

    try {
      const form = new FormData();
      form.append("image", selected);
      // 用户手填优先：重新分析时以编辑区的实时值为准（含被清空的空串），
      // 首次分析时用确认页输入。不能用 `??`，否则清空字段会被旧值覆盖。
      const effectiveBrand = (ai ? ai.brand : brand)?.trim();
      const effectiveModel = (ai ? ai.model : model)?.trim();
      if (effectiveBrand) form.append("brand", effectiveBrand);
      if (effectiveModel) form.append("model", effectiveModel);

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

      if (!response.ok || !data.ok || !data.ai) {
        const message = data.error || "识图失败";
        if (message.includes("GEMINI_API_KEY")) {
          throw new Error("未配置 GEMINI_API_KEY，请在 .env.local 中设置后重启 dev server");
        }
        throw new Error(message);
      }

      setAi(data.ai);
      setDownload(null);
      setStep("edit");
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "识图失败");
      setStep("upload");
    }
  }

  async function handleEmbedDownload() {
    if (!ai || !file) return;
    setEmbedding(true);
    setError("");

    try {
      const form = new FormData();
      form.append("image", file);
      form.append("ai", JSON.stringify(ai));
      form.append("originalFileName", file.name);

      const response = await fetch("/api/embed", { method: "POST", body: form });
      const data = (await response.json()) as EmbedApiResponse;
      if (!response.ok || !data.ok || !data.download) {
        throw new Error(data.error || "写入失败");
      }

      downloadBase64(data.download.base64, data.download.fileName, data.download.mimeType);
      setDownload(data.download);
      setDoneFileName(data.download.fileName);
      setStep("done");
    } catch (embedError) {
      setError(embedError instanceof Error ? embedError.message : "写入失败");
    } finally {
      setEmbedding(false);
    }
  }

  function redownload() {
    if (!download) return;
    downloadBase64(download.base64, download.fileName, download.mimeType);
  }

  function updateAi(patch: Partial<AiImageResult>) {
    setAi((current) => (current ? { ...current, ...patch } : current));
  }

  function patchBatchItem(id: string, patch: Partial<BatchItem>) {
    setBatchItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function pickBatchFiles(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) {
      setBatchError("请选择图片文件（JPEG / PNG 推荐）");
      return;
    }
    if (batchItems.length + incoming.length > BATCH_MAX_FILES) {
      setBatchError(`单批最多 ${BATCH_MAX_FILES} 张图片`);
      return;
    }
    setBatchError("");
    const newItems: BatchItem[] = [];
    for (const raw of incoming) {
      const compressed = await compressImage(raw);
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file: compressed,
        previewUrl: URL.createObjectURL(compressed),
        status: "queued",
      });
    }
    setBatchItems((current) => [...current, ...newItems]);
  }

  function removeBatchItem(id: string) {
    setBatchItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  function resetBatch() {
    batchItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setBatchItems([]);
    setBatchError("");
    setBatchBrand("");
    setBatchModel("");
    setBatchView("ready");
    if (batchInputRef.current) batchInputRef.current.value = "";
  }

  async function processBatchItem(id: string) {
    const target = batchItemsRef.current.find((item) => item.id === id);
    if (!target) return;

    patchBatchItem(id, { status: "analyzing", errorMessage: undefined });
    try {
      const ai = await withRetry(async () => {
        const form = new FormData();
        form.append("image", target.file);
        if (batchBrand.trim()) form.append("brand", batchBrand.trim());
        if (batchModel.trim()) form.append("model", batchModel.trim());

        const response = await fetch("/api/analyze", { method: "POST", body: form });
        const data = (await response.json()) as AnalyzeApiResponse;
        if (!response.ok || !data.ok || !data.ai) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data.ai;
      });

      patchBatchItem(id, { status: "embedding", ai });

      const download = await withRetry(async () => {
        const form = new FormData();
        form.append("image", target.file);
        form.append("ai", JSON.stringify(ai));
        form.append("originalFileName", target.file.name);

        const response = await fetch("/api/embed", { method: "POST", body: form });
        const data = (await response.json()) as EmbedApiResponse;
        if (!response.ok || !data.ok || !data.download) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data.download;
      });

      patchBatchItem(id, { status: "done", download });
    } catch (batchItemError) {
      patchBatchItem(id, {
        status: "error",
        errorMessage: batchItemError instanceof Error ? batchItemError.message : "处理失败",
      });
    }
  }

  async function startBatchProcessing() {
    const queuedIds = batchItemsRef.current
      .filter((item) => item.status === "queued" || item.status === "error")
      .map((item) => item.id);
    if (queuedIds.length === 0) return;

    setBatchProcessing(true);
    setBatchView("processing");
    try {
      await runWithConcurrency(queuedIds, BATCH_CONCURRENCY, processBatchItem);
    } finally {
      setBatchProcessing(false);
      setBatchView("complete");
    }
  }

  async function downloadBatchZip() {
    const doneItems = batchItemsRef.current.filter((item) => item.status === "done" && item.download);
    if (doneItems.length === 0) return;

    setBatchZipping(true);
    try {
      const zip = new JSZip();
      doneItems.forEach((item) => {
        zip.file(item.download!.fileName, item.download!.base64, { base64: true });
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
      downloadBlob(blob, `altflow-batch-${stamp}.zip`);
    } finally {
      setBatchZipping(false);
    }
  }

  /* ─── UPLOAD ─── */
  if (step === "upload") {
    if (tab === "batch" && batchView === "processing") {
      return (
        <PageFrame lightbox={metadataLightbox} onCloseLightbox={closeMetadataLightbox}>
          <BatchAnalyzeSplit items={batchItems} onViewMetadata={openBatchItemMetadata} />
        </PageFrame>
      );
    }

    if (tab === "batch" && batchView === "complete" && batchItems.length > 0) {
      return (
        <PageFrame lightbox={metadataLightbox} onCloseLightbox={closeMetadataLightbox}>
          <BatchDonePage
            items={batchItems}
            zipping={batchZipping}
            onDownloadZip={downloadBatchZip}
            onReset={resetBatch}
            onViewMetadata={openBatchItemMetadata}
            onRetryFailed={() => setBatchView("ready")}
          />
        </PageFrame>
      );
    }

    return (
      <PageFrame lightbox={metadataLightbox} onCloseLightbox={closeMetadataLightbox}>
      <div className={`upload-page${tab === "batch" && batchItems.length > 0 ? " upload-page-batch-ready" : ""}`}>
        <BrandLink />
        <div className="mode-tabs">
          <button
            type="button"
            className={`mode-tab ${tab === "single" ? "is-active" : ""}`}
            onClick={() => setTab("single")}
          >
            单张图片
          </button>
          <button
            type="button"
            className={`mode-tab ${tab === "batch" ? "is-active" : ""}`}
            onClick={() => setTab("batch")}
          >
            批量处理
          </button>
          <Link href="/amazon" className="mode-tab mode-tab-link">
            Amazon 审查
          </Link>
        </div>

        {tab === "batch" ? (
          <BatchPanel
            items={batchItems}
            dragOver={batchDragOver}
            setDragOver={setBatchDragOver}
            brand={batchBrand}
            model={batchModel}
            setBrand={setBatchBrand}
            setModel={setBatchModel}
            processing={batchProcessing}
            zipping={batchZipping}
            error={batchError}
            inputRef={batchInputRef}
            onPickFiles={pickBatchFiles}
            onRemoveItem={removeBatchItem}
            onRetryItem={processBatchItem}
            onStart={startBatchProcessing}
            onDownloadZip={downloadBatchZip}
            onReset={resetBatch}
            onViewMetadata={openBatchItemMetadata}
          />
        ) : (
          <>
            <h1 className="upload-h1">上传产品图片，获取嵌入式 SEO 元数据。</h1>

            <label
          className={`drop-zone ${dragOver ? "is-dragover" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            aria-label="选择要上传的产品图片"
            accept="image/jpeg,image/png,image/webp,image/*"
            onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
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

        {error ? (
          <div className="upload-error">
            <span>{error}</span>
            {file ? (
              <button type="button" onClick={() => void startAnalyze(file)}>
                重新分析
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="steps-strip">
          <div className="steps-strip-item">
            <p>① 上传</p>
            <p>产品图片</p>
          </div>
          <div className="steps-strip-item">
            <p>② AI 视觉</p>
            <p>双语分析</p>
          </div>
          <div className="steps-strip-item">
            <p>③ 下载</p>
            <p>EXIF · XMP · IPTC</p>
          </div>
        </div>
          </>
        )}
      </div>
      <MetadataHelpFab />
      </PageFrame>
    );
  }

  /* ─── CONFIRM ─── */
  if (step === "confirm" && file) {
    return (
      <PageFrame lightbox={metadataLightbox} onCloseLightbox={closeMetadataLightbox}>
      <div className="upload-page fade-up">
        <BrandLink />

        <div className="confirm-preview-wrap">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={fileMeta?.name ? `产品预览：${fileMeta.name}` : "已上传的产品图片预览"}
              className="confirm-preview-img"
            />
          ) : null}
        </div>

        <div className="confirm-meta">
          <p className="confirm-filename">{fileMeta?.name}</p>
          <p className="confirm-filesize">{fileMeta?.size}</p>
          {wasCompressed ? (
            <p className="confirm-compressed">图片已自动压缩至 {fileMeta?.size}</p>
          ) : null}
        </div>

        <div className="confirm-fields">
          <label className="confirm-field-label confirm-field-label-inline">
            <input
              className="confirm-field-input"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="品牌"
              aria-label="品牌"
            />
          </label>
          <label className="confirm-field-label confirm-field-label-inline">
            <input
              className="confirm-field-input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="型号"
              aria-label="型号"
            />
          </label>
        </div>

        {error ? <div className="upload-error"><span>{error}</span></div> : null}

        <div className="confirm-actions">
          <button type="button" className="btn-ghost" onClick={resetAll}>
            ← 重新选择
          </button>
          <button type="button" className="btn" onClick={() => void startAnalyze(file)}>
            开始分析
          </button>
        </div>
      </div>
      </PageFrame>
    );
  }

  /* ─── ANALYZING ─── */
  if (step === "analyzing") {
    return (
      <PageFrame lightbox={metadataLightbox} onCloseLightbox={closeMetadataLightbox}>
      <div className="analyze-split fade-up">
        <div className="analyze-left">
          <div className="analyze-left-inner">
            <BrandLink className="" />
            <div className="analyze-preview">
              {previewUrl ? (
                <img src={previewUrl} alt={fileMeta?.name ? `产品预览：${fileMeta.name}` : "已上传的产品图片预览"} />
              ) : null}
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
      </PageFrame>
    );
  }

  /* ─── EDIT ─── */
  if (step === "edit" && ai) {
    return (
      <PageFrame lightbox={metadataLightbox} onCloseLightbox={closeMetadataLightbox}>
      <div className="meta-split fade-up">
        <aside className="meta-sidebar">
          <BrandLink className="sidebar-logo" />
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
              {file ? (
                <button type="button" className="btn-ghost" onClick={() => void startAnalyze(file)}>
                  重新分析
                </button>
              ) : null}
              <button type="button" className="btn-ghost" onClick={resetAll}>
                ← 重新选择
              </button>
              <button type="button" className="btn" onClick={handleEmbedDownload} disabled={embedding}>
                {embedding ? "写入中…" : "写入并下载"}
              </button>
            </div>
          </div>

          <div className="fields-card">
            {/* Brand / Model */}
            <div className="field-row">
              <div className="field-label-row">
                <span className="field-key">品牌 / 型号</span>
                <span className="field-badge">IPTC · XMP</span>
              </div>
              <div className="field-pair">
                <input
                  className="field-input sm"
                  value={ai.brand ?? ""}
                  onChange={(e) => updateAi({ brand: e.target.value })}
                  placeholder="品牌"
                />
                <input
                  className="field-input sm"
                  value={ai.model ?? ""}
                  onChange={(e) => updateAi({ model: e.target.value })}
                  placeholder="型号"
                />
              </div>
            </div>

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
      </PageFrame>
    );
  }

  /* ─── DONE ─── */
  const singleDoneThumbs: DoneThumb[] =
    doneImageUrl && ai
      ? [{
          id: "single-done",
          imageUrl: doneImageUrl,
          fileName: doneFileName,
          onClick: () => setMetadataLightbox({ imageUrl: doneImageUrl, fileName: doneFileName, ai }),
        }]
      : [];

  return (
    <PageFrame lightbox={metadataLightbox} onCloseLightbox={closeMetadataLightbox}>
      <DonePageLayout
        thumbs={singleDoneThumbs}
        summary={doneFileName}
        error={error || undefined}
        actions={(
          <>
            <button type="button" className="btn done-actions-btn" onClick={redownload} disabled={!download}>
              再次下载
            </button>
            <button type="button" className="btn-ghost done-actions-btn" onClick={resetAll}>
              处理下一张图片
            </button>
          </>
        )}
      />
    </PageFrame>
  );
}
