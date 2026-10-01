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
  /** 그림 없음: 그리기로 / 그림 있음: 바로 미니게임 */
  onYes: () => void;
  /** 그림 있음: 고쳐 그린 뒤 미니게임 */
  onEdit: () => void;
  onNo: () => void;
  /** Esc·닫기: 거절로 세지 않고 닫기만 */
  onDismiss: () => void;
};

/**
 * 동료 후보 선택창 (기획서 7-3, 7-4). 게임은 멈춰 있다.
 * 그림 없음 → "동료를 만드시겠습니까?" / 그림 있음 → "이 동료와 함께하시겠습니까?"
 * 그림이 없으면 "예" → 그리기 → 미니게임, 있으면 "예" → 미니게임 / "수정하기" → 고쳐 그리기 → 미니게임 (기획서 7-3).
 * 미니게임에 성공해야 합류한다 (미리 그려 둔 동료도 마찬가지).
 */
export function CompanionPrompt({ prompt, onYes, onEdit, onNo, onDismiss }: Props) {
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
            {character ? "예" : "예, 그릴래요"}
          </Button>
          {character && (
            <Button variant="secondary" icon="pencil" block onClick={onEdit}>
              수정하기
            </Button>
          )}
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
            {character
              ? "미니게임에 성공하면 함께해요. 미니게임은 한 번만 할 수 있어요."
              : "그림을 완성하고 미니게임에 성공하면 함께해요. 그리는 동안 게임은 멈춰 있어요."}
          </InlineMessage>
        </div>
      )}
    </Dialog>
  );
}
