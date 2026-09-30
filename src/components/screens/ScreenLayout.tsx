"use client";

import type { ReactNode } from "react";
import { IconButton } from "../ui/Button";
import { useFocusOnMount } from "../useFocusOnMount";
import styles from "./ScreenLayout.module.css";

type Props = {
  title: string;
  onBack: () => void;
  backLabel?: string;
  /** 헤더 오른쪽 주요 동작 (예: 에디터의 "완료") */
  headerAction?: ReactNode;
  /** true면 본문이 스크롤하지 않고 남은 높이를 꽉 채운다 (에디터처럼 캔버스가 늘어나는 화면) */
  fill?: boolean;
  children: ReactNode;
};

/** 메뉴형 화면 공통 틀: 상단 헤더(뒤로 · 제목 리본 · 동작) + 스크롤되는 본문 */
export function ScreenLayout({ title, onBack, backLabel = "뒤로", headerAction, fill = false, children }: Props) {
  const titleRef = useFocusOnMount<HTMLHeadingElement>();
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <IconButton icon="back" label={backLabel} onClick={onBack} className={styles.back} />
        <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
          {title}
        </h1>
        <div className={styles.action}>{headerAction}</div>
      </header>
      <main className={`${styles.body} ${fill ? styles.fill : ""}`}>{children}</main>
    </div>
  );
}
