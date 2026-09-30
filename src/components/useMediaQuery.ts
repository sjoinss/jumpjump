"use client";

import { useSyncExternalStore } from "react";

/** CSS 미디어 쿼리 결과를 따라간다. 서버 렌더링 때는 false */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
