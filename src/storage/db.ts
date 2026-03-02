import { Clip, MemoryItem, OrbitStudySession, RecallQueueCard, SessionLog, SrsCard, WeeklyPatternReport } from "@/lib/types";

export type StoreName = "clips" | "memoryItems" | "srsCards" | "sessionLogs" | "orbitSessions" | "recallQueue" | "weeklyReports" | "meta";

interface MetaRecord {
  key: string;
  value: unknown;
}

interface StoreMap {
  clips: Clip;
  memoryItems: MemoryItem;
  srsCards: SrsCard;
  sessionLogs: SessionLog;
  orbitSessions: OrbitStudySession;
  recallQueue: RecallQueueCard;
  weeklyReports: WeeklyPatternReport;
  meta: MetaRecord;
}

export interface StorageStatus {
  backend: "indexeddb" | "localstorage";
  migrationRequired: boolean;
  schemaVersion: number;
}

const DB_NAME = "dlb";
const DB_VERSION = 4;
const LS_PREFIX = "dlb:";

const LEGACY_KEYS = ["lingoplay_clips", "lingoplay_srs", "lingoplay_sessions"];
const META_SCHEMA_VERSION = "schemaVersion";
const META_MIGRATION_REQUIRED = "migrationRequired";

const STORE_KEY_PATH: Record<StoreName, string> = {
  clips: "id",
  memoryItems: "id",
  srsCards: "id",
  sessionLogs: "date",
  orbitSessions: "id",
  recallQueue: "id",
  weeklyReports: "id",
  meta: "key",
};

let backend: "indexeddb" | "localstorage" = "localstorage";
let dbPromise: Promise<IDBDatabase | null> | null = null;
let initPromise: Promise<void> | null = null;

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) {
    backend = "localstorage";
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      (Object.keys(STORE_KEY_PATH) as StoreName[]).forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: STORE_KEY_PATH[storeName] });
        }
      });
    };

    request.onsuccess = () => {
      backend = "indexeddb";
      resolve(request.result);
    };

    request.onerror = () => {
      console.error("IndexedDB open failed. Falling back to localStorage", request.error);
      backend = "localstorage";
      resolve(null);
    };
  });
}

function getDbPromise(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = openDb();
  }
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T>
): Promise<T | null> {
  const db = await getDbPromise();
  if (!db) return null;

  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);

  try {
    const result = await action(store);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  } catch (error) {
    console.error(`IndexedDB store operation failed for ${storeName}`, error);
    return null;
  }
}

function localStorageKey(storeName: StoreName): string {
  return `${LS_PREFIX}${storeName}`;
}

function readLocalArray<K extends StoreName>(storeName: K): StoreMap[K][] {
  try {
    const raw = localStorage.getItem(localStorageKey(storeName));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalArray<K extends StoreName>(storeName: K, value: StoreMap[K][]): void {
  localStorage.setItem(localStorageKey(storeName), JSON.stringify(value));
}

function hasLegacyFields(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  const queue: unknown[] = [value];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;

    if (!Array.isArray(current)) {
      const record = current as Record<string, unknown>;
      if ("sentences" in record || "sentenceId" in record) {
        return true;
      }
      Object.values(record).forEach((val) => queue.push(val));
    } else {
      current.forEach((item) => queue.push(item));
    }
  }

  return false;
}

async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const dbRecord = await withStore("meta", "readonly", async (store) => {
    const record = await requestToPromise(store.get(key));
    return (record as MetaRecord | undefined) ?? null;
  });

  if (dbRecord && (dbRecord as MetaRecord).value !== undefined) {
    return (dbRecord as MetaRecord).value as T;
  }

  const localItems = readLocalArray("meta") as MetaRecord[];
  const found = localItems.find((item) => item.key === key);
  return found ? (found.value as T) : fallback;
}

async function setMeta<T>(key: string, value: T): Promise<void> {
  const record: MetaRecord = { key, value };

  const dbResult = await withStore("meta", "readwrite", async (store) => {
    await requestToPromise(store.put(record));
    return true;
  });

  if (dbResult === null || backend === "localstorage") {
    const localItems = readLocalArray("meta") as MetaRecord[];
    const idx = localItems.findIndex((item) => item.key === key);
    if (idx >= 0) {
      localItems[idx] = record;
    } else {
      localItems.push(record);
    }
    writeLocalArray("meta", localItems as StoreMap["meta"][]);
  }
}

export async function getMetaValue<T>(key: string, fallback: T): Promise<T> {
  await initStorage();
  return getMeta<T>(key, fallback);
}

export async function setMetaValue<T>(key: string, value: T): Promise<void> {
  await initStorage();
  await setMeta(key, value);
}

