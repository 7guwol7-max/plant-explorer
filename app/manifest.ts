import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/** 휴대폰 '홈 화면에 추가' 시 앱처럼 열리게 하는 설정 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.shortName,
    description: "사진으로 발견하는 우리 학교 식물도감 — 국립수목원 공식 정보와 교과서 연결",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f1",
    theme_color: "#2f7d4a",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
