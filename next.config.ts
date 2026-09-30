import type { NextConfig } from "next";

// GitHub Pages(https://<계정>.github.io/jumpjump/)처럼 하위 경로에 올릴 때만 배포 워크플로가
// PAGES_BASE_PATH=/jumpjump 를 넣어준다. 로컬 개발(npm run dev)은 루트(/)에서 돈다.
const basePath = process.env.PAGES_BASE_PATH ?? "";

// 서버 기능 없이 정적 파일(out/)로 내보낸다. 게임은 전부 브라우저에서 돈다.
const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // manifest·아이콘 같은 직접 경로에도 하위 경로를 붙일 수 있게 클라이언트에 알려준다
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
