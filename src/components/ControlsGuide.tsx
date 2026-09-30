"use client";

import type { ReactNode } from "react";
import type { Sprite } from "@/lib/schema";
import { SpritePreview } from "./SpritePreview";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { PixelIcon, type PixelIconName } from "./ui/PixelIcon";
import { useMediaQuery } from "./useMediaQuery";
import styles from "./ControlsGuide.module.css";

type Props = {
  open: boolean;
  hero: Sprite;
  /** "알겠어요, 시작!" */
  onStart: () => void;
  /** 닫기(✕)·ESC: 시작하지 않고 시작 화면으로 */
  onClose: () => void;
};

/**
 * 첫 판을 시작할 때 한 번만 보여주는 조작법 안내 (기획서 10-2, 17).
 * 터치 기기는 드래그, 마우스·키보드가 있는 기기는 키·마우스 안내를 보여준다. 둘 다 있으면 둘 다.
 */
export function ControlsGuide({ open, hero, onStart, onClose }: Props) {
  const touch = useMediaQuery("(any-pointer: coarse)");
  const fine = useMediaQuery("(any-pointer: fine)");
  // 판별이 안 되는 환경(둘 다 false)은 PC 안내로
  const showPc = fine || !touch;

  return (
    <Dialog
      open={open}
      title="이렇게 놀아요"
      onClose={onClose}
      actions={
        <Button variant="primary" size="lg" icon="play" block data-autofocus onClick={onStart}>
          알겠어요, 시작!
        </Button>
      }
    >
      <div className={styles.guide}>
      {/* 캐릭터가 발판 위에서 좌우로 움직이는 작은 그림 */}
      <div className={styles.stage} aria-hidden="true">
        <div className={styles.runner}>
          <SpritePreview sprite={hero} width={32} height={36} />
        </div>
        <div className={styles.floor} />
        {touch && !showPc && (
          <div className={styles.finger}>
            <PixelIcon name="hand" size={28} />
          </div>
        )}
      </div>

      <div className={styles.ways}>
        {touch && (
          <Way icon="hand" title="화면을 누른 채 좌우로 끌기">
            손가락이 움직인 만큼 캐릭터가 따라와요.
          </Way>
        )}
        {showPc && (
          <>
            <Way
              keys={
                <span className={styles.keys}>
                  <kbd>←</kbd>
                  <kbd>→</kbd>
                  <span className={styles.or}>또는</span>
                  <kbd>A</kbd>
                  <kbd>D</kbd>
                </span>
              }
              title="방향키로 움직이기"
            >
              누르고 있으면 점점 빨라져요.
            </Way>
            <Way icon="mouse" title="마우스를 좌우로 움직이기">
              클릭하지 않아도 마우스를 따라와요.
            </Way>
          </>
        )}
      </div>

      <ul className={styles.rules}>
        <li>
          <PixelIcon name="arrowUp" size={16} />
          발판에 닿으면 자동으로 점프해요
        </li>
        <li>
          <PixelIcon name="star" size={16} />
          처음 밟은 발판마다 1점
        </li>
        <li>
          <PixelIcon name="fall" size={16} />
          화면 아래로 떨어지면 끝
        </li>
        {showPc && (
          <li>
            <PixelIcon name="pause" size={16} />
            <span>
              <kbd>Esc</kbd> · <kbd>P</kbd> 일시정지
            </span>
          </li>
        )}
      </ul>
      </div>
    </Dialog>
  );
}

function Way({
  icon,
  keys,
  title,
  children,
}: {
  icon?: PixelIconName;
  keys?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.way}>
      <span className={styles.wayIcon}>{keys ?? (icon && <PixelIcon name={icon} size={22} />)}</span>
      <span className={styles.wayText}>
        <strong>{title}</strong>
        <span>{children}</span>
      </span>
    </div>
  );
}
