"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import styles from "./Toast.module.css";

export type ToastTone = "success" | "warning" | "error" | "info";

type ToastItem = { id: number; tone: ToastTone; message: string };

type ToastApi = {
  /** durationMs: 기본 3.5초. 파일 저장 안내처럼 꼭 읽어야 하는 건 길게 */
  show: (message: string, tone?: ToastTone, durationMs?: number) => void;
  /** 화면에는 안 보이고 스크린리더에만 읽히는 안내 (카운트다운, 게임 상태 등) */
  announce: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

// 색만으로 구분하지 않도록 기호를 문장 앞에 붙인다
const SYMBOL: Record<ToastTone, string> = { success: "✓", warning: "⚠", error: "✕", info: "ℹ" };
const DURATION_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const nextId = useRef(1);

  const show = useCallback((message: string, tone: ToastTone = "info", durationMs = DURATION_MS) => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-2), { id, tone, message }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), durationMs);
  }, []);

  const announce = useCallback((message: string) => {
    // 같은 문장을 연달아 보내도 다시 읽히도록 한 번 비웠다가 넣는다
    setAnnouncement("");
    window.requestAnimationFrame(() => setAnnouncement(message));
  }, []);

  const api = useMemo(() => ({ show, announce }), [show, announce]);

  // 대화창(<dialog> showModal)은 맨 위 층에 떠서 보통 요소는 z-index와 상관없이 그 뒤에 가려진다.
  // 알림 영역을 popover로 맨 위 층에 올리고, 새 알림이 올 때마다 다시 올려서 방금 연 대화창보다도 위에 보이게 한다
  const regionRef = useRef<HTMLDivElement>(null);
  const shown = items.length;
  useLayoutEffect(() => {
    const el = regionRef.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!el?.showPopover || !el.hidePopover) return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      if (shown > 0) el.showPopover();
    } catch {
      // popover를 못 쓰는 브라우저: 예전처럼 z-index로만
    }
  }, [shown, items]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div ref={regionRef} popover="manual" className={styles.region} role="status" aria-live="polite">
        {items.map((t) => (
          <p key={t.id} className={`${styles.toast} ${styles[t.tone]}`}>
            <span className={styles.symbol} aria-hidden="true">
              {SYMBOL[t.tone]}
            </span>
            <span>{t.message}</span>
          </p>
        ))}
      </div>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast는 ToastProvider 안에서만 쓸 수 있습니다");
  return ctx;
}
