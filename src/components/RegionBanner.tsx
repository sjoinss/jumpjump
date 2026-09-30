"use client";

import styles from "./RegionBanner.module.css";

type Props = {
  /** 바뀔 때마다 배너를 새로 띄우기 위한 값 */
  id: number;
  name: string;
};

/**
 * 지역 이름 배너 (기획서 3-5): 화면 위 가운데에 이름만 약 2초. 조작을 막지 않도록 누를 수 없게 둔다.
 * 스크린리더 안내는 PlayScreen이 announce로 따로 한다. 동작 줄이기면 슬라이드 없이 페이드만.
 */
export function RegionBanner({ id, name }: Props) {
  return (
    <div key={id} className={styles.banner} aria-hidden="true">
      <span className={styles.text}>{name}</span>
    </div>
  );
}
