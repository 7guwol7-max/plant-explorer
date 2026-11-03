import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import KeyStatus from "./components/KeyStatus";
import KeyFromFragment from "./components/KeyFromFragment";
import BottomNav from "./components/BottomNav";

export const metadata: Metadata = {
  title: "학교 식물 탐사대",
  description: "사진으로 발견하는 우리 학교 식물도감 — AI 식별 + 국립수목원 공식 정보 + 관찰 기록",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2f7d4a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <KeyFromFragment />
        <header className="app-header">
          <div className="inner">
            <a href="/" className="brand">
              🌿 학교 식물 탐사대 <small>AI 생태 탐사</small>
            </a>
            <div className="header-right">
              <Link href="/teacher" className="teacher-link">👩‍🏫 선생님</Link>
              <KeyStatus />
            </div>
          </div>
        </header>
        <main className="container">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
