"use client";

import type { CardData } from "@/share/cardRenderer";
import { ResultCard } from "./ResultCard";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { PixelIcon } from "./ui/PixelIcon";
import styles from "./GameOverDialog.module.css";

export type GameResult = {
  score: number;
  /** 이 판을 포함한 최고 기록 (같은 구분 기준) */
  best: number;
  isNew: boolean;
  /** 판 시작 때 동료 최대 인원이 1명 이상이었는지 */
  withCompanions: boolean;
  /** 결과 이미지에 그릴 것 (게임오버 순간의 배경·대열) */
  card: CardData;
};

type Props = {
  result: GameResult | null;
  onRetry: () => void;
  onEditor: () => void;
  onHome: () => void;
};

/**
 * 게임오버 (기획서 9-7, 13). 점수 → 다시 하기 → 결과 이미지(미리보기 · 저장 · 공유) → 에디터·처음으로 순서.
 */
export function GameOverDialog({ result, onRetry, onEditor, onHome }: Props) {
  return (
    <Dialog
      open={result !== null}
      title="게임 끝!"
      onClose={onHome}
      showClose={false}
      actions={
        <>
          <Button variant="primary" size="lg" icon="play" block data-autofocus onClick={onRetry}>
            다시 하기
          </Button>
          {result && <ResultCard card={result.card} />}
          <Button variant="secondary" icon="pencil" block onClick={onEditor}>
            캐릭터 만들기
          </Button>
          <Button variant="ghost" icon="back" block onClick={onHome}>
            처음으로
          </Button>
        </>
      }
    >
      {result && (
        <div className={styles.result}>
          <p className={styles.score}>
            <span className={styles.value}>{result.score}</span>
            <span className={styles.unit}>m</span>
          </p>
          <div className={styles.badges}>
            {result.isNew && (
              <span className={`${styles.badge} ${styles.new}`}>
                <PixelIcon name="crown" size={14} />
                NEW 최고 기록!
              </span>
            )}
            <span className={styles.badge}>{result.withCompanions ? "동료 있음" : "동료 없음"}</span>
          </div>
          <p className={styles.best}>
            {result.isNew ? "지금까지 가장 높이 올라갔어요!" : `최고 기록 ${result.best}m`}
          </p>
        </div>
      )}
    </Dialog>
  );
}
