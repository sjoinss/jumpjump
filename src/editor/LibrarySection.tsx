"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { CONFIG } from "@/game/config";
import styles from "./LibrarySection.module.css";

type Props = {
  /** "캐릭터" / "발판 세트" (둘 다 받침이 없어 "가"를 붙인다) */
  what: string;
  items: { name: string; preview: ReactNode }[];
  max: number;
  /** 보관 버튼 글자 */
  saveLabel: string;
  /** 지금 그림을 보관할 수 없는 이유 (빈 그림 등). 없으면 보관 가능 */
  cantSave: string | null;
  onLoad: (index: number) => void;
  onDelete: (index: number) => void;
  onSave: (name: string) => void;
};

/**
 * 보관함 (사용자 요청 2026-10-02): 지금 그림을 이름 붙여 보관하고, 누르면 불러온다.
 * 지우기는 한 번 더 확인한다 (되돌릴 수 없어서).
 */
export function LibrarySection({ what, items, max, saveLabel, cantSave, onLoad, onDelete, onSave }: Props) {
  const titleId = useId();
  const full = items.length >= max;
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const fallback = `${what} ${items.length + 1}`;

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.heading}>
        내 보관함 <span className={styles.count}>{items.length}/{max}</span>
      </h3>

      {items.length > 0 ? (
        <ul className={styles.list}>
          {items.map((item, i) => (
            <li key={i} className={styles.item}>
              {confirm === i ? (
                <div className={styles.confirm} role="group" aria-label={`${item.name} 지우기 확인`}>
                  <span>「{item.name}」을(를) 지울까요?</span>
                  <Button variant="danger" onClick={() => (onDelete(i), setConfirm(null))}>
                    지우기
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirm(null)}>
                    취소
                  </Button>
                </div>
              ) : (
                <>
                  <button type="button" className={styles.load} onClick={() => onLoad(i)} aria-label={`${item.name} 불러오기`}>
                    <span className={styles.preview}>{item.preview}</span>
                    <span className={styles.name}>{item.name}</span>
                  </button>
                  <button type="button" className={styles.delete} onClick={() => setConfirm(i)} aria-label={`${item.name} 지우기`}>
                    <PixelIcon name="trash" size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.helper}>아직 보관한 {what}가 없어요. 지금 그림을 이름 붙여 보관해 두면 언제든 다시 불러올 수 있어요.</p>
      )}

      {full ? (
        <p className={styles.helper}>보관함이 가득 찼어요. 하나를 지우면 새로 보관할 수 있어요.</p>
      ) : (
        <form
          className={styles.saveRow}
          onSubmit={(e) => {
            e.preventDefault();
            if (cantSave) return;
            onSave(name.trim() || fallback);
            setName("");
          }}
        >
          <input
            type="text"
            value={name}
            maxLength={CONFIG.limits.companionNameMax}
            placeholder={fallback}
            aria-label={`보관할 ${what} 이름`}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" variant="primary" icon="plus" disabled={cantSave !== null}>
            {saveLabel}
          </Button>
        </form>
      )}
      {cantSave && !full && <p className={styles.helper}>{cantSave}</p>}
    </section>
  );
}
