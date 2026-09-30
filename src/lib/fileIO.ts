/**
 * 파일 저장·공유 (기획서 13-6, 14-1).
 * 휴대폰이면 Web Share(파일 공유)를 먼저 시도하고, 안 되면 일반 다운로드로 저장한다.
 */
export type SaveOutcome = "shared" | "downloaded" | "cancelled";

export async function saveOrShareFile(blob: Blob, name: string, preferShare: boolean): Promise<SaveOutcome> {
  const file = new File([blob], name, { type: blob.type });
  if (preferShare && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return "shared";
    } catch (err) {
      // 사용자가 공유 창을 닫은 경우는 조용히 끝낸다. 그 밖의 실패는 다운로드로 넘어간다
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
