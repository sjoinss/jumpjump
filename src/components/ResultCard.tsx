"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CONFIG } from "@/game/config";
import { blobToDataUrl, DOWNLOAD_TOAST_MS, downloadedMessage, externalBrowserUrl, isInAppBrowser, saveOrShareFile } from "@/lib/fileIO";
import { useSavedFlag } from "./useSavedFlag";
import { cardAltText, drawCard, hasImageMembers, loadCardFont, type CardData } from "@/share/cardRenderer";
import { cardFileName, exportGif, exportPng } from "@/share/exportCard";
import { CARD } from "@/share/layout";
import { useSaveData } from "./SaveProvider";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { InlineMessage } from "./ui/InlineMessage";
import { useToast } from "./ui/Toast";
import { useMediaQuery } from "./useMediaQuery";
import styles from "./ResultCard.module.css";

const PREVIEW = 184;

type GifState = { kind: "idle" } | { kind: "working"; progress: number } | { kind: "error"; message: string };

/**
 * 게임오버 결과 카드 (기획서 13번): 움직이는 미리보기 + 아래 글씨 입력 + 이미지(PNG) 저장 · GIF 저장 · 공유.
 * 미리보기와 저장 결과는 같은 렌더러(drawCard)로 그린다. 동작 줄이기면 서 있는 모습(PNG와 같은)에서 멈춘다.
 * 저장 버튼은 기기에 바로 저장(다운로드)하고, 공유는 공유 버튼으로만 한다 (사용자 요청).
 */
