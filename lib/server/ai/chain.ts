/**
 * 모델 차례로 시도하기 (제미나이·GPT 공용)
 * 구글·OpenAI는 모델을 자주 은퇴시키므로 이름 하나에 기대지 않는다.
 * - 순서: 환경변수(쉼표로 여러 개) → 최근에 성공한 모델 → 기본 목록
 * - 은퇴(404)는 하루, 혼잡(5xx·시간 초과)은 2분 동안 건너뛴다
 * - 안내문에 대체 모델 이름이 있으면(suggest) 바로 다음에 시도한다
 * - 'degrade'(예: 생각 설정·추론 강도를 모르는 모델)면 같은 모델에 기능을 줄여 한 번 더
 * - 키·결제 문제는 다른 모델로 해도 소용없으므로 바로 멈춘다
 */
import type { AiProvider } from "../../ai";
import { AiError, type AiErrorKind } from "./errors";

export type Attempt = { ok: true; json: unknown } | { ok: false; status: number; message: string; code?: string };
export type Failure = Extract<Attempt, { ok: false }>;

type Memory = { lastGood?: string; skipUntil: Map<string, number> };
const g = globalThis as unknown as { __aiModels?: Record<string, Memory> };
const all = (g.__aiModels ??= {});
const mem = (p: AiProvider): Memory => (all[p] ??= { skipUntil: new Map<string, number>() });

export function resetModelMemory(p?: AiProvider) {
  for (const k of p ? [p] : Object.keys(all)) delete all[k];
}

const SKIP_RETIRED_MS = 24 * 60 * 60 * 1000;
const SKIP_BUSY_MS = 2 * 60 * 1000;

export function modelCandidates(p: AiProvider, envValue: string | undefined, defaults: string[], now = Date.now()): string[] {
  const env = (envValue ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  const m = mem(p);
  const list = [...new Set([...env, m.lastGood, ...defaults].filter((x): x is string => Boolean(x)))];
  const ready = list.filter((x) => (m.skipUntil.get(x) ?? 0) <= now);
  return ready.length ? ready : list;
}

export type ChainOptions = {
  provider: AiProvider;
  models: string[];
  /** variant 0 = 모든 기능, 1 = 줄인 기능(생각 설정 등 빼기) */
  call: (model: string, variant: 0 | 1, timeoutMs: number) => Promise<Attempt>;
  classify: (f: Failure) => AiErrorKind | "degrade";
  suggest?: (message: string) => string | undefined;
  attemptMs?: number;
  budgetMs?: number;
};

export async function runChain(o: ChainOptions): Promise<{ json: unknown; model: string }> {
  const started = Date.now();
  const budget = o.budgetMs ?? 50_000;
  const per = o.attemptMs ?? 20_000;
  const queue = [...o.models];
  const failures: { model: string; f: Failure; kind: AiErrorKind }[] = [];
  const m = mem(o.provider);

  for (let i = 0; i < queue.length; i++) {
    const model = queue[i];
    const left = () => budget - (Date.now() - started);
    if (left() < 3_000) break;
    let r = await o.call(model, 0, Math.min(per, left()));
    if (!r.ok && o.classify(r) === "degrade" && left() > 3_000) r = await o.call(model, 1, Math.min(per, left()));
    if (r.ok) {
      m.lastGood = model;
      return { json: r.json, model };
    }
    const c = o.classify(r);
    const kind: AiErrorKind = c === "degrade" ? "other" : c;
    if (kind === "key" || kind === "billing") throw new AiError(r.status, r.message, kind, o.provider);
    failures.push({ model, f: r, kind });
    if (kind === "retired") {
      m.skipUntil.set(model, Date.now() + SKIP_RETIRED_MS);
      const next = o.suggest?.(r.message);
      if (next && !queue.includes(next)) queue.splice(i + 1, 0, next);
    }
    if (kind === "busy") m.skipUntil.set(model, Date.now() + SKIP_BUSY_MS);
  }

  // 모두 실패: 사용자가 할 수 있는 일이 분명한 순서로 대표 오류
  const pick = (k: AiErrorKind) => failures.find((x) => x.kind === k);
  const top = pick("quota") ?? pick("busy") ?? pick("refusal") ?? pick("parse") ?? pick("other") ?? pick("retired");
  if (!top) throw new AiError(0, "AI에 연결하지 못했어요", "busy", o.provider);
  throw new AiError(top.f.status, `${top.f.message} (시도한 모델: ${failures.map((x) => x.model).join(", ")})`, top.kind, o.provider);
}

/** fetch + 시간 제한 + JSON 오류 메시지 꺼내기 (제미나이·GPT 공용) */
export async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {}
    return { status: res.status, ok: res.ok, text, data };
  } catch {
    return { status: 0, ok: false, text: "AI가 제때 답하지 않았어요", data: null };
  } finally {
    clearTimeout(timer);
  }
}
