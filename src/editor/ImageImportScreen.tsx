"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from "react";
import { ScreenLayout } from "@/components/screens/ScreenLayout";
import { Button } from "@/components/ui/Button";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { useMediaQuery } from "@/components/useMediaQuery";
import { CONFIG } from "@/game/config";
import { PixelPreview } from "@/components/PixelPreview";
import type { PixelSprite, Sprite } from "@/lib/schema";
import { applyBackground, encodeSprite, loadImageFile, type LoadedImage } from "./imageDom";
import { clampZoom, cornerBackground, fitToBox, imageToDotPixels, NO_ADJUST, placedRect, type Adjust } from "./imageMath";
import styles from "./ImageImportScreen.module.css";

type Props = {
  /** 에디터에 끌어다 놓은 파일이 있으면 바로 연다 */
  initialFile?: File | null;
  onCancel: () => void;
  /** 이미지 그림, 또는 도트로 바꾼 그림 */
  onDone: (sprite: Sprite) => void;
};

const BOX = CONFIG.limits.image; // 320×360
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/**
 * 이미지 불러오기 (기획서 6번): 고르기 → 상자에 맞추기·이동·확대 → 배경 제거 → 다시 인코딩해서 저장.
 * 도트 격자와 같은 크기(16×18, 32×36px)면 먼저 "도트로 바꿔서 고치기 / 이미지 그대로"를 고른다 (사용자 결정).
 */
