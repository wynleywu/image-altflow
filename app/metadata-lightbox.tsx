"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import type { AiImageResult } from "@/lib/types";
import { getEmbeddedMetadataGroups } from "@/lib/embedded-metadata-display";

export type MetadataLightboxPayload = {
  imageUrl: string;
  fileName: string;
  ai: AiImageResult;
};

export function MetadataLightbox({
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

export function PageFrame({
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
