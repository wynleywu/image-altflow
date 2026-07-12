"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import type { AiImageResult, EmbedApiResponse, AnalyzeApiResponse } from "@/lib/types";
import { buildEmbeddedImageUrl } from "@/lib/embedded-metadata-display";
import { runWithConcurrency, withRetry } from "@/lib/concurrency";
import type { MetadataLightboxPayload } from "@/app/metadata-lightbox";
import { formatAnalyzeErrorMessage, formatEmbedErrorMessage } from "@/lib/analyze-error-message";
import {
  BATCH_CONCURRENCY,
  BATCH_MAX_FILES,
  type BatchItem,
  type DoneThumb,
  type Mode,
  type Step,
} from "@/app/_components/home/types";
import {
  compressImage,
  downloadBase64,
  downloadBlob,
  filesFromClipboard,
  formatSize,
  isEditablePasteTarget,
  makeThumbnailDataUrl,
  saveLocalHistory,
} from "@/app/_components/home/utils";

export function useHomeWorkflow() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [mode, setMode] = useState<Mode>("idle");
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
    setMode("idle");
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

  async function pickFiles(files: FileList | File[] | null) {
    const images = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      setError("请选择图片文件（JPEG / PNG 推荐）");
      return;
    }
    if (images.length === 1) {
      setMode("single");
      await pickFile(images[0]);
    } else {
      setMode("batch");
      await pickBatchFiles(images);
      setBatchView("ready");
    }
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
      const thumbnailPromise = makeThumbnailDataUrl(selected).catch(() => "");

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
        throw new Error(formatAnalyzeErrorMessage(data.error, data.error_type));
      }

      setAi(data.ai);
      setDownload(null);
      setStep("edit");
      void thumbnailPromise.then((thumbnail) => saveLocalHistory(data.ai!, selected.name, thumbnail));
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "识图失败");
      setStep("upload");
    }
  }

  async function handleEmbedProceed() {
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
        throw new Error(formatEmbedErrorMessage(data.error, data.error_type));
      }

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

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (isEditablePasteTarget(event.target)) return;

      const onIdleUpload = mode === "idle" && step === "upload";
      const onBatchUpload =
        mode === "batch"
        && !batchProcessing
        && !batchZipping
        && batchView !== "complete"
        && batchItems.length < BATCH_MAX_FILES;
      if (!onIdleUpload && !onBatchUpload) return;

      const images = filesFromClipboard(event);
      if (images.length === 0) return;

      event.preventDefault();
      if (onBatchUpload) {
        void pickBatchFiles(images);
        return;
      }
      void pickFiles(images);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

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
    setMode("idle");
  }

  async function processBatchItem(id: string) {
    const target = batchItemsRef.current.find((item) => item.id === id);
    if (!target) return;

    patchBatchItem(id, { status: "analyzing", errorMessage: undefined });
    const thumbnailPromise = makeThumbnailDataUrl(target.file).catch(() => "");
    try {
      const analyzed = await withRetry(async () => {
        const form = new FormData();
        form.append("image", target.file);
        if (batchBrand.trim()) form.append("brand", batchBrand.trim());
        if (batchModel.trim()) form.append("model", batchModel.trim());

        const response = await fetch("/api/analyze", { method: "POST", body: form });
        const data = (await response.json()) as AnalyzeApiResponse;
        if (!response.ok || !data.ok || !data.ai) {
          throw new Error(formatAnalyzeErrorMessage(data.error, data.error_type));
        }
        return data.ai;
      });

      patchBatchItem(id, { status: "embedding", ai: analyzed });
      void thumbnailPromise.then((thumbnail) => saveLocalHistory(analyzed, target.file.name, thumbnail));

      const nextDownload = await withRetry(async () => {
        const form = new FormData();
        form.append("image", target.file);
        form.append("ai", JSON.stringify(analyzed));
        form.append("originalFileName", target.file.name);

        const response = await fetch("/api/embed", { method: "POST", body: form });
        const data = (await response.json()) as EmbedApiResponse;
        if (!response.ok || !data.ok || !data.download) {
          throw new Error(formatEmbedErrorMessage(data.error, data.error_type));
        }
        return data.download;
      });

      patchBatchItem(id, { status: "done", download: nextDownload });
    } catch (batchItemError) {
      patchBatchItem(id, {
        status: "error",
        errorMessage: batchItemError instanceof Error
          ? batchItemError.message
          : "处理失败，请稍后重试",
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
      const usedNames = new Set<string>();
      doneItems.forEach((item) => {
        const original = item.download!.fileName;
        const dot = original.lastIndexOf(".");
        const stem = dot > 0 ? original.slice(0, dot) : original;
        const ext = dot > 0 ? original.slice(dot) : "";
        let unique = original;
        let suffix = 2;
        while (usedNames.has(unique.toLowerCase())) {
          unique = `${stem}-${suffix}${ext}`;
          suffix += 1;
        }
        usedNames.add(unique.toLowerCase());
        zip.file(unique, item.download!.base64, { base64: true });
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
      downloadBlob(blob, `altflow-batch-${stamp}.zip`);
    } finally {
      setBatchZipping(false);
    }
  }

  const singleDoneThumbs: DoneThumb[] =
    doneImageUrl && ai
      ? [{
          id: "single-done",
          imageUrl: doneImageUrl,
          fileName: doneFileName,
          onClick: () => setMetadataLightbox({ imageUrl: doneImageUrl, fileName: doneFileName, ai }),
        }]
      : [];

  return {
    inputRef,
    step,
    mode,
    dragOver,
    setDragOver,
    file,
    wasCompressed,
    brand,
    setBrand,
    model,
    setModel,
    previewUrl,
    ai,
    download,
    doneFileName,
    error,
    embedding,
    batchInputRef,
    batchDragOver,
    setBatchDragOver,
    batchItems,
    batchBrand,
    setBatchBrand,
    batchModel,
    setBatchModel,
    batchProcessing,
    batchView,
    setBatchView,
    batchZipping,
    batchError,
    metadataLightbox,
    closeMetadataLightbox,
    openBatchItemMetadata,
    fileMeta,
    resetAll,
    pickFiles,
    startAnalyze,
    handleEmbedProceed,
    redownload,
    updateAi,
    pickBatchFiles,
    removeBatchItem,
    resetBatch,
    processBatchItem,
    startBatchProcessing,
    downloadBatchZip,
    singleDoneThumbs,
  };
}
