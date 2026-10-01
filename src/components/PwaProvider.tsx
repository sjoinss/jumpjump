"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * 웹앱(PWA) 상태 (기획서 16번): 서비스 워커 등록 · 새 버전 안내 · 설치 유도 · 전체화면 · 저장소 보존.
 * 서비스 워커는 배포 빌드에서만 등록한다 (개발 서버에서는 캐시 때문에 헷갈리지 않게).
 */

/** GitHub Pages 같은 하위 경로 배포용 접두사 (로컬은 "") */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * - installed: 이미 홈 화면 앱으로 실행 중
 * - prompt: 브라우저가 설치 창을 띄워 줄 수 있음 (Android Chrome 등)
 * - ios: iPhone·iPad Safari — "공유 → 홈 화면에 추가" 안내
 * - unavailable: 이 브라우저에서는 설치를 도와줄 수 없음
 */
export type InstallState = "installed" | "prompt" | "ios" | "unavailable";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Pwa = {
  installState: InstallState;
  /** Android: 브라우저 설치 창. 결과를 돌려준다 */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  /** 새 버전을 받아 두었고 교체를 기다리는 중 */
  updateReady: boolean;
  /** 새 버전으로 바꾸고 새로고침 */
  applyUpdate: () => void;
};

const PwaContext = createContext<Pwa>({
  installState: "unavailable",
  promptInstall: async () => "unavailable",
  updateReady: false,
  applyUpdate: () => {},
});

export function usePwa() {
  return useContext(PwaContext);
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  const ua = navigator.userAgent;
  // iPadOS는 데스크톱 Safari처럼 보이므로 터치 지점 수로 구분
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * 브라우저에 "이 사이트 데이터는 지우지 말아 주세요"라고 요청한다 (기획서 16번).
 * 브라우저에 따라 묻는 창이 뜰 수 있어서 그림을 처음 저장했을 때나 설치했을 때만 부른다.
 */
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist || (await navigator.storage.persisted())) return;
    await navigator.storage.persist();
  } catch {
    // 지원하지 않거나 거절해도 게임은 그대로 동작한다
  }
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [installState, setInstallState] = useState<InstallState>("unavailable");
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);

  // ── 설치 상태 ──
  useEffect(() => {
    if (isStandalone()) {
      setInstallState("installed");
      void requestPersistentStorage();
      return;
    }
    if (isIos()) setInstallState("ios");
    const onPrompt = (e: Event) => {
      e.preventDefault(); // 브라우저 기본 배너 대신 우리 버튼으로
      deferred.current = e as BeforeInstallPromptEvent;
      setInstallState("prompt");
    };
    const onInstalled = () => {
      deferred.current = null;
      setInstallState("installed");
      void requestPersistentStorage();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const e = deferred.current;
    if (!e) return "unavailable" as const;
    await e.prompt();
    const { outcome } = await e.userChoice;
    // 한 번 쓴 설치 창은 다시 쓸 수 없다. 거절하면 브라우저가 다음에 다시 알려줄 때까지 버튼을 숨긴다
    deferred.current = null;
    if (outcome === "dismissed") setInstallState(isIos() ? "ios" : "unavailable");
    return outcome;
  }, []);

  // ── 서비스 워커: 등록 + 새 버전 감지 ──
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reg: ServiceWorkerRegistration | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const watch = (w: ServiceWorker | null) => {
      if (!w) return;
      const check = () => {
        // 이미 이 페이지를 맡은 워커가 있을 때만 "새 버전" (첫 설치는 안내하지 않음)
        if (w.state === "installed" && navigator.serviceWorker.controller) setWaiting(w);
      };
      check();
      w.addEventListener("statechange", check);
    };

    navigator.serviceWorker
      .register(`${BASE}/sw.js`, { scope: `${BASE}/` })
      .then((r) => {
        reg = r;
        watch(r.waiting);
        r.addEventListener("updatefound", () => watch(r.installing));
        // 오래 켜 두는 앱이라 가끔 새 버전을 확인한다
        timer = setInterval(() => void r.update().catch(() => {}), 30 * 60 * 1000);
      })
      .catch(() => {
        // 등록에 실패해도 온라인에서는 그대로 동작한다
      });

    const onVisible = () => document.visibilityState === "visible" && void reg?.update().catch(() => {});
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
    waiting.postMessage("SKIP_WAITING");
  }, [waiting]);

  // ── 모바일 브라우저 탭: 첫 터치에 전체화면 시도 (iPhone은 미지원이라 조용히 넘어감) ──
  useEffect(() => {
    if (isStandalone() || !window.matchMedia("(pointer: coarse)").matches) return;
    const el = document.documentElement;
    if (!document.fullscreenEnabled || typeof el.requestFullscreen !== "function") return;
    const once = () => {
      window.removeEventListener("pointerup", once, true);
      if (!document.fullscreenElement) el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    };
    // pointerup: 사용자 동작으로 인정되는 시점
    window.addEventListener("pointerup", once, true);
    return () => window.removeEventListener("pointerup", once, true);
  }, []);

  const value = useMemo<Pwa>(
    () => ({ installState, promptInstall, updateReady: waiting !== null, applyUpdate }),
    [installState, promptInstall, waiting, applyUpdate],
  );
  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}
