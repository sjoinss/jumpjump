import { CONFIG } from "../game/config";
import { createDefaultSaveData, type DefaultEnv } from "./defaults";
import { migrate } from "./migrate";
import type { SaveData } from "./schema";
import { StorageError, type KeyValueStore } from "./storage";
import { normalizeSaveData } from "./validate";

export const SAVE_KEY = "save";
/** 읽을 수 없던 원본을 버리지 않고 한 벌 보관하는 키 (나중에 수동 복구용) */
export const CORRUPT_BACKUP_KEY = "save.corrupt";

/**
 * - fresh: 저장된 데이터 없음 (첫 실행)
 * - loaded: 정상
 * - migrated: 이전 버전 데이터를 변환함
 * - repaired: 일부가 손상되어 그 부분만 기본값으로 되돌림
 * - reset: 전체를 읽을 수 없어 기본값으로 시작 (원본은 CORRUPT_BACKUP_KEY에 보관)
 * - newer: 더 새로운 앱 버전의 데이터. 덮어쓰지 않도록 읽기 전용
 * - readFailed: 저장소에서 읽는 것 자체가 실패. 덮어쓰지 않도록 읽기 전용
 */
export type LoadNotice = "fresh" | "loaded" | "migrated" | "repaired" | "reset" | "newer" | "readFailed";

export type LoadResult = {
  data: SaveData;
  notice: LoadNotice;
  /** true면 이 세션의 변경을 저장소에 쓰지 않는다 (기존 데이터 보호) */
  readOnly: boolean;
  issues: string[];
};

async function backupCorrupt(store: KeyValueStore, raw: unknown) {
  try {
    await store.set(CORRUPT_BACKUP_KEY, { savedAt: Date.now(), raw });
  } catch {
    // 보관에 실패해도 복구 흐름은 계속한다
  }
}

export async function loadSaveData(store: KeyValueStore, env: DefaultEnv): Promise<LoadResult> {
  let raw: unknown;
  try {
    raw = await store.get(SAVE_KEY);
  } catch {
    return { data: createDefaultSaveData(env), notice: "readFailed", readOnly: true, issues: [] };
  }

  if (raw === undefined) {
    return { data: createDefaultSaveData(env), notice: "fresh", readOnly: false, issues: [] };
  }

  const migrated = migrate(raw);
  if (!migrated.ok && migrated.reason === "newer") {
    // 모르는 필드는 버려지지만, 읽기 전용이라 원본은 그대로 남는다
    const { data, issues } = normalizeSaveData(raw, env);
    return { data, notice: "newer", readOnly: true, issues };
  }
  if (!migrated.ok) {
    await backupCorrupt(store, raw);
    const data = createDefaultSaveData(env);
    await store.set(SAVE_KEY, data).catch(() => {});
    return { data, notice: "reset", readOnly: false, issues: ["전체 데이터"] };
  }

  const { data, issues } = normalizeSaveData(migrated.data, env);
  if (issues.length > 0) {
    await backupCorrupt(store, raw);
    await store.set(SAVE_KEY, data).catch(() => {});
    return { data, notice: "repaired", readOnly: false, issues };
  }
  if (migrated.fromVersion < data.version) {
    await store.set(SAVE_KEY, data).catch(() => {});
    return { data, notice: "migrated", readOnly: false, issues };
  }
  return { data, notice: "loaded", readOnly: false, issues };
}

export type SaveStatus = { saving: boolean; error: StorageError | null };

type Listener = () => void;

/**
 * 메모리의 SaveData와 저장소 사이를 잇는다.
 * update()는 화면에 즉시 반영하고, 쓰기는 짧게 모아서(debounce) 한 번에 하나씩 순서대로 한다.
 * 쓰기가 실패하면 데이터는 메모리에 남고 다음 update/flush 때 다시 시도한다.
 */
export class SaveStore {
  private data: SaveData;
  private status: SaveStatus = { saving: false, error: null };
  private readonly listeners = new Set<Listener>();
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: KeyValueStore,
    initial: SaveData,
    private readonly readOnly: boolean,
    private readonly debounceMs: number = CONFIG.storage.writeDebounceMs,
  ) {
    this.data = initial;
  }

  getData = () => this.data;
  getStatus = () => this.status;

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  /** recipe는 새 객체를 돌려줘야 한다 (기존 객체를 고치지 않는다) */
  update(recipe: (prev: SaveData) => SaveData) {
    const next = recipe(this.data);
    if (next === this.data) return;
    this.data = next;
    this.emit();
    if (this.readOnly) return;
    this.dirty = true;
    this.schedule();
  }

  /** 모아 둔 변경을 지금 쓴다. 앱이 백그라운드로 갈 때 부른다 */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty || this.readOnly) return this.writing;
    this.writing = this.writing.then(() => this.write());
    return this.writing;
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.debounceMs);
  }

  private async write() {
    if (!this.dirty) return;
    const snapshot = this.data;
    this.dirty = false;
    this.setStatus({ saving: true, error: this.status.error });
    try {
      await this.store.set(SAVE_KEY, snapshot);
      this.setStatus({ saving: false, error: null });
    } catch (err) {
      // 그사이 새 변경이 없었다면 다시 시도할 수 있게 dirty로 되돌린다
      this.dirty = true;
      const error = err instanceof StorageError ? err : new StorageError("unknown", "저장하지 못했습니다", err);
      this.setStatus({ saving: false, error });
    }
  }

  private setStatus(next: SaveStatus) {
    this.status = next;
    this.emit();
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }
}
