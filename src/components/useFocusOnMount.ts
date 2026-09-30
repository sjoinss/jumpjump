"use client";

import { useEffect, useRef } from "react";

/**
 * 화면이 바뀌면 새 화면의 제목(또는 주요 영역)으로 포커스를 옮긴다.
 * 스크린리더 사용자가 화면 전환을 알 수 있고, 키보드 사용자는 새 화면 처음부터 Tab 이동한다.
 * 대상 요소에는 tabIndex={-1}을 준다.
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
