import { CONFIG } from "../game/config";

/**
 * IndexedDB를 키-값 저장소로 쓰는 얇은 래퍼 (외부 라이브러리 없음).
 * 시크릿 모드·저장소 차단 등으로 열 수 없으면 메모리 저장소로 대신해서 게임은 계속할 수 있게 한다.
 */

export type StorageErrorKind = "quota" | "unavailable" | "unknown";

export class StorageError extends Error {
  constructor(
    readonly kind: StorageErrorKind,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export interface KeyValueStore {
  /** "persistent"면 IndexedDB, "memory"면 탭을 닫으면 사라지는 임시 저장소 */
  readonly kind: "persistent" | "memory";
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

const STORE_NAME = "kv";
const DB_VERSION = 1;

function toStorageError(err: unknown): StorageError {
  if (err instanceof StorageError) return err;
  const name = err instanceof DOMException ? err.name : "";
  if (name === "QuotaExceededError") return new StorageError("quota", "저장 공간이 부족합니다", err);
  if (name === "InvalidStateError" || name === "SecurityError") {
    return new StorageError("unavailable", "저장소를 사용할 수 없습니다", err);
  }
  return new StorageError("unknown", "저장 중 알 수 없는 오류가 발생했습니다", err);
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(toStorageError(req.error));
  });
}

function openDatabase(name: string, timeoutMs: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new StorageError("unavailable", "이 브라우저는 IndexedDB를 지원하지 않습니다"));
      return;
    }
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(
      () => done(() => reject(new StorageError("unavailable", "저장소가 응답하지 않습니다"))),
      timeoutMs,
    );

    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(name, DB_VERSION);
    } catch (err) {
      done(() => reject(toStorageError(err)));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => {
      const db = req.result;
      // 다른 탭이 새 버전 DB를 열려고 하면 막지 않도록 닫는다
      db.onversionchange = () => db.close();
      // 타임아웃 뒤에 늦게 열리면 바로 닫는다
      if (settled) db.close();
      else done(() => resolve(db));
    };
    req.onerror = () => done(() => reject(toStorageError(req.error)));
    req.onblocked = () => done(() => reject(new StorageError("unavailable", "다른 탭이 저장소를 사용 중입니다")));
  });
}

class IdbStore implements KeyValueStore {
  readonly kind = "persistent" as const;
  constructor(private readonly db: IDBDatabase) {}

  private async run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    try {
      const tx = this.db.transaction(STORE_NAME, mode);
      const result = promisify(fn(tx.objectStore(STORE_NAME)));
      // 쓰기는 트랜잭션이 커밋되어야 끝난 것으로 본다 (용량 초과는 여기서 나기도 한다)
      const committed = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(toStorageError(tx.error));
        tx.onerror = () => reject(toStorageError(tx.error));
      });
      const [value] = await Promise.all([result, committed]);
      return value;
    } catch (err) {
      throw toStorageError(err);
    }
  }

  get<T>(key: string) {
    return this.run("readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
  }

  async set(key: string, value: unknown) {
    await this.run("readwrite", (s) => s.put(value, key));
  }

  async delete(key: string) {
    await this.run("readwrite", (s) => s.delete(key));
  }
}

export class MemoryStore implements KeyValueStore {
  readonly kind = "memory" as const;
  private readonly map = new Map<string, unknown>();

  async get<T>(key: string) {
    const v = this.map.get(key);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }

  async set(key: string, value: unknown) {
    this.map.set(key, structuredClone(value));
  }

  async delete(key: string) {
    this.map.delete(key);
  }
}

export type OpenResult = { store: KeyValueStore; error?: StorageError };

/** 저장소를 연다. 실패해도 예외를 던지지 않고 메모리 저장소 + 원인을 돌려준다 */
export async function openStorage(dbName = CONFIG.storage.dbName): Promise<OpenResult> {
  try {
    const db = await openDatabase(dbName, CONFIG.storage.openTimeoutMs);
    return { store: new IdbStore(db) };
  } catch (err) {
    return { store: new MemoryStore(), error: toStorageError(err) };
  }
}
