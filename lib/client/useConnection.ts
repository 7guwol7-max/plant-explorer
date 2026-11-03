"use client";
/**
 * 지금 이 기기에서 무엇이 연결돼 있는지 한곳에서 계산한다.
 * - 내 키(브라우저 저장소) + 서버 상태(/api/config: 연습 모드, 강사 공유 키)를 합친다
 * - 키를 저장·삭제하면(KEYS_EVENT) 바로 다시 계산한다
 */
import { useEffect, useState } from "react";
import { KEYS_EVENT, keyStatus } from "./keys";

export type ServerMode = { mock: boolean; sharedData: boolean; sharedGemini: boolean };

export type Connection = {
  ready: boolean;
  mock: boolean;
  ownData: boolean;
  ownGemini: boolean;
  data: boolean;   // 국립수목원 정보를 볼 수 있는가 (내 키 · 공유 키 · 연습 모드)
  gemini: boolean; // AI 기능을 쓸 수 있는가
  sharedData: boolean;
  sharedGemini: boolean;
};

let modePromise: Promise<ServerMode> | null = null;
export function loadServerMode(): Promise<ServerMode> {
  modePromise ??= fetch("/api/config", { cache: "no-store" })
    .then((r) => r.json())
    .then((j) => ({ mock: Boolean(j.mock), sharedData: Boolean(j.sharedData), sharedGemini: Boolean(j.sharedGemini) }))
    .catch(() => ({ mock: false, sharedData: false, sharedGemini: false }));
  return modePromise;
}

const EMPTY: Connection = { ready: false, mock: false, ownData: false, ownGemini: false, data: false, gemini: false, sharedData: false, sharedGemini: false };

export function useConnection(): Connection {
  const [c, setC] = useState<Connection>(EMPTY);

  useEffect(() => {
    let alive = true;
    const read = async () => {
      const mode = await loadServerMode();
      const own = keyStatus();
      if (!alive) return;
      setC({
        ready: true,
        mock: mode.mock,
        ownData: own.hasData,
        ownGemini: own.hasGemini,
        sharedData: mode.sharedData,
        sharedGemini: mode.sharedGemini,
        data: mode.mock || own.hasData || mode.sharedData,
        gemini: mode.mock || own.hasGemini || mode.sharedGemini,
      });
    };
    read();
    const on = () => void read();
    window.addEventListener(KEYS_EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      alive = false;
      window.removeEventListener(KEYS_EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, []);

  return c;
}
