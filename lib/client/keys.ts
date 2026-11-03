/**
 * 브라우저 쪽 키 보관 + 공통 호출 함수
 * - "이 기기에 저장" → localStorage, "이번만 사용" → sessionStorage
 * - 모든 /api 호출은 api() 를 거쳐 헤더에 키를 싣는다
 * - 401(NO_DATA_KEY / NO_GEMINI_KEY) 이면 설정 화면으로 보낸다
 */
export type Keys = { dataKey?: string; geminiKey?: string };
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

export function saveKeys(keys: Keys, persist: boolean) {
  if (!isBrowser()) return;
  const s = JSON.stringify({ dataKey: keys.dataKey?.trim() ?? "", geminiKey: keys.geminiKey?.trim() ?? "" });
  try {
    if (persist) {
      localStorage.setItem(K, s);
      sessionStorage.removeItem(K);
    } else {
      sessionStorage.setItem(K, s);
      localStorage.removeItem(K);
    }
  } catch {
    /* 저장소를 쓸 수 없는 환경(사생활 보호 창 등) */
  }
  window.dispatchEvent(new Event(KEYS_EVENT));
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
  return { hasData: Boolean(k.dataKey), hasGemini: Boolean(k.geminiKey) };
}

/** 키 헤더를 붙인 fetch. 401 이면 설정 화면으로 이동시킨다. */
export async function api(path: string, init: RequestInit = {}, overrideKeys?: Keys): Promise<Response> {
  const k = overrideKeys ?? loadKeys();
  const headers = new Headers(init.headers ?? {});
  headers.set("x-data-key", k.dataKey ?? "");
  headers.set("x-gemini-key", k.geminiKey ?? "");
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && !overrideKeys) {
    const j = await res.clone().json().catch(() => ({}));
    if (j?.error === "NO_DATA_KEY" || j?.error === "NO_GEMINI_KEY") {
      window.location.href = `/settings?need=${j.error}`;
    }
  }
  return res;
}

/** 서버가 보낸 오류 JSON을 사람이 읽을 문장으로 */
export async function errorMessage(res: Response): Promise<string> {
  const j = await res.json().catch(() => ({}));
  if (j?.message) return String(j.message);
  if (j?.error === "API_ERROR") return `국립수목원 응답 오류 (코드 ${j.code})`;
  if (j?.error === "GEMINI_ERROR") return "AI 호출에 실패했어요";
  return `요청에 실패했어요 (${res.status})`;
}
