"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { drawSprite } from "@/game/sprites";
import type { PixelSprite, Sprite } from "@/lib/schema";
import type { PointerPhase, Tool } from "./session";
import styles from "./DotCanvas.module.css";

type Props = {
  sprite: PixelSprite;
  /** 반투명하게 아래 까는 그림 (착지 프레임 작업용 / 동료 그리기의 주인공 가이드) */
  underlay?: Sprite | null;
  underlayOpacity?: number;
  showGrid: boolean;
  symmetry: boolean;
  tool: Tool;
  label: string;
  onCell: (phase: PointerPhase, x: number, y: number) => void;
};

const CHECKER_A = "#fffdf8";
const CHECKER_B = "#f1e8f4";

/**
 * 도트 그리기 캔버스 (터치·마우스 전용 — 키보드로 그리는 기능은 두지 않기로 함).
 * 누른 채 끌면 연속으로 칠하고, 두 번째 손가락이 닿으면(핀치) 그 붓질을 취소한다.
 * 칸 크기는 들어갈 수 있는 가장 큰 정수 px로 맞춘다.
 */
export function DotCanvas({ sprite, underlay, underlayOpacity = 0.35, showGrid, symmetry, tool, label, onCell }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cell, setCell] = useState(12);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const activePointer = useRef<number | null>(null);
  const lastCell = useRef<[number, number] | null>(null);

  // 들어갈 수 있는 가장 큰 정수 칸 크기
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => {
      const { width, height } = box.getBoundingClientRect();
      setCell(Math.max(4, Math.floor(Math.min((width - 8) / sprite.width, (height - 8) / sprite.height))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [sprite.width, sprite.height]);

  // 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = sprite.width * cell;
    const h = sprite.height * cell;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 투명 칸 체크무늬
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? CHECKER_A : CHECKER_B;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }

    if (underlay) {
      ctx.globalAlpha = underlayOpacity;
      drawSprite(ctx, underlay, 0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    drawSprite(ctx, sprite, 0, 0, w, h);

    if (showGrid) {
      ctx.fillStyle = "rgba(61,44,94,0.14)";
      for (let x = 1; x < sprite.width; x++) ctx.fillRect(x * cell, 0, 1, h);
      for (let y = 1; y < sprite.height; y++) ctx.fillRect(0, y * cell, w, 1);
      // 4칸(32칸 격자는 8칸)마다 조금 진하게: 위치를 세기 쉽게
      const major = sprite.width >= 32 ? 8 : 4;
      ctx.fillStyle = "rgba(61,44,94,0.28)";
      for (let x = major; x < sprite.width; x += major) ctx.fillRect(x * cell, 0, 1, h);
      for (let y = major; y < sprite.height; y += major) ctx.fillRect(0, y * cell, w, 1);
    }

    if (symmetry) {
      ctx.fillStyle = "#e46a9f";
      const mid = Math.round(w / 2) - 1;
      for (let y = 0; y < h; y += 8) ctx.fillRect(mid, y, 2, 5);
    }

    // 마우스가 올라간 칸 표시
    if (hover) {
      const [cx, cy] = hover;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(cx * cell + 2, cy * cell + 2, cell - 4, cell - 4);
      ctx.strokeStyle = "#3d2c5e";
      ctx.strokeRect(cx * cell + 1, cy * cell + 1, cell - 2, cell - 2);
    }
  }, [sprite, underlay, underlayOpacity, cell, showGrid, symmetry, hover]);

  const cellAt = (e: PointerEvent<HTMLCanvasElement>): [number, number] => {
    // 테두리 두께(clientLeft/Top)를 빼고 안쪽 그림 영역 기준으로 계산
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left - el.clientLeft) / el.clientWidth) * sprite.width);
    const y = Math.floor(((e.clientY - rect.top - el.clientTop) / el.clientHeight) * sprite.height);
    return [Math.max(0, Math.min(sprite.width - 1, x)), Math.max(0, Math.min(sprite.height - 1, y))];
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== null) {
      // 두 번째 손가락: 핀치로 보고 붓질 취소
      const [x, y] = lastCell.current ?? cellAt(e);
      onCell("cancel", x, y);
      activePointer.current = null;
      lastCell.current = null;
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointer.current = e.pointerId;
    const c = cellAt(e);
    lastCell.current = c;
    onCell("start", c[0], c[1]);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = cellAt(e);
    if (e.pointerType === "mouse") setHover((h) => (h && h[0] === c[0] && h[1] === c[1] ? h : c));
    if (e.pointerId !== activePointer.current) return;
    const last = lastCell.current;
    if (last && last[0] === c[0] && last[1] === c[1]) return;
    lastCell.current = c;
    onCell("move", c[0], c[1]);
  };

  const onPointerEnd = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== activePointer.current) return;
    const c = lastCell.current ?? cellAt(e);
    activePointer.current = null;
    lastCell.current = null;
    onCell(e.type === "pointercancel" ? "cancel" : "end", c[0], c[1]);
  };

  return (
    <div ref={boxRef} className={styles.box}>
      <canvas
        ref={canvasRef}
        className={`${styles.canvas} ${styles[`tool_${tool}`]}`}
        style={{ width: sprite.width * cell, height: sprite.height * cell }}
        role="img"
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={() => setHover(null)}
      />
    </div>
  );
}
