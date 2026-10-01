import { GifEncoder, type GifOptions } from "./gif";

/**
 * GIF 인코딩 Web Worker (기획서 13-5). 메인 화면이 멈추지 않게 압축은 여기서 한다.
 * 메시지마다 "ack"로 답해서, 보내는 쪽이 한 장씩 차례로 보내게 한다 (프레임이 쌓여 메모리가 커지지 않게).
 */

export type WorkerRequest =
  | { type: "start"; opts: GifOptions }
  | { type: "sample"; data: ArrayBuffer }
  | { type: "frame"; data: ArrayBuffer }
  | { type: "finish" };

export type WorkerReply = { type: "ack" } | { type: "done"; bytes: ArrayBuffer } | { type: "error"; message: string };

type Scope = {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (msg: WorkerReply, transfer?: Transferable[]) => void;
};

const scope = self as unknown as Scope;
let encoder: GifEncoder | null = null;

scope.onmessage = (e) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case "start":
        encoder = new GifEncoder(msg.opts);
        scope.postMessage({ type: "ack" });
        break;
      case "sample":
        encoder!.sample(new Uint8ClampedArray(msg.data));
        scope.postMessage({ type: "ack" });
        break;
      case "frame":
        encoder!.addFrame(new Uint8ClampedArray(msg.data));
        scope.postMessage({ type: "ack" });
        break;
      case "finish": {
        const bytes = encoder!.finish();
        encoder = null;
        const buf = bytes.buffer as ArrayBuffer;
        scope.postMessage({ type: "done", bytes: buf }, [buf]);
        break;
      }
    }
  } catch (err) {
    scope.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
