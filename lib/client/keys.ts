/**
 * 브라우저 쪽 키 보관 + 공통 호출 함수
 * ─────────────────────────────────────────────
 * 이 앱은 '쓰는 사람마다 자기 키'를 넣는 구조다.
 * - 공공데이터포털 인증키: 꼭 필요 (국립수목원 공식 정보)
 * - AI 키: 꼭 필요 (사진으로 식물 알아보기, 학년 눈높이 풀이). 제미나이·클로드·GPT 중 하나를 골라 그 키를 넣는다
 *   세 회사 키를 모두 저장해 둘 수 있고, aiProvider 가 지금 쓰는 쪽
 * - "이 기기에 저장" → localStorage, "이번만 사용" → sessionStorage
 * - 모든 /api 호출은 api() 를 거쳐 헤더에 키를 싣는다
 * - 401 NO_DATA_KEY 이면 설정 화면으로 보낸다 (제미나이 키가 없는 것은 각 화면이 부드럽게 처리)
 */
import { normalizeDataKey } from "@/lib/datakey";
import { AI_PROVIDERS, isAiProvider, normalizeAiKey, type AiProvider } from "@/lib/ai";

export type Keys = { dataKey?: string; aiProvider?: AiProvider; geminiKey?: string; claudeKey?: string; openaiKey?: string };
export const KEY_FIELD = { gemini: "geminiKey", claude: "claudeKey", openai: "openaiKey" } as const;

/** 지금 쓰는 AI 공급자 (정하지 않았으면 키가 있는 첫 공급자, 그것도 없으면 제미나이) */
export function activeProvider(k: Keys): AiProvider {
  if (isAiProvider(k.aiProvider)) return k.aiProvider;
  return AI_PROVIDERS.find((p) => k[KEY_FIELD[p]]) ?? "gemini";
}
export const aiKeyOf = (k: Keys, p: AiProvider = activeProvider(k)) => k[KEY_FIELD[p]] ?? "";
const K = "keys";
export const KEYS_EVENT = "keys-changed";

const isBrowser = () => typeof window !== "undefined";

export function loadKeys(): Keys {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(K) ?? sessionStorage.getItem(K);
    return raw ? (JSON.parse(raw) as Keys) : {};
  } catch {
    return {};
  }
}

export function isPersisted(): boolean {
  if (!isBrowser()) return false;
  try {
    return localStorage.getItem(K) != null;
  } catch {
    return false;
  }
}

/** 저장 전에 키 모양을 맞춘다 (인코딩 키·주소 통째로 붙여 넣어도 디코딩 키로) */
export function cleanKeys(keys: Keys): Keys {
  return {
    dataKey: normalizeDataKey(keys.dataKey).key,
    aiProvider: activeProvider(keys),
    geminiKey: normalizeAiKey(keys.geminiKey),
    claudeKey: normalizeAiKey(keys.claudeKey),
    openaiKey: normalizeAiKey(keys.openaiKey),
  };
}

export function saveKeys(keys: Keys, persist: boolean): boolean {
  if (!isBrowser()) return false;
  const s = JSON.stringify(cleanKeys(keys));
  let ok = true;
  try {
    if (persist) {
      localStorage.setItem(K, s);
      sessionStorage.removeItem(K);
    } else {
      sessionStorage.setItem(K, s);
      localStorage.removeItem(K);
    }
  } catch {
    ok = false; /* 저장소를 쓸 수 없는 환경(사생활 보호 창 등) */
  }
  window.dispatchEvent(new Event(KEYS_EVENT));
  return ok;
}

export function clearKeys() {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(K);
    sessionStorage.removeItem(K);
  } catch {}
  window.dispatchEvent(new Event(KEYS_EVENT));
}

export function keyStatus() {
  const k = loadKeys();
  const provider = activeProvider(k);
  return { hasData: Boolean(k.dataKey), hasAi: Boolean(aiKeyOf(k, provider)), provider };
}

/** 키 헤더를 붙인 fetch. 공공데이터포털 키가 아예 없으면 설정 화면으로 이동시킨다. */
export async function api(path: string, init: RequestInit = {}, overrideKeys?: Keys): Promise<Response> {
  const k = overrideKeys ? cleanKeys(overrideKeys) : loadKeys();
  const headers = new Headers(init.headers ?? {});
  headers.set("x-data-key", k.dataKey ?? "");
  headers.set("x-ai-provider", activeProvider(k));
  headers.set("x-ai-key", aiKeyOf(k));
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && !overrideKeys) {
    const j = await res.clone().json().catch(() => ({}));
    if (j?.error === "NO_DATA_KEY") {
      window.location.href = `/settings?need=${j.error}`;
    }
  }
  return res;
}

/** 서버 오류를 화면용으로: 문장 + 키 설정을 고쳐야 하는지 */
export class ApiError extends Error {
  constructor(message: string, public needsSettings = false, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function toApiError(res: Response): Promise<ApiError> {
  const j = await res.json().catch(() => ({}));
  const needs = ["BAD_DATA_KEY", "NO_DATA_KEY", "NO_AI_KEY", "BAD_AI_KEY"].includes(j?.error);
  const message = j?.message
    ? String(j.message)
    : j?.error === "API_ERROR"
      ? `국립수목원 응답 오류 (코드 ${j.code})`
      : j?.error === "GEMINI_ERROR"
        ? "AI 호출에 실패했어요"
        : `요청에 실패했어요 (${res.status})`;
  return new ApiError(message, needs, j?.error);
}

/** 예전 호출부 호환용: 문장만 */
export async function errorMessage(res: Response): Promise<string> {
  return (await toApiError(res)).message;
}
