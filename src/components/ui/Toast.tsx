"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import styles from "./Toast.module.css";

export type ToastTone = "success" | "warning" | "error" | "info";

type ToastItem = { id: number; tone: ToastTone; message: string };

type ToastApi = {
  show: (message: string, tone?: ToastTone) => void;
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

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-2), { id, tone, message }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), DURATION_MS);
  }, []);

  const announce = useCallback((message: string) => {
    // 같은 문장을 연달아 보내도 다시 읽히도록 한 번 비웠다가 넣는다
    setAnnouncement("");
    window.requestAnimationFrame(() => setAnnouncement(message));
  }, []);

  const api = useMemo(() => ({ show, announce }), [show, announce]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
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
