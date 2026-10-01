"use client";

import { useState } from "react";
import { CONFIG } from "@/game/config";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { ColorPicker } from "./ColorPicker";
import styles from "./Palette.module.css";

type Props = {
  color: string;
  palette: string[];
  onColor: (color: string) => void;
  onPaletteChange: (palette: string[]) => void;
};

/**
 * 지금 색(누르면 색 고르기 창: 채도·밝기 네모 + 색조 막대) + 저장한 색들.
 * "편집"을 켜면 색을 눌러 지운다. 최대 개수에 닿으면 추가 버튼이 비활성되고 이유를 글로 보여준다.
 */
export function Palette({ color, palette, onColor, onPaletteChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const max = CONFIG.limits.paletteMax;
  const full = palette.length >= max;
  const has = palette.includes(color);

  return (
    <div className={styles.palette}>
      <div className={styles.row}>
        <button type="button" className={styles.current} title="색 고르기" aria-haspopup="dialog" onClick={() => setPicking(true)}>
          <span className={styles.currentSwatch} style={{ background: color }} aria-hidden="true" />
          <span className="visually-hidden">지금 색 {color}. 눌러서 다른 색 고르기</span>
        </button>
        <ColorPicker open={picking} color={color} onChange={onColor} onClose={() => setPicking(false)} />

        <ul className={styles.swatches} aria-label={editing ? "지울 색 고르기" : "저장한 색"}>
          {palette.map((c) => (
            <li key={c}>
              <button
                type="button"
                className={`${styles.swatch} ${editing ? styles.deleting : ""}`}
                style={{ background: c }}
                aria-pressed={editing ? undefined : c === color}
                aria-label={editing ? `${c} 지우기` : c}
                title={editing ? `${c} 지우기` : c}
                onClick={() => (editing ? onPaletteChange(palette.filter((p) => p !== c)) : onColor(c))}
              >
                {editing && <PixelIcon name="close" size={10} />}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.small}
          disabled={full || has || editing}
          aria-describedby={full ? "palette-full" : undefined}
          onClick={() => onPaletteChange([...palette, color])}
        >
          <PixelIcon name="plus" size={12} />
          지금 색 저장
        </button>
        <button type="button" className={styles.small} aria-pressed={editing} onClick={() => setEditing((v) => !v)}>
          {editing ? "편집 끝" : "색 지우기"}
        </button>
        {full && (
          <span id="palette-full" className={styles.helper}>
            색은 {max}개까지 저장돼요
          </span>
        )}
      </div>
    </div>
  );
}
