/**
 * 되돌리기/다시 하기. 값 전체를 스냅샷으로 쌓는다(도트 그림은 작아서 충분히 가볍다).
 * 붓질 한 번(누르고 떼기까지)이 기록 한 칸이 되도록 쓰는 쪽에서 push 시점을 정한다.
 */
export type History<T> = { past: T[]; present: T; future: T[] };

export const HISTORY_LIMIT = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** 지금 값을 기록에 남기고 새 값으로 바꾼다 */
export function pushHistory<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  const past = [...h.past, h.present];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { past, present: next, future: [] };
}

/** 기록을 남기지 않고 지금 값만 바꾼다 (붓질 도중) */
export function replacePresent<T>(h: History<T>, next: T): History<T> {
  return next === h.present ? h : { ...h, present: next };
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  const present = h.past[h.past.length - 1];
  return { past: h.past.slice(0, -1), present, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  const [present, ...future] = h.future;
  return { past: [...h.past, h.present], present, future };
}
