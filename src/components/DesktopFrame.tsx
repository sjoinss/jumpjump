"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { CONFIG } from "@/game/config";
import { computeFrameLayout, type FrameLayout } from "@/game/viewport";
import styles from "./DesktopFrame.module.css";

type Props = {
  children: ReactNode;
  /** PC 좌우 여백에 보여줄 정보 (최고 기록, 앱 설치). 공간이 없으면 숨긴다 */
  side?: ReactNode;
};

function readLayout(): FrameLayout {
  return computeFrameLayout(window.innerWidth, window.innerHeight);
}

/**
 * 앱 셸. 480px 이하면 화면 전체, 넓으면 가운데 세로 프레임 + 밝은 파스텔 배경.
 * 프레임 크기는 배율 0.5 단위로 스냅해서 게임 도트가 흐려지지 않게 한다.
 */
export function DesktopFrame({ children, side }: Props) {
  const [layout, setLayout] = useState<FrameLayout | null>(null);

  useEffect(() => {
    const update = () => setLayout(readLayout());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const desktop = layout?.mode === "desktop";
  const frameStyle: CSSProperties | undefined = desktop
    ? { width: layout.frameWidth, height: layout.frameHeight }
    : undefined;

  return (
    <div
      className={`${styles.shell} ${desktop ? styles.desktop : styles.mobile}`}
      data-sides={desktop && layout.showSides && side ? "true" : undefined}
    >
      {desktop && <PixelDecor />}
      {desktop && layout.showSides && side && (
        <aside
          className={styles.side}
          aria-label="기록과 앱 설치"
          style={{
            left: `calc(50% + ${layout.frameWidth / 2 + CONFIG.view.desktopGutter}px)`,
            width: CONFIG.view.desktopSideWidth,
          }}
        >
          {side}
        </aside>
      )}
      <div className={styles.frame} style={frameStyle}>
        {layout ? children : null}
      </div>
    </div>
  );
}

/** 배경 장식용 도트 구름·별. 정보는 담지 않으므로 스크린리더에서 숨긴다 */
function PixelDecor() {
  return (
    <div className={styles.decor} aria-hidden="true">
      <span className={`${styles.cloud} ${styles.cloudA}`} />
      <span className={`${styles.cloud} ${styles.cloudB}`} />
      <span className={`${styles.cloud} ${styles.cloudC}`} />
      <span className={`${styles.star} ${styles.starA}`} />
      <span className={`${styles.star} ${styles.starB}`} />
      <span className={`${styles.star} ${styles.starC}`} />
      <span className={`${styles.grass} ${styles.grassA}`} />
      <span className={`${styles.grass} ${styles.grassB}`} />
    </div>
  );
}
