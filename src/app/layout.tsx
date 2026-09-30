import type { Metadata, Viewport } from "next";
import { Jua } from "next/font/google";
import type { ReactNode } from "react";
import { EARLY_THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

/** GitHub Pages 같은 하위 경로 배포용 접두사 (로컬은 "") */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// 앱에 번들하는 폰트 1종 (빌드 때 내려받아 같이 배포된다. 외부 요청 없음)
const jua = Jua({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-jua" });

export const metadata: Metadata = {
  title: "점프점프",
  description: "내가 그린 도트 캐릭터로 끝없이 올라가는 점프 게임",
  manifest: `${BASE}/manifest.webmanifest`,
  applicationName: "점프점프",
  appleWebApp: {
    capable: true,
    title: "점프점프",
    // iOS 홈 화면 앱: 상태바를 투명하게 해서 그 뒤까지 게임 화면을 채운다
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: `${BASE}/icons/icon-192.png`, sizes: "192x192", type: "image/png" }],
    apple: [{ url: `${BASE}/icons/apple-touch-icon.png`, sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff4f8",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // 첫 그리기 전 스크립트가 data-theme을 붙이므로 서버 HTML과 달라도 경고하지 않게 한다
    <html lang="ko" className={jua.variable} suppressHydrationWarning>
      <head>
        {/* 고정 문자열 스크립트: 저장된 테마를 첫 화면부터 적용 (깜빡임 방지) */}
        <script dangerouslySetInnerHTML={{ __html: EARLY_THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
