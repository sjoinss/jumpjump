"use client";

import { useRef, useState } from "react";
import { CONFIG } from "@/game/config";
import { COMPANION_QUESTION } from "@/game/presets";
import { companionDraftKey } from "@/editor/session";
import { useKeyValueStore, useSaveData } from "./SaveProvider";
import { SpritePreview } from "./SpritePreview";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { Segmented } from "./ui/Segmented";
import { useToast } from "./ui/Toast";
import styles from "./CompanionSettings.module.css";

type Props = {
  /** 슬롯 그리기/수정 (1~5). 에디터는 설정 화면이 위에 띄운다 */
  onEdit: (slot: number) => void;
};

const MAX_OPTIONS = Array.from({ length: CONFIG.companion.maxCount + 1 }, (_, i) => ({
  value: i,
  label: String(i),
  ariaLabel: `${i}명`,
}));

/**
 * 설정 → 동료 (기획서 7-5, 7-7, 11).
 * 동료 최대 인원(다음 판부터), 슬롯 1~5 관리(그리기·수정·삭제), 동료 그림 전부 삭제(위험).
 */
export function CompanionSettings({ onEdit }: Props) {
  const [data, update] = useSaveData();
  const kv = useKeyValueStore();
  const { show } = useToast();
  const { companionMax, companionMaxSource } = data.settings;
  const slots = data.companionSlots;
  const hasAny = slots.some((s) => s.character);
  /** 지울 슬롯 번호, "all"이면 전부 */
  const [confirm, setConfirm] = useState<number | "all" | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 같은 값으로 되돌려도 직접 설정으로 본다 (기획서 7-6)
  const setMax = (value: number) =>
    update((d) => ({ ...d, settings: { ...d.settings, companionMax: value, companionMaxSource: "user" } }));

  const remove = (target: number | "all") => {
    const all = target === "all";
    update((d) => ({
      ...d,
      companionSlots: d.companionSlots.map((s, i) => (all || i === target - 1 ? { character: null } : s)),
    }));
    // 그리다 만 초안도 함께 지운다
    const targets = all ? slots.map((_, i) => i + 1) : [target];
    for (const slot of targets) kv.delete(companionDraftKey(slot)).catch(() => {});
    setConfirm(null);
    show(all ? "동료 그림을 모두 지웠어요." : `동료 ${target}번 그림을 지웠어요.`, "info");
  };

  return (
    <section className={styles.section} aria-labelledby="companion-title">
      <h2 id="companion-title" className={styles.title}>
        동료
      </h2>

      <div className={styles.max}>
        <Segmented label="동료 최대 인원" options={MAX_OPTIONS} value={companionMax} onChange={setMax} />
        <p className={styles.help}>
          {companionMax === 0
            ? "혼자 모드: 동료 후보가 나오지 않고, 발판을 조금 더 넉넉하게 밟을 수 있어요. 기록도 혼자 모드로 따로 남아요."
            : `한 판에 동료가 ${companionMax}명까지 함께해요.`}{" "}
          바꾼 값은 다음 판부터 적용돼요.
        </p>
        {companionMaxSource === "auto" && (
          <p className={styles.auto}>자동으로 설정됨 · 동료를 여러 번 거절해서 맞췄어요</p>
        )}
      </div>

      <h3 className={styles.subTitle}>동료 슬롯</h3>
      <p className={styles.help}>게임에서 동료 후보는 1번부터 차례로 나와요. 미리 그려 두면 그 모습으로 나와요.</p>
      <ul className={styles.slots}>
        {slots.map((s, i) => {
          const slot = i + 1;
          const has = s.character !== null;
          const label = `동료 ${slot}${s.name ? ` ${s.name}` : ""}`;
          return (
            <li key={slot} className={styles.slot}>
              <span className={styles.preview}>
                <SpritePreview sprite={s.character ? s.character.frames[0] : COMPANION_QUESTION} width={40} height={45} />
              </span>
              <span className={styles.info}>
                <span className={styles.slotName}>
                  동료 {slot}
                  {s.name && <span className={styles.nickname}> · {s.name}</span>}
                </span>
                <span className={styles.state}>{has ? "그림 있음" : "비어 있음"}</span>
              </span>
              <span className={styles.actions}>
                <Button variant={has ? "secondary" : "primary"} icon={has ? "pencil" : "plus"} onClick={() => onEdit(slot)} aria-label={`${label} ${has ? "수정" : "그리기"}`}>
                  {has ? "수정" : "그리기"}
                </Button>
                {has && (
                  <Button variant="ghost" icon="trash" onClick={() => setConfirm(slot)} aria-label={`${label} 삭제`}>
                    삭제
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <Button variant="danger" icon="trash" block disabled={!hasAny} onClick={() => setConfirm("all")}>
        동료 그림 전부 삭제
      </Button>

      <Dialog
        open={confirm !== null}
        title={confirm === "all" ? "동료 그림을 모두 지울까요?" : `동료 ${confirm}번 그림을 지울까요?`}
        description="지운 그림은 되돌릴 수 없어요. 내보내기로 백업해 둔 파일이 있으면 다시 불러올 수 있어요."
        onClose={() => setConfirm(null)}
        initialFocusRef={cancelRef}
        actions={
          <>
            <Button variant="danger" block icon="trash" onClick={() => confirm !== null && remove(confirm)}>
              지우기
            </Button>
            <Button ref={cancelRef} variant="ghost" block onClick={() => setConfirm(null)}>
              취소
            </Button>
          </>
        }
      />
    </section>
  );
}
