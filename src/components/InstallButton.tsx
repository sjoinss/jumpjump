"use client";

import { useState } from "react";
import { buildExport, exportFileName, FULL_BACKUP_KEYS } from "@/lib/dataFile";
import { saveOrShareFile } from "@/lib/fileIO";
import { usePwa } from "./PwaProvider";
import { useSaveData } from "./SaveProvider";
import { Button, type ButtonVariant } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { InlineMessage } from "./ui/InlineMessage";
import { PixelIcon } from "./ui/PixelIcon";
import { useToast } from "./ui/Toast";
import styles from "./InstallButton.module.css";

type Props = {
  variant?: ButtonVariant;
  block?: boolean;
};

/**
 * "앱으로 설치" (기획서 16번). Android 등은 브라우저 설치 창을 띄우고, iPhone·iPad는 홈 화면에 추가하는 방법을 글로 안내한다.
 * 이미 설치했거나 설치를 도울 수 없는 브라우저면 아무것도 보여주지 않는다.
 */
export function InstallButton({ variant = "secondary", block = false }: Props) {
  const { installState, promptInstall } = usePwa();
  const [guide, setGuide] = useState(false);
  const { show } = useToast();
  if (installState !== "prompt" && installState !== "ios") return null;

  const onClick = async () => {
    if (installState === "ios") {
      setGuide(true);
      return;
    }
    const outcome = await promptInstall();
    if (outcome === "accepted") show("설치했어요! 홈 화면에서 열 수 있어요.", "success");
  };

  return (
    <>
      <Button variant={variant} icon="download" block={block} onClick={onClick}>
        앱으로 설치
      </Button>
      <IosInstallGuide open={guide} onClose={() => setGuide(false)} />
    </>
  );
}

/** iOS: 공유 → 홈 화면에 추가 안내 + 설치 전에 데이터 내보내기 (홈 화면 앱은 Safari와 저장소가 따로라서) */
export function IosInstallGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, update] = useSaveData();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  const exportAll = async () => {
    setBusy(true);
    try {
      const now = new Date();
      const blob = new Blob([JSON.stringify(buildExport(data, FULL_BACKUP_KEYS, now))], { type: "application/json" });
      const outcome = await saveOrShareFile(blob, exportFileName(now), true);
      if (outcome !== "cancelled") {
        update((d) => ({ ...d, settings: { ...d.settings, onboarding: { ...d.settings.onboarding, lastExportAt: Date.now() } } }));
        show("내보냈어요. 설치한 앱의 설정 → 데이터 관리에서 불러오세요.", "success");
      }
    } catch {
      show("파일을 만들지 못했어요. 다시 시도해주세요.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="홈 화면에 추가하기"
      onClose={onClose}
      actions={
        <Button variant="primary" block data-autofocus onClick={onClose}>
          알겠어요
        </Button>
      }
    >
      <div className={styles.guide}>
        <InlineMessage
          tone="warning"
          title="설치 전에 데이터를 내보내세요"
          action={
            <Button variant="secondary" icon="download" onClick={exportAll} loading={busy} loadingLabel="만드는 중…">
              전체 백업 내보내기
            </Button>
          }
        >
          iPhone·iPad의 홈 화면 앱은 Safari와 저장 공간이 따로예요. 지금 그림과 기록을 파일로 내보낸 뒤, 설치한 앱의 설정 →
          데이터 관리에서 불러오면 그대로 옮겨져요.
        </InlineMessage>

        <ol className={styles.steps}>
          <li>
            <span className={styles.num}>1</span>
            <span>
              Safari 아래쪽(iPad는 위쪽)의 <strong>공유 버튼</strong>
              <span className={styles.shareIcon} aria-hidden="true">
                <PixelIcon name="upload" size={16} />
              </span>
              을 눌러요
            </span>
          </li>
          <li>
            <span className={styles.num}>2</span>
            <span>
              목록에서 <strong>홈 화면에 추가</strong>를 골라요
            </span>
          </li>
          <li>
            <span className={styles.num}>3</span>
            <span>
              오른쪽 위 <strong>추가</strong>를 누르면 끝!
            </span>
          </li>
        </ol>
      </div>
    </Dialog>
  );
}
