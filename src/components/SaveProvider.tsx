"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { loadSaveData, SaveStore, type LoadNotice, type SaveStatus } from "@/lib/saveStore";
import type { SaveData } from "@/lib/schema";
import { openStorage, type KeyValueStore, type StorageError } from "@/lib/storage";
import { useToast } from "./ui/Toast";

type SaveInfo = {
  store: SaveStore;
  /** 저장소 원본. 에디터 초안 등 SaveData 밖의 값도 여기에 둔다 (3단계) */
  kv: KeyValueStore;
  notice: LoadNotice;
  readOnly: boolean;
  openError: StorageError | null;
};

const SaveContext = createContext<SaveInfo | null>(null);

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

const WRITE_ERROR_TEXT: Record<StorageError["kind"], string> = {
  quota: "저장 공간이 부족해서 저장하지 못했어요. 쓰지 않는 그림을 지우거나 데이터를 내보내 주세요.",
  unavailable: "저장소를 쓸 수 없어서 저장하지 못했어요. 게임은 계속할 수 있어요.",
  unknown: "저장하지 못했어요. 다음에 바꿀 때 다시 시도할게요.",
};

/**
 * 앱 시작 때 저장소를 열고 데이터를 읽는다. 읽는 동안에는 children 대신 loading을 그린다.
 * 쓰기 실패·데이터 복구 같은 상태 변화는 토스트로 알린다.
 */
export function SaveProvider({ children, loading }: { children: ReactNode; loading: ReactNode }) {
  const [info, setInfo] = useState<SaveInfo | null>(null);
  const { show } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { store: kv, error } = await openStorage();
      const result = await loadSaveData(kv, { reducedMotion: prefersReducedMotion() });
      if (cancelled) return;
      setInfo({
        store: new SaveStore(kv, result.data, result.readOnly),
        kv,
        notice: result.notice,
        readOnly: result.readOnly,
        openError: error ?? null,
      });
      if (result.notice === "repaired") {
        show("저장된 데이터 일부가 손상되어 그 부분만 처음 상태로 되돌렸어요.", "warning");
      } else if (result.notice === "reset") {
        show("저장된 데이터를 읽을 수 없어 처음 상태로 시작해요. 원본은 따로 보관해 두었어요.", "warning");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [show]);

  // 앱이 백그라운드로 가거나 닫힐 때 모아 둔 변경을 바로 쓴다
  useEffect(() => {
    if (!info) return;
    const flush = () => void info.store.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [info]);

  // 쓰기 오류: 오류가 새로 생겼을 때만 한 번 알린다 (재시도마다 반복하지 않음)
  const lastErrorKind = useRef<StorageError["kind"] | null>(null);
  useEffect(() => {
    if (!info) return;
    return info.store.subscribe(() => {
      const error = info.store.getStatus().error;
      if (error && lastErrorKind.current !== error.kind) show(WRITE_ERROR_TEXT[error.kind], "error");
      else if (!error && lastErrorKind.current) show("저장되었습니다.", "success");
      lastErrorKind.current = error?.kind ?? null;
    });
  }, [info, show]);

  if (!info) return <>{loading}</>;
  return <SaveContext.Provider value={info}>{children}</SaveContext.Provider>;
}

function useSaveInfo(): SaveInfo {
  const info = useContext(SaveContext);
  if (!info) throw new Error("SaveProvider 안에서만 쓸 수 있습니다");
  return info;
}

/** 저장 데이터와 수정 함수. update는 화면에 바로 반영되고 저장은 잠시 뒤 모아서 된다 */
export function useSaveData(): [SaveData, (recipe: (prev: SaveData) => SaveData) => void] {
  const { store } = useSaveInfo();
  const data = useSyncExternalStore(store.subscribe, store.getData, store.getData);
  const update = useCallback((recipe: (prev: SaveData) => SaveData) => store.update(recipe), [store]);
  return [data, update];
}

export function useSaveStatus(): SaveStatus {
  const { store } = useSaveInfo();
  return useSyncExternalStore(store.subscribe, store.getStatus, store.getStatus);
}

export function useKeyValueStore(): KeyValueStore {
  return useSaveInfo().kv;
}

export type StorageBanner = { title: string; message: string } | null;

/** 저장이 안 되는 상태면 화면에 계속 띄워 둘 안내. 정상이면 null */
export function useStorageBanner(): StorageBanner {
  const { kv, notice } = useSaveInfo();
  if (notice === "newer") {
    return {
      title: "앱을 업데이트해주세요",
      message: "더 새로운 버전에서 저장한 데이터예요. 새로고침하면 업데이트돼요. 지금 바꾼 내용은 저장되지 않아요.",
    };
  }
  if (notice === "readFailed") {
    return {
      title: "저장된 데이터를 읽지 못했어요",
      message: "새로고침해 주세요. 지금 바꾼 내용은 저장되지 않아요.",
    };
  }
  if (kv.kind === "memory") {
    return {
      title: "기록이 저장되지 않아요",
      message: "이 브라우저에서는 저장소를 쓸 수 없어요(시크릿 모드 등). 게임은 그대로 할 수 있지만 창을 닫으면 사라져요.",
    };
  }
  return null;
}
