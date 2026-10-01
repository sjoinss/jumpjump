import { GifEncoder } from "./gif";
import type { WorkerReply, WorkerRequest } from "./gif.worker";
import { hasImageMembers, renderCardCanvas, type CardData } from "./cardRenderer";
import { CARD } from "./layout";

/**
 * 결과 이미지 만들기 (기획서 13-2, 13-5).
 * PNG: 모두 발판에 서 있는 모습 1장을 3배(1080×1080)로. GIF: 32프레임 폴짝 모션을 2배(720×720)로, Web Worker에서 인코딩.
 */

export async function exportPng(d: CardData, font: string): Promise<Blob> {
  const canvas = renderCardCanvas(d, "stand", font, CARD.pngScale);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG로 바꾸지 못했어요"))), "image/png"),
  );
}

export type GifProgress = (ratio: number) => void;

/** 인코더와 주고받는 통로: Worker가 있으면 Worker, 없으면 이 화면에서 직접 (조금 느려도 동작) */
type Channel = { send(msg: WorkerRequest, transfer?: Transferable[]): Promise<WorkerReply>; close(): void };

function workerChannel(): Channel | null {
  if (typeof Worker === "undefined") return null;
  let worker: Worker;
  try {
    worker = new Worker(new URL("./gif.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
  let pending: { resolve: (r: WorkerReply) => void; reject: (e: Error) => void } | null = null;
  worker.onmessage = (e: MessageEvent<WorkerReply>) => {
    const p = pending;
    pending = null;
    if (!p) return;
    if (e.data.type === "error") p.reject(new Error(e.data.message));
    else p.resolve(e.data);
  };
  worker.onerror = (e) => {
    const p = pending;
    pending = null;
    e.preventDefault();
    p?.reject(new Error("WORKER_FAILED"));
  };
  return {
    send(msg, transfer = []) {
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        worker.postMessage(msg, transfer);
      });
    },
    close: () => worker.terminate(),
  };
}

function inlineChannel(): Channel {
  let enc: GifEncoder | null = null;
  // 한 장 처리할 때마다 화면에 숨 돌릴 틈을 준다
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return {
    async send(msg) {
      await tick();
      switch (msg.type) {
        case "start":
          enc = new GifEncoder(msg.opts);
          return { type: "ack" };
        case "sample":
          enc!.sample(new Uint8ClampedArray(msg.data));
          return { type: "ack" };
        case "frame":
          enc!.addFrame(new Uint8ClampedArray(msg.data));
          return { type: "ack" };
        case "finish": {
          const bytes = enc!.finish();
          return { type: "done", bytes: bytes.buffer as ArrayBuffer };
        }
      }
    },
    close() {
      enc = null;
    },
  };
}

function framePixels(d: CardData, frame: number, font: string, scale: number): ArrayBuffer {
  const canvas = renderCardCanvas(d, frame, font, scale);
  const ctx = canvas.getContext("2d")!;
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer as ArrayBuffer;
}

/**
 * GIF 만들기. 진행률(0~1)을 알리고, signal로 취소할 수 있다.
 * 1) 1배 크기로 전 프레임을 그려 공용 팔레트용 색을 모으고 2) 2배로 한 장씩 그려 압축한다.
 */
export async function exportGif(d: CardData, font: string, onProgress: GifProgress, signal: AbortSignal): Promise<Blob> {
  const frames = CARD.loopFrames;
  const size = CARD.size * CARD.gifScale;
  const run = async (channel: Channel) => {
    const abort = () => {
      if (signal.aborted) throw new DOMException("취소했어요", "AbortError");
    };
    try {
      abort();
      await channel.send({
        type: "start",
        opts: { width: size, height: size, delayCs: CARD.frameMs / 10, dither: hasImageMembers(d) },
      });
      const total = frames * 2;
      let done = 0;
      for (let f = 0; f < frames; f++) {
        abort();
        const data = framePixels(d, f, font, 1);
        await channel.send({ type: "sample", data }, [data]);
        onProgress(++done / total);
      }
      for (let f = 0; f < frames; f++) {
        abort();
        const data = framePixels(d, f, font, CARD.gifScale);
        await channel.send({ type: "frame", data }, [data]);
        onProgress(++done / total);
      }
      abort();
      const reply = await channel.send({ type: "finish" });
      if (reply.type !== "done") throw new Error("GIF를 마무리하지 못했어요");
      return new Blob([reply.bytes], { type: "image/gif" });
    } finally {
      channel.close();
    }
  };

  const worker = workerChannel();
  if (!worker) return run(inlineChannel());
  try {
    return await run(worker);
  } catch (err) {
    // Worker를 띄우지 못한 환경이면 이 화면에서 다시 (취소·인코딩 오류는 그대로 알린다)
    if (err instanceof Error && err.message === "WORKER_FAILED") return run(inlineChannel());
    throw err;
  }
}

/** 파일 이름: jumpjump-123m.png */
export function cardFileName(d: CardData, ext: "png" | "gif") {
  return `jumpjump-${d.score}m.${ext}`;
}
