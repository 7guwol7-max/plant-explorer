/**
 * 키 처리 규칙 (사용자별 키 구조)
 * ─────────────────────────────────────────────
 * 1. 사용자가 설정 화면에서 넣은 키는 브라우저 저장소에만 있고,
 *    매 요청마다 헤더(x-data-key, x-gemini-key)로 서버 함수에 전달된다.
 * 2. 서버 함수는 헤더의 키로 외부 API를 호출한 뒤 버린다. 저장·기록하지 않는다.
 * 3. 헤더에 키가 없을 때만, 환경변수 ALLOW_SHARED_KEY=1 인 경우에 한해
 *    서버 환경변수의 키(강사 시연용)를 대신 쓴다.
 * 4. MOCK=1 이면 외부 호출 자체를 하지 않으므로 키가 필요 없다.
 */

export type ServerKeys = {
  dataKey: string;
  geminiKey: string;
  shared: boolean;
};

export const isMock = () => process.env.MOCK === "1";

export function getKeys(req: Request): ServerKeys {
  const shared = process.env.ALLOW_SHARED_KEY === "1";
  const headerData = req.headers.get("x-data-key")?.trim() ?? "";
  const headerGemini = req.headers.get("x-gemini-key")?.trim() ?? "";
  return {
    dataKey: headerData || (shared ? (process.env.DATA_GO_KR_KEY ?? "").trim() : ""),
    geminiKey: headerGemini || (shared ? (process.env.GEMINI_API_KEY ?? "").trim() : ""),
    shared,
  };
}

/** 키가 없을 때 401 — 클라이언트는 이 코드를 받으면 설정 화면으로 보낸다 */
export function noKey(code: "NO_DATA_KEY" | "NO_GEMINI_KEY") {
  return Response.json({ error: code }, { status: 401 });
}
