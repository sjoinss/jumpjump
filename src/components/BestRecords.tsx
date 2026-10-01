"use client";

import { useId } from "react";
import { RECORD_HELP, RECORD_LABEL } from "@/lib/records";
import type { BestScores } from "@/lib/schema";
import { PixelIcon } from "./ui/PixelIcon";
import styles from "./BestRecords.module.css";

type Props = {
  best: BestScores | null;
};

/** PC 프레임 옆 최고 기록 카드: 두 줄(동료 모드 / 혼자 모드). 기록이 없으면 빈 상태 안내 */
export function BestRecords({ best }: Props) {
  const titleId = useId();
  const empty = !best || (best.withCompanions === 0 && best.solo === 0);
  return (
    <section className={styles.records} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        <span className={styles.icon}>
          <PixelIcon name="crown" size={16} />
        </span>
        최고 기록
      </h2>
      {empty ? (
        <p className={styles.empty}>아직 기록이 없어요. 첫 판을 시작해보세요!</p>
      ) : (
        <dl className={styles.list}>
          <div className={styles.row}>
            <dt>{RECORD_LABEL.withCompanions}</dt>
            <dd>{best.withCompanions}m</dd>
          </div>
          <div className={styles.row}>
            <dt>{RECORD_LABEL.solo}</dt>
            <dd>{best.solo}m</dd>
          </div>
        </dl>
      )}
      {!empty && <p className={styles.help}>{RECORD_HELP}</p>}
    </section>
  );
}
