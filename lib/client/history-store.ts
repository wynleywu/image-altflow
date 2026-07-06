import type { ImageRecord, ReviewStatus } from "@/lib/types";

const DB_NAME = "altflow-history";
const STORE_NAME = "records";
const DB_VERSION = 1;
const MAX_RECORDS = 200;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
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

async function getAllRecords(db: IDBDatabase): Promise<ImageRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as ImageRecord[]);
    req.onerror = () => reject(req.error);
  });
}

export async function addLocalHistoryRecord(record: ImageRecord): Promise<void> {
  const db = await openDb();
  const existing = await getAllRecords(db);
  const overflow = existing
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    .slice(0, Math.max(0, existing.length + 1 - MAX_RECORDS));

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    overflow.forEach((item) => store.delete(item.recordId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listLocalHistoryRecords(reviewStatus?: ReviewStatus | ""): Promise<ImageRecord[]> {
  const db = await openDb();
  const records = await getAllRecords(db);
  const sorted = records.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return reviewStatus ? sorted.filter((r) => r.reviewStatus === reviewStatus) : sorted;
}
