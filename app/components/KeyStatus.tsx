"use client";
import Link from "next/link";
import { useConnection } from "@/lib/client/useConnection";
import { AI_NAME } from "@/lib/ai";

/**
 * 머리글의 연결 상태
 * 초록 '연결됨': 도감+AI / 노랑 'AI 키 필요'·'도감 키 필요': 하나만 / 빨강 '키 필요' / 파랑 '연습 모드'
 */
export default function KeyStatus() {
  const c = useConnection();
  if (!c.ready) return <span className="status-link"><span className="dot" /></span>;

  const [color, label] = c.mock
    ? ["#4f8fd8", "연습 모드"]
    : c.data && c.ai
      ? ["#2fbf71", "연결됨"]
      : c.data
        ? ["#f1b22a", "AI 키 필요"]
        : c.ai
          ? ["#f1b22a", "도감 키 필요"]
          : ["#e05252", "키 필요"];

  return (
    <Link href="/settings" className="status-link" title={c.ai && !c.mock ? `AI: ${AI_NAME[c.provider]}` : "키 설정"}>
      <span className="dot" style={{ background: color }} />
      {label}
    </Link>
  );
}