export function ImageImportScreen({ initialFile, onCancel, onDone }: Props) {
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjust, setAdjust] = useState<Adjust>(NO_ADJUST);
  const [bgEnabled, setBgEnabled] = useState(false);
  const [tolerance, setTolerance] = useState<number>(CONFIG.imageImport.defaultTolerance);
  const [soften, setSoften] = useState(true);
  const [view, setView] = useState<"result" | "original">("result");
  const [dragOver, setDragOver] = useState(false);
  /** 도트 크기 이미지: 아직 고르는 중이면 true. "이미지 그대로"를 고르면 원래 흐름으로 */
  const [askDots, setAskDots] = useState(false);
  const [dotsBg, setDotsBg] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasMouse = useMediaQuery("(any-pointer: fine)");

  const openFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    const r = await loadImageFile(file);
    setLoading(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setLoaded(r.value);
    setAskDots(r.value.dots !== null);
    setDotsBg(!r.value.hasAlpha);
    setAdjust(NO_ADJUST);
    setView("result");
    // 이미 투명 배경이 있으면 배경 제거는 건너뛴다 (기획서 6-3)
    setBgEnabled(!r.value.hasAlpha);
  }, []);

  useEffect(() => {
    if (initialFile) void openFile(initialFile);
  }, [initialFile, openFile]);

  // 허용 오차 슬라이더를 끄는 동안 무거운 계산이 밀리지 않게 한 박자 늦춘다
  const deferredTolerance = useDeferredValue(tolerance);
  const processed = useMemo(
    () => (loaded ? applyBackground(loaded.work, { enabled: bgEnabled, tolerance: deferredTolerance, soften }) : null),
    [loaded, bgEnabled, deferredTolerance, soften],
  );

  const fit = useMemo(() => (loaded ? fitToBox(loaded.work.width, loaded.work.height, BOX.width, BOX.height) : null), [loaded]);
  const rect = fit ? placedRect(fit, adjust) : null;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void openFile(file);
  };

  const save = async () => {
    if (!processed || !rect) return;
    setSaving(true);
    setError(null);
    const r = await encodeSprite(processed, rect);
    setSaving(false);
    if (r.ok) onDone(r.value);
    else setError(r.message);
  };

  // 도트로 바꾼 결과 (미리보기와 넣기에 같이 쓴다)
  const dotsBackground = loaded?.dots ? cornerBackground(loaded.dots.rgba, loaded.dots.width, loaded.dots.height) : null;
  const dotSprite = useMemo<PixelSprite | null>(() => {
    const d = loaded?.dots;
    if (!d) return null;
    return { kind: "pixel", width: d.width, height: d.height, pixels: imageToDotPixels(d.rgba, d.width, d.height, dotsBg) };
  }, [loaded, dotsBg]);

  const chooseAgain = () => {
    setLoaded(null);
    setError(null);
    inputRef.current?.click();
  };

  return (
    <ScreenLayout title="이미지 불러오기" onBack={onCancel}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void openFile(file);
        }}
      />

      <div className={styles.body} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        {!loaded ? (
          <section
            className={`${styles.dropzone} ${dragOver ? styles.dragOver : ""}`}
            onDragEnter={() => setDragOver(true)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
            }}
            aria-labelledby="import-title"
            aria-busy={loading}
          >
            <span className={styles.dropIcon}>
              <PixelIcon name="image" size={36} />
            </span>
            <h2 id="import-title" className={styles.dropTitle}>
              캐릭터로 쓸 이미지를 골라주세요
            </h2>
            <p className={styles.helper}>PNG · JPEG · WebP · GIF(첫 장면), 10MB까지</p>
            <Button variant="primary" size="lg" icon="image" loading={loading} loadingLabel="여는 중…" onClick={() => inputRef.current?.click()}>
              파일 고르기
            </Button>
            {hasMouse && <p className={styles.helper}>여기에 파일을 끌어다 놓아도 돼요</p>}
          </section>
        ) : askDots && dotSprite ? (
          <section className={styles.dots} aria-labelledby="dots-title">
            <h2 id="dots-title" className={styles.dropTitle}>
              도트로 바꿔서 고칠까요?
            </h2>
            <div className={styles.dotsPreview}>
              <PixelPreview sprite={dotSprite} width={128} height={144} label="도트로 바꾼 미리보기" />
            </div>
            <p className={styles.helper}>
              도트 칸과 같은 크기({dotSprite.width}×{dotSprite.height}px)예요. 도트로 바꾸면 픽셀 하나가 칸 하나가 되어 펜·지우개로 직접 고칠 수
              있어요. 이미지 그대로 쓰면 고칠 수는 없어요.
            </p>
            {dotsBackground && (
              <Switch
                label="배경색 지우기"
                checked={dotsBg}
                onChange={setDotsBg}
                description="테두리와 이어진 모서리 색 칸을 비워요"
              />
            )}
            <div className={styles.actions}>
              <Button variant="ghost" onClick={() => setAskDots(false)}>
                이미지 그대로 쓰기
              </Button>
              <Button variant="primary" icon="pencil" onClick={() => onDone(dotSprite)}>
                도트로 바꿔서 고치기
              </Button>
            </div>
          </section>
        ) : (
          <>
            <section className={styles.adjust} aria-label="위치와 크기">
              <Preview
                source={view === "original" ? loaded.work : processed}
                rect={rect!}
                onMove={(dx, dy) => setAdjust((a) => ({ ...a, dx: a.dx + dx, dy: a.dy + dy }))}
              />
              <div className={styles.sideInfo}>
                <div className={styles.mini}>
                  <MiniPreview source={processed} rect={rect!} />
                  <span>게임에서</span>
                </div>
                {bgEnabled && (
                  <Segmented
                    label="보기"
                    size="sm"
                    value={view}
                    onChange={setView}
                    options={[
                      { value: "result", label: "결과" },
                      { value: "original", label: "원본" },
                    ]}
                  />
                )}
              </div>
            </section>
            <p className={styles.helper}>그림을 끌어서 옮기고, 아래에서 크기를 바꿔요. 점선 상자가 게임 속 캐릭터 칸이에요.</p>

            <div className={styles.zoomRow}>
              <Button
                variant="ghost"
                aria-label="작게"
                onClick={() => setAdjust((a) => ({ ...a, zoom: clampZoom(a.zoom - 0.1) }))}
              >
                −
              </Button>
              <label className={styles.slider}>
                <span>크기 {Math.round(adjust.zoom * 100)}%</span>
                <input
                  type="range"
                  min={CONFIG.imageImport.zoomMin * 100}
                  max={CONFIG.imageImport.zoomMax * 100}
                  step={5}
                  value={Math.round(adjust.zoom * 100)}
                  onChange={(e) => setAdjust((a) => ({ ...a, zoom: clampZoom(Number(e.target.value) / 100) }))}
                  aria-valuetext={`${Math.round(adjust.zoom * 100)}%`}
                />
              </label>
              <Button
                variant="ghost"
                aria-label="크게"
                onClick={() => setAdjust((a) => ({ ...a, zoom: clampZoom(a.zoom + 0.1) }))}
              >
                +
              </Button>
            </div>
            <Button variant="ghost" onClick={() => setAdjust(NO_ADJUST)} disabled={adjust === NO_ADJUST}>
              처음 위치로
            </Button>

            <section className={styles.bg} aria-labelledby="bg-title">
              <h2 id="bg-title" className="visually-hidden">
                배경 제거
              </h2>
              <Switch
                label="배경 제거"
                checked={bgEnabled}
                onChange={setBgEnabled}
                description={loaded.hasAlpha ? "이미 투명한 배경이 있어서 꺼 두었어요" : "테두리와 이어진 비슷한 색을 지워요"}
              />
              {bgEnabled && (
                <>
                  <label className={styles.slider}>
                    <span>허용 오차 {tolerance}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={tolerance}
                      onChange={(e) => setTolerance(Number(e.target.value))}
                      aria-describedby="tolerance-help"
                    />
                  </label>
                  <p id="tolerance-help" className={styles.helper}>
                    배경이 덜 지워지면 올리고, 캐릭터까지 지워지면 내려요.
                  </p>
                  <Switch label="가장자리 부드럽게" checked={soften} onChange={setSoften} />
                </>
              )}
              <p className={styles.helper}>배경이 단순한 사진이나 투명 PNG일 때 가장 잘 돼요.</p>
            </section>

            <InlineMessage tone="info">
              넣고 나면 위치·크기는 더 바꿀 수 없어요. 바꾸려면 이미지를 다시 불러와 주세요.
            </InlineMessage>
          </>
        )}

        {error && (
          <InlineMessage tone="error" title="이미지를 넣지 못했어요">
            {error}
          </InlineMessage>
        )}

        <p className={styles.privacy}>
          <PixelIcon name="check" size={12} /> 파일은 이 기기 안에서만 처리하고 어디에도 보내지 않아요. 원본은 저장하지 않아요.
        </p>

        {loaded && !(askDots && dotSprite) && (
          <div className={styles.actions}>
            <Button variant="ghost" onClick={chooseAgain} disabled={saving}>
              다른 이미지
            </Button>
            <Button variant="primary" icon="check" loading={saving} loadingLabel="저장 중…" onClick={save}>
              이대로 넣기
            </Button>
          </div>
        )}
      </div>
    </ScreenLayout>
  );
}

