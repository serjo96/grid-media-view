export type IdbKvKey = string;

const DB_NAME = "gridTest";
const DB_VERSION = 1;
const STORE_KV = "kv";
const STORE_BLOBS = "blobs";

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KV)) db.createObjectStore(STORE_KV);
      if (!db.objectStoreNames.contains(STORE_BLOBS)) db.createObjectStore(STORE_BLOBS);
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
    req.onsuccess = () => resolve(req.result);
  });
}

function waitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
  });
}

async function withDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDb();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

export async function idbGetKv<T>(key: IdbKvKey): Promise<T | null> {
  try {
    return await withDb(async (db) => {
      const tx = db.transaction(STORE_KV, "readonly");
      const store = tx.objectStore(STORE_KV);
      const res = await reqToPromise(store.get(key));
      return (res as T | undefined) ?? null;
    });
  } catch {
    return null;
  }
}

export async function idbSetKv<T>(key: IdbKvKey, value: T): Promise<boolean> {
  try {
    await withDb(async (db) => {
      const tx = db.transaction(STORE_KV, "readwrite");
      const store = tx.objectStore(STORE_KV);
      store.put(value, key);
      await waitTx(tx);
      return;
    });
    return true;
  } catch {
    return false;
  }
}

export async function idbDelKv(key: IdbKvKey): Promise<void> {
  try {
    await withDb(async (db) => {
      const tx = db.transaction(STORE_KV, "readwrite");
      tx.objectStore(STORE_KV).delete(key);
      await waitTx(tx);
      return;
    });
  } catch {
    // ignore
  }
}

export async function idbGetBlob(key: string): Promise<Blob | null> {
  try {
    return await withDb(async (db) => {
      const tx = db.transaction(STORE_BLOBS, "readonly");
      const store = tx.objectStore(STORE_BLOBS);
      const res = await reqToPromise(store.get(key));
      return (res as Blob | undefined) ?? null;
    });
  } catch {
    return null;
  }
}

export async function idbPutBlob(key: string, blob: Blob): Promise<boolean> {
  try {
    await withDb(async (db) => {
      const tx = db.transaction(STORE_BLOBS, "readwrite");
      tx.objectStore(STORE_BLOBS).put(blob, key);
      await waitTx(tx);
      return;
    });
    return true;
  } catch {
    return false;
  }
}

export async function idbDelBlob(key: string): Promise<void> {
  try {
    await withDb(async (db) => {
      const tx = db.transaction(STORE_BLOBS, "readwrite");
      tx.objectStore(STORE_BLOBS).delete(key);
      await waitTx(tx);
      return;
    });
  } catch {
    // ignore
  }
}

export async function idbListBlobKeys(prefix?: string): Promise<string[]> {
  try {
    return await withDb(async (db) => {
      const tx = db.transaction(STORE_BLOBS, "readonly");
      const store = tx.objectStore(STORE_BLOBS);
      const keys: string[] = [];
      const req = store.openKeyCursor();
      await new Promise<void>((resolve, reject) => {
        req.onerror = () => reject(req.error ?? new Error("Failed to iterate keys"));
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) {
            resolve();
            return;
          }
          const k = cursor.key;
          if (typeof k === "string" && (!prefix || k.startsWith(prefix))) keys.push(k);
          cursor.continue();
        };
      });
      return keys;
    });
  } catch {
    return [];
  }
}

