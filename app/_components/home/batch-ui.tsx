"use client";

import type { RefObject } from "react";
import { BrandLink } from "@/app/brand-link";
import { buildEmbeddedImageUrl } from "@/lib/embedded-metadata-display";
import { DonePageLayout } from "@/app/_components/home/done-page-layout";
import {
  BATCH_MAX_FILES,
  type BatchItem,
  type BatchStatus,
  type DoneThumb,
} from "@/app/_components/home/types";

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
      <circle cx="8" cy="8" r="6" fill="none" stroke="var(--line-dashed)" strokeWidth="1.5" />
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

export function BatchAnalyzeSplit({
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

export function BatchDonePage({
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

export function BatchPanel({
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
              <rect x="1" y="1" width="54" height="54" rx="14" stroke="var(--line-dashed)" strokeWidth="1.5" strokeDasharray="5 3.5" />
              <path d="M28 38V24" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M21 30l7-7 7 7" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19 41h18" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" opacity="0.18" />
            </svg>
            <div className="drop-zone-text">
              <p className="drop-zone-main">拖拽多张图片到此处</p>
              <p className="drop-zone-sub">
                或 <span>点击浏览文件</span> · Ctrl+V / ⌘V 粘贴（最多 {BATCH_MAX_FILES} 张）
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
