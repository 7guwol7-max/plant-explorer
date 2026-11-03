/**
 * 키 처리 규칙 (사용자별 키 구조)
 * ─────────────────────────────────────────────
 * 1. 사용자(선생님·학생)가 설정 화면에서 넣은 키는 그 기기의 브라우저 저장소에만 있고,
 *    매 요청마다 헤더(x-data-key, x-ai-provider, x-ai-key)로 이 서버 함수에 전달된다.
 *    AI 는 제미나이·클로드·GPT 중 사용자가 고른 하나.
 * 2. 서버 함수는 헤더의 키로 외부 API를 호출한 뒤 버린다. 저장·기록하지 않는다.
 * 3. 헤더에 키가 없을 때만, 환경변수 ALLOW_SHARED_KEY=1 인 경우에 한해
 *    서버 환경변수의 키(강사 시연용)를 대신 쓴다. AI 는 AI_PROVIDER 가 가리키는 공급자의 키부터.
 * 4. MOCK=1 이면 외부 호출 자체를 하지 않으므로 키가 필요 없다.
 * 5. 공공데이터포털 키는 인코딩/디코딩/주소 통째 어느 모양이든 디코딩 키로 맞춘다 (lib/datakey.ts).
 */
import { normalizeDataKey } from "../datakey";
import { AI_PROVIDERS, isAiProvider, normalizeAiKey, type AiProvider } from "../ai";

export type ServerKeys = {
  dataKey: string;
  ai: { provider: AiProvider; key: string };
  shared: boolean;
};

export const isMock = () => process.env.MOCK === "1";
const sharedAllowed = () => process.env.ALLOW_SHARED_KEY === "1";

/** 강사 시연용 서버 키 (ALLOW_SHARED_KEY=1 일 때만) */
const SHARED_ENV: Record<AiProvider, string> = { gemini: "GEMINI_API_KEY", claude: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY" };
function sharedAi(): { provider: AiProvider; key: string } | null {
  if (!sharedAllowed()) return null;
  const want = process.env.AI_PROVIDER;
  const order = isAiProvider(want) ? [want, ...AI_PROVIDERS.filter((p) => p !== want)] : AI_PROVIDERS;
  for (const p of order) {
    const key = normalizeAiKey(process.env[SHARED_ENV[p]]);
    if (key) return { provider: p, key };
  }
  return null;
}

/**
 * 요청 헤더: x-data-key, x-ai-provider(gemini|claude|openai), x-ai-key
 * (예전 형식 x-gemini-key 도 받는다)
 */
export function getKeys(req: Request): ServerKeys {
  const shared = sharedAllowed();
  const headerData = normalizeDataKey(req.headers.get("x-data-key")).key;
  const p = req.headers.get("x-ai-provider");
  let aiKey = normalizeAiKey(req.headers.get("x-ai-key"));
  let provider: AiProvider = isAiProvider(p) ? p : "gemini";
  if (!aiKey) {
    const legacy = normalizeAiKey(req.headers.get("x-gemini-key"));
    if (legacy) {
      aiKey = legacy;
      provider = "gemini";
    }
  }
  const fallback = aiKey ? null : sharedAi();
  return {
    dataKey: headerData || (shared ? normalizeDataKey(process.env.DATA_GO_KR_KEY).key : ""),
    ai: fallback ?? { provider, key: aiKey },
    shared,
  };
}

/** 화면이 '키가 꼭 필요한지' 알 수 있게 알려 주는 서버 상태 (키 값은 절대 담지 않는다) */
export function serverMode() {
  const ai = sharedAi();
  return {
    mock: isMock(),
    sharedData: sharedAllowed() && Boolean(normalizeDataKey(process.env.DATA_GO_KR_KEY).key),
    sharedAi: Boolean(ai),
    sharedAiProvider: ai?.provider ?? null,
  };
}

/** 키가 없을 때 401 — 클라이언트는 NO_DATA_KEY 를 받으면 설정 화면으로 보낸다 */
export function noKey(code: "NO_DATA_KEY" | "NO_AI_KEY") {
  const message =
    code === "NO_DATA_KEY"
      ? "공공데이터포털 인증키가 필요해요. 설정에서 키를 넣어 주세요."
      : "AI 키가 없어서 사진으로 식물을 알아볼 수 없어요. 설정에서 제미나이·클로드·GPT 중 하나의 키를 넣어 주세요.";
  return Response.json({ error: code, message }, { status: 401 });
}
