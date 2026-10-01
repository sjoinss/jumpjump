"use client";

import { COMPANION_QUESTION } from "@/game/presets";
import type { CompanionSlot } from "@/lib/schema";
import { SpritePreview } from "./SpritePreview";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { InlineMessage } from "./ui/InlineMessage";
import styles from "./CompanionPrompt.module.css";

type Props = {
  /** 열려 있으면 합류할 슬롯 번호(1~5)와 그 슬롯 */
  prompt: { slot: number; data: CompanionSlot } | null;
  onYes: () => void;
  onNo: () => void;
  /** Esc·닫기: 거절로 세지 않고 닫기만 */
  onDismiss: () => void;
};

/**
 * 동료 후보 선택창 (기획서 7-3, 7-4). 게임은 멈춰 있다.
 * 그림 없음 → "동료를 만드시겠습니까?" / 그림 있음 → "이 동료와 함께하시겠습니까?"
 * 10단계(동료 그리기)·11단계(미니게임) 전까지 "예"는 바로 합류한다.
 */
export function CompanionPrompt({ prompt, onYes, onNo, onDismiss }: Props) {
  const character = prompt?.data.character ?? null;
  const name = prompt?.data.name;
  const title = character ? "이 동료와 함께하시겠습니까?" : "동료를 만드시겠습니까?";

  return (
    <Dialog
      open={prompt !== null}
      title={title}
      onClose={onDismiss}
      showClose={false}
      actions={
        <>
          <Button variant="primary" size="lg" icon="check" block data-autofocus onClick={onYes}>
            예
          </Button>
          <Button variant="ghost" block onClick={onNo}>
            아니오
          </Button>
        </>
      }
    >
      {prompt && (
        <div className={styles.body}>
          <div className={styles.bubble}>
            <SpritePreview
              sprite={character ? character.frames[0] : COMPANION_QUESTION}
              width={64}
              height={72}
              label={character ? `동료 후보: ${name ?? `동료 ${prompt.slot}`}` : "동료 후보: 아직 그림 없음"}
            />
          </div>
          <p className={styles.slot}>
            동료 {prompt.slot}번 자리
            {name && <span className={styles.name}> · {name}</span>}
          </p>
          <InlineMessage tone="info">
            동료 그리기와 미니게임은 곧 추가돼요. 지금은 &quot;예&quot;를 누르면 바로 합류해요.
          </InlineMessage>
        </div>
      )}
    </Dialog>
  );
}
