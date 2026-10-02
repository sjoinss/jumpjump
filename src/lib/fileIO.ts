/**
 * 파일 저장·공유 (기획서 13-6, 14-1).
 * 휴대폰이면 Web Share(파일 공유)를 먼저 시도하고, 안 되면 일반 다운로드로 저장한다.
 */
export type SaveOutcome = "shared" | "downloaded" | "cancelled";

/** 내려받은 뒤 보여줄 안내 (파일 이름 + 어디서 찾는지). 휴대폰은 조용히 받아져서 꼭 알려준다 */
export function downloadedMessage(name: string) {
  return `「${name}」 저장 완료! 휴대폰은 다운로드 폴더나 파일 앱에서 볼 수 있어요.`;
}
/** 저장 안내는 길게 (파일 이름까지 읽을 시간) */
export const DOWNLOAD_TOAST_MS = 6000;

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

/**
 * 앱 안 브라우저(카카오톡·인스타그램·네이버 등, 안드로이드 WebView)인지.
 * 이런 곳은 blob: 주소를 내려받지 못해 "지원하지 않는 형식"이 뜨고, 클릭이 실패해도 오류가 나지 않는다.
 */
export function isInAppBrowser(ua: string): boolean {
  return /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|\bLine\/|NAVER\(inapp|DaumApps|everytimeApp|; wv\)/i.test(ua);
}

/** 카카오톡이면 같은 주소를 기본 브라우저로 여는 주소. 다른 앱은 null (메뉴에서 직접 열어야 한다) */
export function externalBrowserUrl(ua: string, href: string): string | null {
  if (/KAKAOTALK/i.test(ua)) return `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
  return null;
}

/** 길게 눌러 저장할 이미지 주소. 앱 안 브라우저는 blob: 이미지를 저장하지 못해서 data: 로 만든다 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * 카카오톡 안에서 열면 첫 화면 전에 기본 브라우저(크롬·사파리)로 넘긴다.
 * 카카오톡 브라우저는 결과 이미지·GIF를 저장하지 못하고, 기록·그림도 기본 브라우저와 따로 저장되기 때문.
 */
export const EARLY_KAKAO_SCRIPT = `try{if(/KAKAOTALK/i.test(navigator.userAgent))location.href="kakaotalk://web/openExternal?url="+encodeURIComponent(location.href)}catch(e){}`;
