import { DEFAULT_THEME, SCENE, type ThemeId } from "../game/themes";

/**
 * 테마를 <html data-theme>에 반영한다.
 * 저장소(IndexedDB)를 읽기 전 첫 화면에서도 같은 테마가 보이도록 localStorage에 사본을 남긴다.
 * localStorage는 편의용 사본일 뿐이고 기준 값은 SaveData.settings.theme이다.
 */
export const THEME_CACHE_KEY = "dot-jump-climb.theme";

export function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  if (theme === DEFAULT_THEME) delete root.dataset.theme;
  else root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", SCENE[theme].cssBackground);
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme);
  } catch {
    // 시크릿 모드 등: 사본을 못 남겨도 테마 적용에는 문제없다
  }
}

/** layout.tsx에서 첫 그리기 전에 실행하는 짧은 스크립트 (고정 문자열, 사용자 입력 없음) */
export const EARLY_THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_CACHE_KEY)});if(t&&t!=="${DEFAULT_THEME}"&&/^[a-z]+$/.test(t))document.documentElement.dataset.theme=t}catch(e){}`;

