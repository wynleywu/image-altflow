import { normalizeStoredAuditResult } from "./normalize-audit";
import type {
  AmazonAuditDraft,
  AmazonAuditEditableSection,
  AmazonAuditWorkspace,
  AmazonListingSnapshot,
  ListingAuditResult,
} from "./types";

const PREFIX = "amazon_audit_workspace:v1:";
const INDEX_KEY = "amazon_audit_workspace_index:v1";
const MAX_WORKSPACES = 10;

interface WorkspaceIndexItem {
  auditId: string;
  updatedAt: number;
}

function storageKey(auditId: string): string {
  return `${PREFIX}${auditId}`;
}

function initialDraft(audit: ListingAuditResult): AmazonAuditDraft {
  return {
    title: audit.title.suggested,
    itemHighlights: audit.itemHighlights.suggested,
    bullets: [...audit.bullets.suggested],
    searchTerms: audit.searchTerms.suggested,
  };
}

export function createAuditWorkspace(
  auditId: string,
  snapshot: AmazonListingSnapshot,
  auditInput: ListingAuditResult,
): AmazonAuditWorkspace {
  const now = Date.now();
  const audit = normalizeStoredAuditResult(auditInput, snapshot);
  return {
    version: 1,
    auditId,
    snapshot,
    audit,
    draft: initialDraft(audit),
    accepted: { title: false, highlights: false, bullets: false, searchTerms: false },
    createdAt: now,
    updatedAt: now,
  };
}

function readIndex(): WorkspaceIndexItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is WorkspaceIndexItem =>
      Boolean(item && typeof item.auditId === "string" && Number.isFinite(item.updatedAt)),
    );
  } catch {
    return [];
  }
}

function writeIndex(items: WorkspaceIndexItem[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(items));
}

export function saveAuditWorkspace(workspace: AmazonAuditWorkspace): AmazonAuditWorkspace {
  const existingIndex = readIndex();
  const latestStoredAt = existingIndex.reduce((latest, item) => Math.max(latest, item.updatedAt), 0);
  const saved = { ...workspace, updatedAt: Math.max(Date.now(), workspace.updatedAt + 1, latestStoredAt + 1) };
  localStorage.setItem(storageKey(saved.auditId), JSON.stringify(saved));

  const index = existingIndex
    .filter((item) => item.auditId !== saved.auditId)
    .concat({ auditId: saved.auditId, updatedAt: saved.updatedAt })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const keep = index.slice(0, MAX_WORKSPACES);
  for (const stale of index.slice(MAX_WORKSPACES)) localStorage.removeItem(storageKey(stale.auditId));
  writeIndex(keep);
  return saved;
}

export function loadAuditWorkspace(auditId: string): AmazonAuditWorkspace | null {
  try {
    const raw = localStorage.getItem(storageKey(auditId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AmazonAuditWorkspace>;
    if (parsed.version !== 1 || parsed.auditId !== auditId || !parsed.snapshot || !parsed.audit) return null;

    const audit = normalizeStoredAuditResult(parsed.audit, parsed.snapshot);
    const fallbackDraft = initialDraft(audit);
    const accepted = parsed.accepted ?? {} as Record<AmazonAuditEditableSection, boolean>;
    return {
      version: 1,
      auditId,
      snapshot: parsed.snapshot,
      audit,
      draft: {
        title: String(parsed.draft?.title ?? fallbackDraft.title),
        itemHighlights: String(parsed.draft?.itemHighlights ?? fallbackDraft.itemHighlights),
        bullets: Array.isArray(parsed.draft?.bullets) ? parsed.draft.bullets.map(String).slice(0, 5) : fallbackDraft.bullets,
        searchTerms: String(parsed.draft?.searchTerms ?? fallbackDraft.searchTerms),
      },
      accepted: {
        title: Boolean(accepted.title),
        highlights: Boolean(accepted.highlights),
        bullets: Boolean(accepted.bullets),
        searchTerms: Boolean(accepted.searchTerms),
      },
      createdAt: Number(parsed.createdAt) || Date.now(),
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function migrateLegacyWorkspace(auditId: string): AmazonAuditWorkspace | null {
  try {
    const raw = sessionStorage.getItem("amazon_audit_result");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { snapshot?: AmazonListingSnapshot; audit?: ListingAuditResult };
    if (!parsed.snapshot || !parsed.audit) return null;
    const workspace = saveAuditWorkspace(createAuditWorkspace(auditId, parsed.snapshot, parsed.audit));
    sessionStorage.removeItem("amazon_audit_result");
    return workspace;
  } catch {
    return null;
  }
}
