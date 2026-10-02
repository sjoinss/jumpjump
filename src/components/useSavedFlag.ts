"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 저장 직후 버튼을 "저장 완료"로 잠깐 바꿔 두는 시간 (그 사이엔 다시 눌러도 또 받지 않는다) */
export const SAVED_HOLD_MS = 4000;

/**
 * 파일을 내려받은 뒤 어느 버튼으로 받았는지 잠깐 기억한다 (사용자 요청 2026-10-02:
 * 휴대폰은 바로 받아져서 받았는지 모르고 연타할 수 있다). key = 버튼 이름 ("png", "gif" …)
 */
export function useSavedFlag(ms = SAVED_HOLD_MS) {
  const [saved, setSaved] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const mark = useCallback(
    (key: string) => {
      setSaved(key);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setSaved(null), ms);
    },
    [ms],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { saved, mark };
}