export function ResultCard({ card: base }: { card: CardData }) {
  // 맨 아래 글씨: 설정에 기억해 두고 다음 판에도 쓴다
  const [data, update] = useSaveData();
  const caption = data.settings.cardCaption;
  const card = useMemo(() => ({ ...base, caption }), [base, caption]);
  const captionId = useId();
  const setCaption = (v: string) =>
    update((d) => ({ ...d, settings: { ...d.settings, cardCaption: v.slice(0, CONFIG.card.captionMax) } }));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [font, setFont] = useState<string | null>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { show } = useToast();
  const [busy, setBusy] = useState<"png" | "share" | null>(null);
  const [gif, setGif] = useState<GifState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  /** 저장·공유가 다 안 되는 브라우저: 이미지를 띄우고 길게 눌러 저장하게 한다 */
  const [fallback, setFallback] = useState<{ url: string; name: string; external: string | null } | null>(null);
  const [canShare, setCanShare] = useState(false);
  /** 방금 저장한 버튼 ("png" | "gif"): 잠깐 "저장 완료"로 바꿔 연타를 막는다 */
  const { saved, mark } = useSavedFlag();

  useEffect(() => {
    let alive = true;
    void loadCardFont().then((f) => alive && setFont(f));
    try {
      const probe = new File([""], "a.png", { type: "image/png" });
      setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
    } catch {
      setCanShare(false);
    }
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, []);

  // 미리보기 애니메이션 (GIF와 같은 50ms 프레임)
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !font) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(PREVIEW * dpr);
    canvas.height = Math.round(PREVIEW * dpr);
    const k = (PREVIEW * dpr) / CARD.size;
    const draw = (frame: number | "stand") => {
      ctx.setTransform(k, 0, 0, k, 0, 0);
      drawCard(ctx, card, frame, font);
    };
    if (reducedMotion) {
      draw("stand");
      return;
    }
    let frame = 0;
    draw(frame);
    const t = setInterval(() => {
      frame = (frame + 1) % CARD.loopFrames;
      draw(frame);
    }, CARD.frameMs);
    return () => clearInterval(t);
  }, [card, font, reducedMotion]);

  // 휴대폰은 공유 창(사진에 저장 포함)이 먼저, PC는 바로 다운로드 (기획서 13-6)
  // 앱 안 브라우저는 내려받기가 안 되므로(공유 창이 뜨는 경우만 빼고) 바로 길게 눌러 저장하게 한다
  const deliver = async (blob: Blob, name: string, share: boolean, key: string) => {
    const ua = navigator.userAgent;
    if (isInAppBrowser(ua) && !(share && canShare)) {
      setFallback({ url: await blobToDataUrl(blob), name, external: externalBrowserUrl(ua, location.href) });
      return;
    }
    try {
      const r = await saveOrShareFile(blob, name, share);
      if (r === "shared") show("공유했어요!", "success");
      else if (r === "downloaded") {
        mark(key);
        show(downloadedMessage(name), "success", DOWNLOAD_TOAST_MS);
      }
    } catch {
      setFallback({ url: URL.createObjectURL(blob), name, external: null });
    }
  };

  const savePng = async (share: boolean) => {
    if (!font || busy || (!share && saved === "png")) return;
    setBusy(share ? "share" : "png");
    try {
      await deliver(await exportPng(card, font), cardFileName(card, "png"), share, "png");
    } catch (err) {
      show(`이미지를 만들지 못했어요. ${err instanceof Error ? err.message : ""} 다시 시도해주세요.`, "error");
    } finally {
      setBusy(null);
    }
  };

  const saveGif = async () => {
    if (!font || gif.kind === "working" || saved === "gif") return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setGif({ kind: "working", progress: 0 });
    try {
      const blob = await exportGif(card, font, (p) => setGif({ kind: "working", progress: p }), ctrl.signal);
      setGif({ kind: "idle" });
      await deliver(blob, cardFileName(card, "gif"), false, "gif");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setGif({ kind: "idle" });
        show("GIF 만들기를 취소했어요.", "info");
      } else {
        const why = err instanceof Error && err.message ? err.message : "알 수 없는 오류";
        setGif({ kind: "error", message: `GIF를 만들지 못했어요 (${why}). 메모리가 부족할 수 있으니 다른 앱을 닫고 다시 시도해주세요.` });
      }
    } finally {
      abortRef.current = null;
    }
  };

  const closeFallback = () => {
    if (fallback?.url.startsWith("blob:")) URL.revokeObjectURL(fallback.url);
    setFallback(null);
  };

  const working = gif.kind === "working";
  const percent = working ? Math.round(gif.progress * 100) : 0;

  return (
    <section className={styles.card} aria-label="결과 이미지">
      <canvas
        ref={canvasRef}
        className={styles.preview}
        style={{ width: PREVIEW, height: PREVIEW }}
        role="img"
        aria-label={cardAltText(card)}
      />
      <label className={styles.caption} htmlFor={captionId}>
        <span>이미지 아래 글씨</span>
        <input
          id={captionId}
          type="text"
          value={caption}
          maxLength={CONFIG.card.captionMax}
          placeholder="비우면 안 써요"
          autoComplete="off"
          onChange={(e) => setCaption(e.target.value)}
        />
      </label>
      <div className={styles.actions}>
        <Button
          variant="secondary"
          icon={saved === "png" ? "check" : "image"}
          block
          onClick={() => savePng(false)}
          loading={busy === "png"}
          loadingLabel="만드는 중"
          disabled={!font || saved === "png"}
        >
          {saved === "png" ? "저장 완료" : "이미지 저장"}
        </Button>
        {working ? (
          <div className={styles.progress}>
            <div
              className={styles.bar}
              role="progressbar"
              aria-label="GIF 만드는 중"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <span style={{ width: `${percent}%` }} />
            </div>
            <span className={styles.percent}>{percent}%</span>
            <Button variant="ghost" onClick={() => abortRef.current?.abort()}>
              취소
            </Button>
          </div>
        ) : (
          <Button variant="secondary" icon={saved === "gif" ? "check" : "download"} block onClick={saveGif} disabled={!font || saved === "gif"}>
            {saved === "gif" ? "GIF 저장 완료" : gif.kind === "error" ? "GIF 다시 시도" : "GIF 저장"}
          </Button>
        )}
        {canShare && (
          <Button variant="secondary" icon="upload" block onClick={() => savePng(true)} loading={busy === "share"} loadingLabel="여는 중" disabled={!font}>
            공유
          </Button>
        )}
      </div>

      {hasImageMembers(card) && gif.kind !== "error" && (
        <p className={styles.note}>GIF에서는 색이 단순해질 수 있어요.</p>
      )}
      {gif.kind === "error" && (
        <div className={styles.full}>
          <InlineMessage tone="error" title="GIF 저장 실패">
            {gif.message}
          </InlineMessage>
        </div>
      )}

      <Dialog
        open={fallback !== null}
        title="이미지를 길게 눌러 저장하세요"
        description="이 브라우저에서는 바로 저장할 수 없어요. 아래 이미지를 길게 누르거나 오른쪽 클릭해서 저장해주세요. 그래도 안 되면 다른 브라우저(크롬·사파리)로 열어주세요."
        onClose={closeFallback}
        actions={
          <>
            {fallback?.external && (
              <Button variant="secondary" block onClick={() => (location.href = fallback.external!)}>
                다른 브라우저로 열기
              </Button>
            )}
            <Button variant="primary" block data-autofocus onClick={closeFallback}>
              닫기
            </Button>
          </>
        }
      >
        {fallback && (
          // eslint-disable-next-line @next/next/no-img-element -- 방금 만든 결과 이미지(blob·data)를 그대로 보여준다
          <img className={styles.fallback} src={fallback.url} alt={cardAltText(card)} />
        )}
      </Dialog>
    </section>
  );
}
