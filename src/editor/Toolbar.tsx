"use client";

import { PixelIcon, type PixelIconName } from "@/components/ui/PixelIcon";
import type { Tool } from "./session";
import styles from "./Toolbar.module.css";

type ToolDef = { id: Tool; icon: PixelIconName; label: string; key: string };

export const TOOLS: ToolDef[] = [
  { id: "pen", icon: "pencil", label: "펜", key: "B" },
  { id: "eraser", icon: "eraser", label: "지우개", key: "E" },
  { id: "fill", icon: "fill", label: "채우기", key: "G" },
  { id: "eyedropper", icon: "dropper", label: "스포이드", key: "I" },
  { id: "move", icon: "move", label: "이동", key: "M" },
];

type Props = {
  tool: Tool;
  onTool: (tool: Tool) => void;
  symmetry: boolean;
  grid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** 이미지 프레임이면 도트 도구를 쓸 수 없다 */
  disabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSymmetry: () => void;
  onToggleGrid: () => void;
  onFlip: () => void;
  onClear: () => void;
};

/** 두 줄: 도구(하나만 선택) / 동작·켜고 끄기. 아이콘 아래에 글자를 함께 둔다 */
export function Toolbar(p: Props) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.row} role="group" aria-label="그리기 도구">
        {TOOLS.map((t) => (
          <ToolButton
            key={t.id}
            icon={t.icon}
            label={t.label}
            title={`${t.label} (${t.key})`}
            pressed={p.tool === t.id}
            disabled={p.disabled}
            onClick={() => p.onTool(t.id)}
          />
        ))}
      </div>
      <div className={styles.row} role="group" aria-label="편집">
        <ToolButton icon="undo" label="되돌림" title="되돌리기 (Ctrl+Z)" disabled={!p.canUndo} onClick={p.onUndo} />
        <ToolButton icon="redo" label="다시" title="다시 하기 (Ctrl+Y)" disabled={!p.canRedo} onClick={p.onRedo} />
        <ToolButton icon="mirror" label="대칭" title="대칭 그리기" pressed={p.symmetry} disabled={p.disabled} onClick={p.onToggleSymmetry} />
        <ToolButton icon="flip" label="반전" title="좌우 반전" disabled={p.disabled} onClick={p.onFlip} />
        <ToolButton icon="grid" label="격자" title="격자 보이기" pressed={p.grid} onClick={p.onToggleGrid} />
        <ToolButton icon="trash" label="지우기" title="전체 지우기 (되돌리기 가능)" onClick={p.onClear} />
      </div>
    </div>
  );
}

type ToolButtonProps = {
  icon: PixelIconName;
  label: string;
  title: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function ToolButton({ icon, label, title, pressed, disabled, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      className={styles.tool}
      aria-pressed={pressed}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      <PixelIcon name={icon} size={20} />
      <span className={styles.label}>{label}</span>
    </button>
  );
}
