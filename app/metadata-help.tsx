"use client";

import { useEffect, useState } from "react";
import { METADATA_GLOSSARY, METADATA_STANDARDS } from "@/lib/metadata-glossary";

function MetadataHelpDialog({ onClose }: { onClose: () => void }) {
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
      <div
        className="help-dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="metadata-help-title"
      >
        <button type="button" className="lightbox-close" onClick={onClose} aria-label="关闭">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <div className="help-dialog-body">
          <h2 id="metadata-help-title" className="help-dialog-title">
            元数据参数说明
          </h2>
          <p className="help-dialog-intro">
            本应用将 AI 生成的英文字段写入图片 EXIF、IPTC、XMP，下载后可直接用于 SEO 与图库管理。
          </p>

          <section className="help-dialog-section">
            <h3 className="help-dialog-section-title">标准简介</h3>
            <ul className="help-standards-list">
              {METADATA_STANDARDS.map((item) => (
                <li key={item.name} className="help-standard-row">
                  <span className="help-standard-name">{item.name}</span>
                  <span className="help-standard-summary">{item.summary}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="help-dialog-section">
            <h3 className="help-dialog-section-title">字段说明</h3>
            <div className="help-glossary-list">
              {METADATA_GLOSSARY.map((entry) => (
                <div key={entry.key} className="help-glossary-row">
                  <div className="help-glossary-head">
                    <span className="field-key">{entry.key}</span>
                    <span className="field-badge help-glossary-tags">{entry.tags}</span>
                  </div>
                  <p className="help-glossary-desc">{entry.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function MetadataHelpFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="help-fab"
        onClick={() => setOpen(true)}
        aria-label="元数据参数说明"
        aria-expanded={open}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="9.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M8.5 8.25a2.75 2.75 0 0 1 5.07 1.37c0 1.88-2.57 2.13-2.57 3.88"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="11" cy="16.25" r="0.9" fill="currentColor" />
        </svg>
      </button>
      {open ? <MetadataHelpDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
