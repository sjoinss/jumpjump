"use client";

import { useRef, useState, type DragEvent } from "react";
import { DRAFT_KEY } from "@/editor/session";
import { THEMES } from "@/game/themes";
import {
  applyImport,
  buildExport,
  DATA_KEYS,
  DATA_LABEL,
  DEFAULT_EXPORT_KEYS,
  exportFileName,
  exportHasImages,
  FULL_BACKUP_KEYS,
  parseImport,
  type DataKey,
  type ParsedImport,
} from "@/lib/dataFile";
import { DOWNLOAD_TOAST_MS, downloadedMessage, saveOrShareFile } from "@/lib/fileIO";
import { formatScore, RECORD_LABEL } from "@/lib/records";
import { verifyImages } from "@/lib/imageVerify";
import type { SaveData } from "@/lib/schema";
import { PixelPreview } from "./PixelPreview";
import { useKeyValueStore, useSaveData } from "./SaveProvider";
import { SpritePreview } from "./SpritePreview";
import { Button } from "./ui/Button";
import { Checkbox } from "./ui/Checkbox";
import { Dialog } from "./ui/Dialog";
import { InlineMessage } from "./ui/InlineMessage";
import { useToast } from "./ui/Toast";
import { useMediaQuery } from "./useMediaQuery";
import styles from "./DataManager.module.css";