/** 저장 상자(320×360)를 그대로 보여주는 미리보기. 끌면 이미지가 움직인다 */
function Preview({
  source,
  rect,
  onMove,
}: {
  source: HTMLCanvasElement | null;
  rect: { x: number; y: number; w: number; h: number };
  onMove: (dx: number, dy: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, BOX.width, BOX.height);
    if (!source) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h);
  }, [source, rect.x, rect.y, rect.w, rect.h]);

  const toBox = (el: HTMLElement) => BOX.width / el.clientWidth;

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const k = toBox(e.currentTarget);
    onMove((e.clientX - d.x) * k, (e.clientY - d.y) * k);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  // 키보드로도 옮길 수 있게 (그리기가 아니라 위치 조정)
  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const step = e.shiftKey ? 20 : 5;
    const m: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = m[e.key];
    if (!d) return;
    e.preventDefault();
    onMove(d[0], d[1]);
  };

  return (
    <canvas
      ref={ref}
      width={BOX.width}
      height={BOX.height}
      className={styles.preview}
      tabIndex={0}
      role="img"
      aria-label="이미지 위치 미리보기. 끌거나 방향키로 옮길 수 있어요."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    />
  );
}

/** 게임에서 실제로 보이는 크기(64×72) */
function MiniPreview({ source, rect }: { source: HTMLCanvasElement | null; rect: { x: number; y: number; w: number; h: number } }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const k = 64 / BOX.width;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(64 * dpr);
    canvas.height = Math.round(72 * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 64, 72);
    if (!source) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, rect.x * k, rect.y * k, rect.w * k, rect.h * k);
  }, [source, rect.x, rect.y, rect.w, rect.h, k]);
  return <canvas ref={ref} className={styles.miniCanvas} style={{ width: 64, height: 72 }} role="img" aria-label="게임에서 보이는 크기" />;
}
