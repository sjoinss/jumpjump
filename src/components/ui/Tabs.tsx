"use client";

import { useRef, type KeyboardEvent } from "react";
import styles from "./Tabs.module.css";

type Item<T extends string> = { id: T; label: string; /** 바뀐 내용 있음 표시 (글자로도 전달) */ marked?: boolean };

type Props<T extends string> = {
  items: Item<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** 탭 버튼 id 접두사. 탭 패널은 aria-labelledby={`${idPrefix}-${id}`}로 연결한다 */
  idPrefix: string;
  panelId: string;
};

/** 게임풍 탭. 방향키·Home·End로 이동하고 선택된 탭만 Tab 순서에 들어간다 */
export function Tabs<T extends string>({ items, value, onChange, label, idPrefix, panelId }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {items.map((item, i) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${idPrefix}-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {item.label}
            {item.marked && (
              <>
                <span className={styles.mark} aria-hidden="true" />
                <span className="visually-hidden"> (수정됨)</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
