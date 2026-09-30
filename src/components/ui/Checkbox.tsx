import type { ReactNode } from "react";
import { PixelIcon } from "./PixelIcon";
import styles from "./Checkbox.module.css";

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** 라벨 오른쪽의 짧은 설명이나 미리보기 */
  detail?: ReactNode;
  disabled?: boolean;
};

/** 네이티브 체크박스 + 게임풍 모양. 줄 전체가 눌리는 영역이다 */
export function Checkbox({ label, checked, onChange, detail, disabled }: Props) {
  return (
    <label className={`${styles.row} ${disabled ? styles.disabled : ""}`}>
      <input
        type="checkbox"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.box} aria-hidden="true">
        {checked && <PixelIcon name="check" size={14} />}
      </span>
      <span className={styles.label}>{label}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </label>
  );
}
