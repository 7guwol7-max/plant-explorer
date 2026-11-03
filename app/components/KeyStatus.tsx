"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { KEYS_EVENT, keyStatus } from "@/lib/client/keys";

/** 머리글의 연결 상태 점 — 초록: 두 키 모두 있음, 노랑: 하나만, 빨강: 없음 */
export default function KeyStatus() {
  const [s, setS] = useState({ hasData: false, hasGemini: false, ready: false });

  useEffect(() => {
    const read = () => setS({ ...keyStatus(), ready: true });
    read();
    window.addEventListener(KEYS_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(KEYS_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  if (!s.ready) return <span className="status-link"><span className="dot" /></span>;
  const both = s.hasData && s.hasGemini;
  const none = !s.hasData && !s.hasGemini;
  return (
    <Link href="/settings" className="status-link" title="설정">
      <span className="dot" style={{ background: both ? "#2fbf71" : none ? "#e05252" : "#f1b22a" }} />
      {both ? "연결됨" : none ? "키 필요" : "키 일부"}
    </Link>
  );
}