function formatDate(d: Date | number) {
  return new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * 설정 → 데이터 관리 (기획서 14번): JSON 내보내기 / 불러오기.
 * 불러오기는 검증 → 이미지 재인코딩 → 미리보기·항목 선택 → 덮어쓰기 확인 순서이고, 전부 되거나 전부 취소된다.
 */
export function DataManager() {
  const [data, update] = useSaveData();
  const kv = useKeyValueStore();
  const { show } = useToast();
  const touch = useMediaQuery("(pointer: coarse)");
  const fine = useMediaQuery("(any-pointer: fine)");
  const inputRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pending, setPending] = useState<ParsedImport | null>(null);

  const lastExport = data.settings.onboarding.lastExportAt;

  const readFile = async (file: File) => {
    setImportError(null);
    setChecking(true);
    try {
      const parsed = parseImport(await file.text());
      if (!parsed.ok) {
        setImportError(parsed.error);
        return;
      }
      const verified = await verifyImages(parsed.value.data);
      if (!verified.ok) {
        setImportError(verified.error);
        return;
      }
      setPending({ ...parsed.value, data: verified.value });
    } catch {
      setImportError("파일을 읽을 수 없어요. 다시 시도해주세요.");
    } finally {
      setChecking(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  return (
    <section className={styles.section} aria-labelledby="data-title" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <h2 id="data-title" className={styles.title}>
        데이터 관리
      </h2>
      <p className={styles.help}>
        그림과 기록은 이 브라우저에만 저장돼요. 브라우저가 저장 공간을 비우면 사라질 수 있으니, 가끔 내보내서 보관해 두세요.
        다른 기기로 옮길 때도 이 파일을 쓰면 돼요.
      </p>
      <p className={styles.last}>{lastExport ? `마지막 내보내기: ${formatDate(lastExport)}` : "아직 내보낸 적이 없어요."}</p>

      <div className={styles.buttons}>
        <Button variant="secondary" icon="download" onClick={() => setExportOpen(true)}>
          내보내기
        </Button>
        <Button variant="secondary" icon="upload" loading={checking} loadingLabel="확인 중…" onClick={() => inputRef.current?.click()}>
          불러오기
        </Button>
      </div>
      {fine && <p className={styles.help}>불러올 파일을 이 칸에 끌어다 놓아도 돼요.</p>}

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void readFile(file);
        }}
      />

      {importError && (
        <InlineMessage tone="error" title="불러오지 못했어요 · 지금 데이터는 그대로예요">
          {importError}
        </InlineMessage>
      )}

      <ExportDialog
        open={exportOpen}
        data={data}
        preferShare={touch}
        onClose={() => setExportOpen(false)}
        onExported={(outcome, name) => {
          setExportOpen(false);
          update((d) => ({ ...d, settings: { ...d.settings, onboarding: { ...d.settings.onboarding, lastExportAt: Date.now() } } }));
          if (outcome === "shared") show("공유했어요.", "success");
          else show(downloadedMessage(name), "success", DOWNLOAD_TOAST_MS);
        }}
      />

      <ImportDialog
        parsed={pending}
        onCancel={() => setPending(null)}
        onApply={(keys) => {
          const imp = pending!;
          update((d) => applyImport(d, imp.data, keys));
          // 가져온 그림으로 바꿨는데 예전 임시 저장본이 남아 있으면 헷갈리므로 지운다
          if (keys.includes("hero") || keys.includes("platforms")) kv.delete(DRAFT_KEY).catch(() => {});
          setPending(null);
          show(`${keys.map((k) => DATA_LABEL[k]).join(", ")}을(를) 불러왔어요.`, "success");
        }}
      />
    </section>
  );
}

// ── 내보내기 ──

function ExportDialog({
  open,
  data,
  preferShare,
  onClose,
  onExported,
}: {
  open: boolean;
  data: SaveData;
  preferShare: boolean;
  onClose: () => void;
  onExported: (outcome: "shared" | "downloaded", name: string) => void;
}) {
  const [keys, setKeys] = useState<DataKey[]>(DEFAULT_EXPORT_KEYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasImages = exportHasImages(data, keys);

  const toggle = (k: DataKey, on: boolean) =>
    setKeys((prev) => DATA_KEYS.filter((x) => (x === k ? on : prev.includes(x))));

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const now = new Date();
      const blob = new Blob([JSON.stringify(buildExport(data, keys, now))], { type: "application/json" });
      const name = exportFileName(now);
      const outcome = await saveOrShareFile(blob, name, preferShare);
      if (outcome !== "cancelled") onExported(outcome, name);
    } catch {
      setError("파일을 만들지 못했어요. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="내보내기"
      onClose={onClose}
      actions={
        <>
          <Button variant="primary" icon="download" block loading={busy} loadingLabel="만드는 중…" disabled={keys.length === 0} onClick={run}>
            {preferShare ? "파일로 저장·공유" : "파일로 저장"}
          </Button>
          {keys.length === 0 && <p className={styles.reason}>내보낼 항목을 하나 이상 골라주세요.</p>}
        </>
      }
    >
      <div className={styles.presets}>
        <button type="button" className={styles.preset} aria-pressed={same(keys, DEFAULT_EXPORT_KEYS)} onClick={() => setKeys(DEFAULT_EXPORT_KEYS)}>
          그림만
        </button>
        <button type="button" className={styles.preset} aria-pressed={same(keys, FULL_BACKUP_KEYS)} onClick={() => setKeys(FULL_BACKUP_KEYS)}>
          전체 백업 (기기 옮길 때)
        </button>
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>내보낼 항목</legend>
        {DATA_KEYS.map((k) => (
          <Checkbox key={k} label={DATA_LABEL[k]} checked={keys.includes(k)} onChange={(on) => toggle(k, on)} detail={summary(data, k)} />
        ))}
      </fieldset>

      {hasImages && (
        <InlineMessage tone="warning" title="불러온 이미지가 포함돼요">
          사람 사진이 있다면 공유 전에 확인하세요. 빼고 싶으면 캐릭터나 동료 그림 체크를 풀어주세요.
        </InlineMessage>
      )}
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
    </Dialog>
  );
}

function same(a: readonly DataKey[], b: readonly DataKey[]) {
  return a.length === b.length && a.every((k) => b.includes(k));
}

/** 항목 옆 짧은 설명 */
function summary(d: Partial<SaveData>, k: DataKey) {
  switch (k) {
    case "hero":
      return d.hero && <SpritePreview sprite={d.hero.base} width={24} height={27} />;
    case "platforms":
      return (
        d.platforms && (
          <>
            <PixelPreview sprite={d.platforms.basic} width={32} height={8} />
            <PixelPreview sprite={d.platforms.highJump} width={32} height={8} />
            <PixelPreview sprite={d.platforms.oneTime} width={32} height={8} />
            <PixelPreview sprite={d.platforms.moving} width={32} height={8} />
          </>
        )
      );
    case "companionSlots":
      return d.companionSlots && `그림 ${d.companionSlots.filter((s) => s.character).length}개`;
    case "savedCharacters":
      return d.savedCharacters && `${d.savedCharacters.length}개`;
    case "savedPlatforms":
      return d.savedPlatforms && `${d.savedPlatforms.length}세트`;
    case "palette":
      return d.palette && `색 ${d.palette.length}개`;
    case "settings":
      return d.settings && `${THEMES[d.settings.theme].name} · 동료 최대 ${d.settings.companionMax}명`;
    case "best":
      return d.best && `${RECORD_LABEL.withCompanions} ${formatScore(d.best.withCompanions)}m · ${RECORD_LABEL.solo} ${formatScore(d.best.solo)}m`;
  }
}

// ── 불러오기 ──

function ImportDialog({
  parsed,
  onCancel,
  onApply,
}: {
  parsed: ParsedImport | null;
  onCancel: () => void;
  onApply: (keys: DataKey[]) => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [keys, setKeys] = useState<DataKey[]>([]);
  const [shownFor, setShownFor] = useState<ParsedImport | null>(null);

  // 새 파일이 오면 들어 있는 항목을 모두 체크한 상태로 시작
  if (parsed && parsed !== shownFor) {
    setShownFor(parsed);
    setKeys(parsed.keys);
  }

  const toggle = (k: DataKey, on: boolean) => setKeys((prev) => DATA_KEYS.filter((x) => (x === k ? on : prev.includes(x))));

  return (
    <Dialog
      open={parsed !== null}
      title="불러오기"
      description={parsed?.exportedAt ? `${formatDate(parsed.exportedAt)}에 내보낸 파일이에요.` : "이 게임에서 내보낸 파일이에요."}
      onClose={onCancel}
      initialFocusRef={cancelRef}
      actions={
        <>
          <Button variant="danger" block disabled={keys.length === 0} onClick={() => onApply(keys)}>
            선택한 항목 덮어쓰기
          </Button>
          <Button ref={cancelRef} variant="ghost" block onClick={onCancel}>
            취소
          </Button>
        </>
      }
    >
      {parsed && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>가져올 항목</legend>
          {parsed.keys.map((k) => (
            <Checkbox key={k} label={DATA_LABEL[k]} checked={keys.includes(k)} onChange={(on) => toggle(k, on)} detail={summary(parsed.data as Partial<SaveData>, k)} />
          ))}
        </fieldset>
      )}
      <InlineMessage tone="warning" title="선택한 항목을 덮어씁니다">
        지금 이 기기에 있는 같은 항목은 되돌릴 수 없어요. 걱정되면 먼저 내보내기를 해두세요.
      </InlineMessage>
    </Dialog>
  );
}