async function hasLegacyData(): Promise<boolean> {
  for (const key of LEGACY_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw && raw !== "[]" && raw !== "{}") {
      try {
        const parsed = JSON.parse(raw);
        if ((Array.isArray(parsed) && parsed.length > 0) || (!Array.isArray(parsed) && Object.keys(parsed || {}).length > 0)) {
          return true;
        }
      } catch {
        return true;
      }
    }
  }

  const localStoresToCheck: StoreName[] = ["clips", "memoryItems", "srsCards"];
  for (const storeName of localStoresToCheck) {
    const values = readLocalArray(storeName);
    if (values.some((item) => hasLegacyFields(item))) {
      return true;
    }
  }

  const db = await getDbPromise();
  if (!db) return false;

  const idbClipRecords = await withStore("clips", "readonly", async (store) => {
    const result = await requestToPromise(store.getAll());
    return (result as StoreMap["clips"][]) ?? [];
  });

  const idbCardRecords = await withStore("srsCards", "readonly", async (store) => {
    const result = await requestToPromise(store.getAll());
    return (result as StoreMap["srsCards"][]) ?? [];
  });

  return [...(idbClipRecords ?? []), ...(idbCardRecords ?? [])].some((item) => hasLegacyFields(item));
}

export async function initStorage(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await getDbPromise();

      const storedVersion = await getMeta<number | null>(META_SCHEMA_VERSION, null);
      if (storedVersion !== null && storedVersion !== DB_VERSION) {
        await setMeta(META_MIGRATION_REQUIRED, true);
      }

      if (storedVersion !== DB_VERSION) {
        await setMeta(META_SCHEMA_VERSION, DB_VERSION);
      }

      const legacyDetected = await hasLegacyData();
      if (legacyDetected) {
        await setMeta(META_MIGRATION_REQUIRED, true);
      }

      const migrationFlag = await getMeta<boolean | null>(META_MIGRATION_REQUIRED, null);
      if (migrationFlag === null) {
        await setMeta(META_MIGRATION_REQUIRED, false);
      }
    })();
  }

  await initPromise;
}

export async function listFromStore<K extends StoreName>(storeName: K): Promise<StoreMap[K][]> {
  await initStorage();

  const dbRecords = await withStore(storeName, "readonly", async (store) => {
    const result = await requestToPromise(store.getAll());
    return (result as StoreMap[K][]) ?? [];
  });

  if (dbRecords !== null && backend === "indexeddb") {
    return dbRecords;
  }

  return readLocalArray(storeName);
}

export async function getFromStore<K extends StoreName>(
  storeName: K,
  key: string
): Promise<StoreMap[K] | undefined> {
  await initStorage();

  const dbRecord = await withStore(storeName, "readonly", async (store) => {
    const result = await requestToPromise(store.get(key));
    return (result as StoreMap[K] | undefined) ?? undefined;
  });

  if (dbRecord !== null && backend === "indexeddb") {
    return dbRecord ?? undefined;
  }

  const keyPath = STORE_KEY_PATH[storeName] as keyof StoreMap[K];
  const records = readLocalArray(storeName);
  return records.find((item) => String(item[keyPath]) === key);
}

export async function upsertToStore<K extends StoreName>(storeName: K, value: StoreMap[K]): Promise<void> {
  await initStorage();

  const dbResult = await withStore(storeName, "readwrite", async (store) => {
    await requestToPromise(store.put(value));
    return true;
  });

  if (dbResult === null || backend === "localstorage") {
    const keyPath = STORE_KEY_PATH[storeName] as keyof StoreMap[K];
    const key = String(value[keyPath]);
    const records = readLocalArray(storeName);
    const idx = records.findIndex((item) => String(item[keyPath]) === key);
    if (idx >= 0) {
      records[idx] = value;
    } else {
      records.push(value);
    }
    writeLocalArray(storeName, records);
  }
}

export async function removeFromStore<K extends StoreName>(storeName: K, key: string): Promise<void> {
  await initStorage();

  const dbResult = await withStore(storeName, "readwrite", async (store) => {
    await requestToPromise(store.delete(key));
    return true;
  });

  if (dbResult === null || backend === "localstorage") {
    const keyPath = STORE_KEY_PATH[storeName] as keyof StoreMap[K];
    const records = readLocalArray(storeName).filter((item) => String(item[keyPath]) !== key);
    writeLocalArray(storeName, records);
  }
}

export async function clearStore(storeName: StoreName): Promise<void> {
  await initStorage();

  await withStore(storeName, "readwrite", async (store) => {
    await requestToPromise(store.clear());
    return true;
  });

  localStorage.removeItem(localStorageKey(storeName));
}

export async function setMigrationRequired(value: boolean): Promise<void> {
  await initStorage();
  await setMeta(META_MIGRATION_REQUIRED, value);
}

export async function getStorageStatus(): Promise<StorageStatus> {
  await initStorage();

  const migrationRequired = await getMeta<boolean>(META_MIGRATION_REQUIRED, false);
  const schemaVersion = await getMeta<number>(META_SCHEMA_VERSION, DB_VERSION);

  return {
    backend,
    migrationRequired,
    schemaVersion,
  };
}

export async function clearAllAppData(): Promise<void> {
  await initStorage();

  const stores: StoreName[] = ["clips", "memoryItems", "srsCards", "sessionLogs", "orbitSessions", "recallQueue", "weeklyReports", "meta"];
  await Promise.all(stores.map((store) => clearStore(store)));

  LEGACY_KEYS.forEach((legacyKey) => localStorage.removeItem(legacyKey));
  localStorage.removeItem("lingoplay_settings");
  localStorage.removeItem("dlb:settings");

  await setMeta(META_SCHEMA_VERSION, DB_VERSION);
  await setMeta(META_MIGRATION_REQUIRED, false);
}
