"use client";
/**
 * 지금 이 기기에서 무엇이 연결돼 있는지 한곳에서 계산한다.
 * - 내 키(브라우저 저장소) + 서버 상태(/api/config: 연습 모드, 강사 공유 키)를 합친다
 * - 키를 저장·삭제하면(KEYS_EVENT) 바로 다시 계산한다
 */
import { useEffect, useState } from "react";
import { KEYS_EVENT, keyStatus } from "./keys";
import type { AiProvider } from "@/lib/ai";

export type ServerMode = { mock: boolean; sharedData: boolean; sharedAi: boolean; sharedAiProvider: AiProvider | null };

export type Connection = {
  ready: boolean;
  mock: boolean;
  ownData: boolean;
  ownAi: boolean;
  data: boolean; // 국립수목원 정보를 볼 수 있는가 (내 키 · 공유 키 · 연습 모드)
  ai: boolean;   // AI 기능(사진 식별·쉬운 풀이)을 쓸 수 있는가
  provider: AiProvider; // 지금 쓰는 AI
  sharedData: boolean;
  sharedAi: boolean;
};

let modePromise: Promise<ServerMode> | null = null;
export function loadServerMode(): Promise<ServerMode> {
  modePromise ??= fetch("/api/config", { cache: "no-store" })
    .then((r) => r.json())
    .then((j) => ({ mock: Boolean(j.mock), sharedData: Boolean(j.sharedData), sharedAi: Boolean(j.sharedAi), sharedAiProvider: j.sharedAiProvider ?? null }))
    .catch(() => ({ mock: false, sharedData: false, sharedAi: false, sharedAiProvider: null }));
  return modePromise;
}

const EMPTY: Connection = { ready: false, mock: false, ownData: false, ownAi: false, data: false, ai: false, provider: "gemini", sharedData: false, sharedAi: false };

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
        ownAi: own.hasAi,
        provider: own.hasAi ? own.provider : mode.sharedAiProvider ?? own.provider,
        sharedData: mode.sharedData,
        sharedAi: mode.sharedAi,
        data: mode.mock || own.hasData || mode.sharedData,
        ai: mode.mock || own.hasAi || mode.sharedAi,
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
