"use client";

import { useEffect, useRef, useState } from "react";
import { verifyImages } from "@/lib/imageVerify";
import { POSES, type Character } from "@/lib/schema";
import { buildShareLink, parseShareBody, readShareHash } from "@/lib/shareLink";
import { isPresetHero, POSE_INFO } from "@/lib/character";
import { companionDraftKey } from "@/editor/session";
import { useKeyValueStore, useSaveData } from "./SaveProvider";
import { SpritePreview } from "./SpritePreview";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { useToast } from "./ui/Toast";
import { useMediaQuery } from "./useMediaQuery";
import styles from "./ShareCharacter.module.css";

/** 게임 주소 (# 없이). GitHub Pages의 /jumpjump/ 같은 하위 경로도 그대로 */
const gameUrl = () => `${location.origin}${location.pathname}`;

/**
 * 설정 → 캐릭터: "링크로 보내기". 휴대폰은 공유 창, 아니면 클립보드 복사.
 * 둘 다 안 되면 링크를 직접 복사할 수 있게 창에 보여준다.
 */
export function ShareHeroButton() {
  const [data] = useSaveData();
  const { show } = useToast();
  const touch = useMediaQuery("(pointer: coarse)");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const share = async () => {
    setBusy(true);
    try {
      const r = await buildShareLink(data.hero, gameUrl());
      if (!r.ok) {
        show(r.error, "warning");
        return;
      }
      const url = r.value;
      if (touch && typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "점프점프 캐릭터", text: "내가 그린 점프점프 캐릭터예요!", url });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        show("링크를 복사했어요. 친구에게 붙여 보내 주세요.", "success");
      } catch {
        setManual(url);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" icon="upload" block disabled={busy} onClick={share}>
        캐릭터 링크로 보내기
      </Button>
      <Dialog
        open={manual !== null}
        title="링크를 복사해 주세요"
        description="자동 복사가 안 돼요. 아래 링크를 길게 누르거나 전체 선택해서 복사해 주세요."
        onClose={() => setManual(null)}
        initialFocusRef={inputRef}
        actions={
          <Button variant="primary" block onClick={() => setManual(null)}>
            닫기
          </Button>
        }
      >
        <input
          ref={inputRef}
          className={styles.link}
          readOnly
          value={manual ?? ""}
          aria-label="공유 링크"
          onFocus={(e) => e.currentTarget.select()}
        />
      </Dialog>
    </>
  );
}

/**
 * 주소에 공유 캐릭터(#c=…)가 담겨 열렸으면: 검사 → "친구가 보낸 캐릭터" 창.
 * 동료 빈자리에 데려오거나 주인공으로 쓴다. 주소의 # 부분은 바로 지워서 새로고침해도 다시 묻지 않는다.
 */
export function ReceivedCharacter() {
  const [data, update] = useSaveData();
  const kv = useKeyValueStore();
  const { show } = useToast();
  const [received, setReceived] = useState<Character | null>(null);

  useEffect(() => {
    // 주소는 한 번만 읽는다 (개발 모드에서 효과가 두 번 돌아도 두 번째엔 # 부분이 이미 지워져 있어 그냥 끝난다)
    const body = readShareHash(location.hash);
    if (!body) return;
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    void (async () => {
      const parsed = await parseShareBody(body);
      if (!parsed.ok) {
        show(parsed.error, "error");
        return;
      }
      // 이미지 모습은 파일 불러오기처럼 실제로 열어 보고 새로 인코딩한 것만 쓴다
      const verified = await verifyImages({ hero: parsed.value });
      if (!verified.ok || !verified.value.hero) show(verified.ok ? "캐릭터를 열 수 없어요" : verified.error, "error");
      else setReceived(verified.value.hero);
    })();
  }, [show]);

  const emptySlot = data.companionSlots.findIndex((s) => !s.character);
  const replacesHero = !isPresetHero(data.hero);
  const close = () => setReceived(null);

  return (
    <Dialog
      open={received !== null}
      title="친구가 보낸 캐릭터예요"
      description="동료로 데려오거나 내 캐릭터로 쓸 수 있어요."
      onClose={close}
      actions={
        <div className={styles.actions}>
          <Button
            variant="primary"
            icon="plus"
            block
            data-autofocus
            disabled={emptySlot < 0}
            aria-describedby={emptySlot < 0 ? "received-full" : undefined}
            onClick={() => {
              if (!received || emptySlot < 0) return;
              update((d) => ({
                ...d,
                companionSlots: d.companionSlots.map((s, i) => (i === emptySlot ? { character: received } : s)),
              }));
              // 그 빈자리에 그리다 만 초안이 있으면 지운다 (받은 그림 대신 초안이 열리지 않게)
              kv.delete(companionDraftKey(emptySlot + 1)).catch(() => {});
              show(`동료 ${emptySlot + 1}번 자리에 넣었어요. 게임에서 만나면 함께할 수 있어요.`, "success");
              close();
            }}
          >
            동료로 데려오기
          </Button>
          <Button
            icon="check"
            block
            aria-describedby={replacesHero ? "received-replace" : undefined}
            onClick={() => {
              if (!received) return;
              update((d) => ({ ...d, hero: received }));
              show("내 캐릭터를 바꿨어요.", "success");
              close();
            }}
          >
            내 캐릭터로 쓰기
          </Button>
          <Button variant="ghost" block onClick={close}>
            그냥 닫기
          </Button>
        </div>
      }
    >
      {received && (
        <div className={styles.received}>
          <ul className={styles.poses}>
            {POSES.filter((p) => received[p]).map((p) => (
              <li key={p} className={styles.pose}>
                <span className={styles.preview}>
                  <SpritePreview sprite={received[p]!} width={64} height={72} label={`${POSE_INFO[p].name} 모습`} />
                </span>
                <span className={styles.poseName}>{POSE_INFO[p].name}</span>
              </li>
            ))}
          </ul>
          {emptySlot < 0 && (
            <p id="received-full" className={styles.note}>
              동료 자리 5칸이 다 찼어요. 설정 → 동료에서 한 칸을 비우면 데려올 수 있어요.
            </p>
          )}
          {replacesHero && (
            <p id="received-replace" className={styles.note}>
              &quot;내 캐릭터로 쓰기&quot;를 누르면 지금 그린 내 캐릭터는 이 그림으로 바뀌어요.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
