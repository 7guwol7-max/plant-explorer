"use client";
import Link from "next/link";
import { useConnection } from "@/lib/client/useConnection";

/**
 * 머리글의 연결 상태
 * 초록 '연결됨': 도감+AI / 초록 '도감 연결': 도감만(AI 없이 이름으로 찾기) / 빨강 '키 필요' / 파랑 '연습 모드'
 */
export default function KeyStatus() {
  const c = useConnection();
  if (!c.ready) return <span className="status-link"><span className="dot" /></span>;

  const [color, label] = c.mock
    ? ["#4f8fd8", "연습 모드"]
    : c.data && c.gemini
      ? ["#2fbf71", "연결됨"]
      : c.data
        ? ["#2fbf71", "도감 연결"]
        : ["#e05252", "키 필요"];

  return (
    <Link href="/settings" className="status-link" title="키 설정">
      <span className="dot" style={{ background: color }} />
      {label}
    </Link>
  );
}
