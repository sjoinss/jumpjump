"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import { useSavedFlag } from "@/components/useSavedFlag";
import { DOWNLOAD_TOAST_MS, downloadedMessage, isInAppBrowser, saveOrShareFile } from "@/lib/fileIO";
import type { PixelSprite } from "@/lib/schema";
import { PNG_SIZES, pngLayout, spriteToPng, type PngSize } from "./pngExport";
import styles from "./EditorScreen.module.css";

type Props = {
  /** 지금 보고 있는 도트 그림 (이미지 그림이면 null → 안내만) */
  sprite: PixelSprite | null;
  platform: boolean;
  /** 안내에 쓰는 이름 (예: "캐릭터 기본 모습") */
  label: string;
  /** 파일 이름 앞부분 (예: "jumpjump-character-base") */
  fileBase: string;
};

/** 도트 그림을 배경이 투명한 PNG로 저장 (64·128·256·512). 저장하면 버튼이 잠깐 "저장 완료"로 바뀐다 */
export function PngSaveSection({ sprite, platform, label, fileBase }: Props) {
  const titleId = useId();
  const [size, setSize] = useState<PngSize>(256);
  const [busy, setBusy] = useState(false);
  const { saved, mark } = useSavedFlag();
  const { show } = useToast();

  const save = async () => {
    if (!sprite || busy || saved) return;
    if (isInAppBrowser(navigator.userAgent)) {
      show("이 앱 안 브라우저에서는 파일을 저장할 수 없어요. 크롬이나 사파리로 열어주세요.", "warning", DOWNLOAD_TOAST_MS);
      return;
    }
    setBusy(true);
    try {
      const name = `${fileBase}-${size}px.png`;
      const outcome = await saveOrShareFile(await spriteToPng(sprite, size, platform), name, false);
      if (outcome === "downloaded") {
        mark("png");
        show(downloadedMessage(name), "success", DOWNLOAD_TOAST_MS);
      }
    } catch {
      show("PNG를 만들지 못했어요. 다시 시도해주세요.", "error");
    } finally {
      setBusy(false);
    }
  };

  const l = sprite ? pngLayout(sprite, size, platform) : null;
  return (
    <section className={styles.dialogSection} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.dialogHeading}>
        PNG로 저장 (배경 투명)
      </h3>
      {sprite && l ? (
        <>
          <Segmented label="크기" value={size} options={PNG_SIZES.map((s) => ({ value: s, label: `${s}` }))} onChange={setSize} size="sm" />
          <Button variant="secondary" icon={saved ? "check" : "download"} block loading={busy} loadingLabel="만드는 중…" disabled={saved !== null} onClick={save}>
            {saved ? "저장 완료" : `${l.width}×${l.height} PNG 저장`}
          </Button>
          <p className={styles.helper}>
            지금 보고 있는 {label} 그림만 배경 없이 저장해요.{" "}
            {platform ? "" : `도트가 흐려지지 않게 ${l.scale}배로 키워 가운데에 둬요.`}
          </p>
        </>
      ) : (
        <p className={styles.helper}>불러온 이미지 그림은 PNG로 저장할 수 없어요. 도트로 그린 그림만 저장돼요.</p>
      )}
    </section>
  );
}
