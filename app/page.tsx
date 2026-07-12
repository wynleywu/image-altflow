"use client";

import Link from "next/link";
import { MetadataHelpFab } from "@/app/metadata-help";
import { PageFrame } from "@/app/metadata-lightbox";
import { BrandLink } from "@/app/brand-link";
import {
  BatchAnalyzeSplit,
  BatchDonePage,
  BatchPanel,
} from "@/app/_components/home/batch-ui";
import {
  SingleAnalyzingStep,
  SingleConfirmStep,
  SingleDoneStep,
  SingleEditStep,
} from "@/app/_components/home/single-flow";
import { BATCH_MAX_FILES } from "@/app/_components/home/types";
import { useHomeWorkflow } from "@/app/_components/home/use-home-workflow";

export default function HomePage() {
  const w = useHomeWorkflow();

  /* ─── UPLOAD ─── */
  if (w.step === "upload") {
    if (w.mode === "batch" && w.batchView === "processing") {
      return (
        <PageFrame lightbox={w.metadataLightbox} onCloseLightbox={w.closeMetadataLightbox}>
          <BatchAnalyzeSplit items={w.batchItems} onViewMetadata={w.openBatchItemMetadata} />
        </PageFrame>
      );
    }

    if (w.mode === "batch" && w.batchView === "complete" && w.batchItems.length > 0) {
      return (
        <PageFrame lightbox={w.metadataLightbox} onCloseLightbox={w.closeMetadataLightbox}>
          <BatchDonePage
            items={w.batchItems}
            zipping={w.batchZipping}
            onDownloadZip={w.downloadBatchZip}
            onReset={w.resetBatch}
            onViewMetadata={w.openBatchItemMetadata}
            onRetryFailed={() => w.setBatchView("ready")}
          />
        </PageFrame>
      );
    }

    return (
      <PageFrame lightbox={w.metadataLightbox} onCloseLightbox={w.closeMetadataLightbox}>
        <div className={`upload-page upload-page-amazon${w.mode === "batch" && w.batchItems.length > 0 ? " upload-page-batch-ready" : ""}`}>
          <BrandLink className="page-logo" />
          <div className="mode-tabs">
            <span className="mode-tab is-active">图片 SEO</span>
            <Link href="/amazon" className="mode-tab mode-tab-link">
              Amazon 审查
            </Link>
          </div>

          {w.mode === "batch" && w.batchItems.length > 0 ? (
            <BatchPanel
              items={w.batchItems}
              dragOver={w.batchDragOver}
              setDragOver={w.setBatchDragOver}
              brand={w.batchBrand}
              model={w.batchModel}
              setBrand={w.setBatchBrand}
              setModel={w.setBatchModel}
              processing={w.batchProcessing}
              zipping={w.batchZipping}
              error={w.batchError}
              inputRef={w.batchInputRef}
              onPickFiles={w.pickBatchFiles}
              onRemoveItem={w.removeBatchItem}
              onRetryItem={(id) => {
                if (w.batchProcessing) return;
                void w.processBatchItem(id);
              }}
              onStart={w.startBatchProcessing}
              onDownloadZip={w.downloadBatchZip}
              onReset={w.resetBatch}
              onViewMetadata={w.openBatchItemMetadata}
            />
          ) : (
            <>
              <h1 className="upload-h1">上传产品图片，获取嵌入式 SEO 元数据。</h1>

              <label
                className={`drop-zone ${w.dragOver ? "is-dragover" : ""}`}
                onDragOver={(e) => { e.preventDefault(); w.setDragOver(true); }}
                onDragLeave={() => w.setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  w.setDragOver(false);
                  void w.pickFiles(e.dataTransfer.files);
                }}
              >
                <input
                  ref={w.inputRef}
                  type="file"
                  multiple
                  aria-label="选择一张或多张产品图片"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  onChange={(e) => void w.pickFiles(e.target.files)}
                />
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  <rect x="1" y="1" width="54" height="54" rx="14" stroke="var(--line-dashed)" strokeWidth="1.5" strokeDasharray="5 3.5" />
                  <path d="M28 38V24" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
                  <path d="M21 30l7-7 7 7" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M19 41h18" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" opacity="0.18" />
                </svg>
                <div className="drop-zone-text">
                  <p className="drop-zone-main">拖拽图片到此处</p>
                  <p className="drop-zone-sub">
                    或 <span>点击浏览文件</span> · Ctrl+V / ⌘V 粘贴
                  </p>
                </div>
                <p className="drop-zone-caption">JPEG · PNG · WEBP · RAW · HEIF · 最多 {BATCH_MAX_FILES} 张</p>
              </label>

              {w.error ? (
                <div className="upload-error">
                  <span>{w.error}</span>
                  {w.file ? (
                    <button type="button" onClick={() => void w.startAnalyze(w.file!)}>
                      重新分析
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="steps-strip">
                <div className="steps-strip-item">
                  <p>① 上传</p>
                  <p>1–{BATCH_MAX_FILES} 张图片</p>
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
  if (w.step === "confirm" && w.file) {
    return (
      <PageFrame lightbox={w.metadataLightbox} onCloseLightbox={w.closeMetadataLightbox}>
        <SingleConfirmStep
          previewUrl={w.previewUrl}
          fileName={w.fileMeta?.name}
          fileSize={w.fileMeta?.size}
          wasCompressed={w.wasCompressed}
          brand={w.brand}
          model={w.model}
          error={w.error}
          onBrandChange={w.setBrand}
          onModelChange={w.setModel}
          onReset={w.resetAll}
          onAnalyze={() => void w.startAnalyze(w.file!)}
        />
      </PageFrame>
    );
  }

  /* ─── ANALYZING ─── */
  if (w.step === "analyzing") {
    return (
      <PageFrame lightbox={w.metadataLightbox} onCloseLightbox={w.closeMetadataLightbox}>
        <SingleAnalyzingStep
          previewUrl={w.previewUrl}
          fileName={w.fileMeta?.name}
          fileSize={w.fileMeta?.size}
        />
      </PageFrame>
    );
  }

  /* ─── EDIT ─── */
  if (w.step === "edit" && w.ai) {
    return (
      <PageFrame lightbox={w.metadataLightbox} onCloseLightbox={w.closeMetadataLightbox}>
        <SingleEditStep
          ai={w.ai}
          previewUrl={w.previewUrl}
          fileName={w.fileMeta?.name}
          fileSize={w.fileMeta?.size}
          embedding={w.embedding}
          error={w.error}
          canReanalyze={Boolean(w.file)}
          onUpdateAi={w.updateAi}
          onReanalyze={() => {
            if (w.file) void w.startAnalyze(w.file);
          }}
          onReset={w.resetAll}
          onEmbed={() => void w.handleEmbedProceed()}
        />
      </PageFrame>
    );
  }

  /* ─── DONE ─── */
  return (
    <PageFrame lightbox={w.metadataLightbox} onCloseLightbox={w.closeMetadataLightbox}>
      <SingleDoneStep
        thumbs={w.singleDoneThumbs}
        summary={w.doneFileName}
        error={w.error || undefined}
        canDownload={Boolean(w.download)}
        onDownload={w.redownload}
        onReset={w.resetAll}
      />
    </PageFrame>
  );
}
