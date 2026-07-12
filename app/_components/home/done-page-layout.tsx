import type { ReactNode } from "react";
import { BrandLink } from "@/app/brand-link";
import { DoneCheckIcon } from "@/app/_components/home/icons";
import type { DoneThumb } from "@/app/_components/home/types";

const DONE_THUMB_MAX = 6;

export function DonePageLayout({
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
      <BrandLink className="page-logo" />

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
