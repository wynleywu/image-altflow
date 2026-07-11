import type { AiImageResult, ImageRecord, ReviewStatus } from "@/lib/types";

const DB_NAME = "altflow-history";
const STORE_NAME = "records";
const DB_VERSION = 1;
const MAX_RECORDS = 200;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "recordId" });
          store.createIndex("createdAt", "createdAt");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function getAllRecords(db: IDBDatabase): Promise<ImageRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as ImageRecord[]);
    req.onerror = () => reject(req.error);
  });
}

async function trimOverflow(db: IDBDatabase): Promise<void> {
  const count = await new Promise<number>((resolve, reject) => {
    const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const overflow = count - MAX_RECORDS;
  if (overflow <= 0) return;

  await new Promise<void>((resolve, reject) => {
    const store = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
    const cursorReq = store.index("createdAt").openCursor();
    let deleted = 0;
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor || deleted >= overflow) {
        resolve();
        return;
      }
      cursor.delete();
      deleted += 1;
      cursor.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function addLocalHistoryRecord(record: ImageRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await trimOverflow(db);
}

export async function listLocalHistoryRecords(reviewStatus?: ReviewStatus | ""): Promise<ImageRecord[]> {
  const db = await openDb();
  const records = await getAllRecords(db);
  const sorted = records.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return reviewStatus ? sorted.filter((r) => r.reviewStatus === reviewStatus) : sorted;
}

export function parseManualNoteAi(manualNote: string): AiImageResult | null {
  if (!manualNote) return null;
  try {
    const parsed = JSON.parse(manualNote);
    return parsed && typeof parsed === "object" && "alt_text_en" in parsed ? (parsed as AiImageResult) : null;
  } catch {
    return null;
  }
}
