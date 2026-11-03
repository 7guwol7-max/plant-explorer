/**
 * 제미나이 호출 (사진 식별, 쉬운 설명·관찰 질문 생성)
 * - 키는 x-goog-api-key 헤더로 보낸다 (주소에 키를 넣지 않음). AIza… / AQ.… 두 형식 모두 같은 방식
 * - 응답은 JSON 스키마를 강제해 구조화된 결과만 받는다
 * - MOCK=1 이면 외부 호출 없이 고정 응답
 *
 * 모델 고르기 (구글이 모델을 자주 은퇴시키므로 이름 하나에 기대지 않는다)
 * - 순서: 환경변수 GEMINI_MODEL(쉼표로 여러 개) → 최근에 성공한 모델 → 기본 목록
 * - 은퇴(404)·혼잡(5xx·시간 초과)·한도(429)면 다음 모델로 넘어간다
 * - 404 안내문에 "use models/xxx" 처럼 대체 모델이 적혀 있으면 그 모델도 시도한다
 * - 키 문제(400 API key·401·403)는 다른 모델로 해도 소용없으므로 바로 멈춘다
 */
import { isMock } from "./keys";
import type { Standard } from "../curriculum";
import type { InlineImage } from "./images";

export const DEFAULT_MODELS = [
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
];

const ATTEMPT_TIMEOUT_MS = 20_000;
const TOTAL_BUDGET_MS = 50_000;
const SKIP_RETIRED_MS = 24 * 60 * 60 * 1000;
const SKIP_BUSY_MS = 2 * 60 * 1000;

export type GeminiErrorKind = "key" | "retired" | "busy" | "quota" | "parse" | "other";

export class GeminiError extends Error {
  constructor(public status: number, message: string, public kind: GeminiErrorKind = "other") {
    super(message);
    this.name = "GeminiError";
  }
}

/* 서버가 켜져 있는 동안 기억: 최근 성공 모델, 잠시 건너뛸 모델 (키와 무관한 모델 상태만) */
type ModelMemory = { lastGood?: string; skipUntil: Map<string, number> };
const gm = globalThis as unknown as { __geminiModels?: ModelMemory };
const memory: ModelMemory = (gm.__geminiModels ??= { skipUntil: new Map<string, number>() });

export function resetModelMemory() {
  memory.lastGood = undefined;
  memory.skipUntil.clear();
}

export function modelCandidates(now = Date.now()): string[] {
  const env = (process.env.GEMINI_MODEL ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  const all = [...new Set([...env, memory.lastGood, ...DEFAULT_MODELS].filter((m): m is string => Boolean(m)))];
  const ready = all.filter((m) => (memory.skipUntil.get(m) ?? 0) <= now);
  return ready.length ? ready : all;
}

/** 구글 오류를 종류로 나눈다 */
export function classifyGeminiError(status: number, message: string): GeminiErrorKind | "thinking" {
  if (status === 401 || status === 403) return "key";
  if (status === 400 && /api[ _-]?key|API_KEY|UNAUTHENTICATED|credential|ACCESS_TOKEN/i.test(message)) return "key";
  if (status === 400 && /thinking/i.test(message)) return "thinking";
  if (status === 404) return "retired";
  if (status === 429) return "quota";
  if (status === 0 || status >= 500) return "busy";
  return "other";
}

/** "Please update your code to use models/gemini-x" 에서 대체 모델 이름 꺼내기 */
export function suggestedModel(message: string): string | undefined {
  return /use\s+models\/([A-Za-z0-9._-]+)/i.exec(message)?.[1];
}

type Attempt = { ok: true; json: unknown } | { ok: false; status: number; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callModel(key: string, model: string, parts: any[], schema: any, thinking: boolean, timeoutMs: number): Promise<Attempt> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.2,
          // 생각 단계를 줄여 수업 중 기다리는 시간을 줄인다 (지원하지 않는 모델이면 빼고 다시)
          ...(thinking ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
        },
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      let message = text.slice(0, 400);
      try {
        message = JSON.parse(text)?.error?.message ?? message;
      } catch {}
      return { ok: false, status: res.status, message };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = JSON.parse(text);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: string = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    try {
      return { ok: true, json: JSON.parse(out) };
    } catch {
      return { ok: false, status: 502, message: "AI 응답을 해석하지 못했어요" };
    }
  } catch {
    return { ok: false, status: 0, message: "제미나이가 제때 답하지 않았어요" };
  } finally {
    clearTimeout(timer);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generate(key: string, parts: any[], schema: any): Promise<{ json: any; model: string }> {
  const started = Date.now();
  const queue = modelCandidates(started);
  const failures: { model: string; status: number; kind: GeminiErrorKind; message: string }[] = [];

  for (let i = 0; i < queue.length; i++) {
    const model = queue[i];
    const left = TOTAL_BUDGET_MS - (Date.now() - started);
    if (left < 3_000) break;
    let r = await callModel(key, model, parts, schema, true, Math.min(ATTEMPT_TIMEOUT_MS, left));
    if (!r.ok && classifyGeminiError(r.status, r.message) === "thinking") {
      r = await callModel(key, model, parts, schema, false, Math.min(ATTEMPT_TIMEOUT_MS, TOTAL_BUDGET_MS - (Date.now() - started)));
    }
    if (r.ok) {
      memory.lastGood = model;
      return { json: r.json, model };
    }
    const kind = classifyGeminiError(r.status, r.message);
    if (kind === "key") throw new GeminiError(r.status, r.message, "key");
    const k: GeminiErrorKind = kind === "thinking" ? "other" : r.status === 502 && r.message.startsWith("AI 응답") ? "parse" : kind;
    failures.push({ model, status: r.status, kind: k, message: r.message });
    if (k === "retired") {
      memory.skipUntil.set(model, Date.now() + SKIP_RETIRED_MS);
      const next = suggestedModel(r.message);
      if (next && !queue.includes(next)) queue.splice(i + 1, 0, next);
    }
    if (k === "busy") memory.skipUntil.set(model, Date.now() + SKIP_BUSY_MS);
  }

  // 모두 실패: 사용자가 할 수 있는 일이 분명한 순서로 대표 오류를 고른다
  const pick = (kd: GeminiErrorKind) => failures.find((f) => f.kind === kd);
  const top = pick("quota") ?? pick("busy") ?? pick("parse") ?? pick("other") ?? pick("retired");
  if (!top) throw new GeminiError(0, "제미나이에 연결하지 못했어요", "busy");
  throw new GeminiError(top.status, `${top.message} (시도한 모델: ${failures.map((f) => f.model).join(", ")})`, top.kind);
}

/* ───────── 사진 식별 ───────── */
export type Candidate = {
  koreanName: string;
  scientificName: string;
  confidence: "높음" | "중간" | "낮음";
  evidence: string;
};
export type IdentifyResult = { candidates: Candidate[]; uncertain: boolean; mock?: boolean };

const IDENTIFY_SCHEMA = {
  type: "OBJECT",
  properties: {
    candidates: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          koreanName: { type: "STRING" },
          scientificName: { type: "STRING" },
          confidence: { type: "STRING", enum: ["높음", "중간", "낮음"] },
          evidence: { type: "STRING" },
        },
        required: ["koreanName", "scientificName", "confidence", "evidence"],
      },
    },
    uncertain: { type: "BOOLEAN" },
  },
  required: ["candidates", "uncertain"],
};

export async function identify(images: InlineImage[], taxon: "plant" | "insect", key: string): Promise<IdentifyResult> {
  if (isMock()) {
    return {
      mock: true,
      uncertain: false,
      candidates: [
        { koreanName: "은행나무", scientificName: "Ginkgo biloba", confidence: "높음", evidence: "[모의] 부채 모양 잎, 가운데가 갈라진 잎 가장자리" },
        { koreanName: "단풍나무", scientificName: "Acer palmatum", confidence: "낮음", evidence: "[모의] 손바닥 모양으로 갈라진 잎일 가능성" },
      ],
    };
  }
  const what = taxon === "insect" ? "곤충" : "식물";
  const many = images.length > 1 ? `\n사진 ${images.length}장은 모두 같은 ${what}을 여러 방향에서 찍은 것입니다(전체 모습, 잎, 꽃이나 열매 등). 모든 사진을 함께 보고 판단하세요.` : "";
  const prompt = `당신은 초등학생의 과학 탐구를 돕는 ${what} 식별 도우미입니다.
사진 속 ${what}을 보고 한국에서 볼 수 있는 ${what} 후보를 최대 3개 제시하세요.${many}
- koreanName: 국립수목원 국가표준 국명(예: 은행나무, 소나무, 서양민들레)
- scientificName: 학명(속명 종소명, 명명자 제외)
- confidence: 높음/중간/낮음
- evidence: 사진에서 실제로 보이는 근거를 초등학생이 확인할 수 있는 말로 (잎 모양, 잎맥, 줄기, 꽃, 열매 등)
사진이 흐리거나 ${what}이 아니거나 판단이 어려우면 uncertain을 true로 하고 후보는 "낮음"으로만 표시하세요. 추측으로 확신하지 마세요.`;
  const { json } = await generate(
    key,
    [...images.map((im) => ({ inlineData: im })), { text: prompt }],
    IDENTIFY_SCHEMA,
  );
  return json;
}

/* ───────── 쉬운 설명 + 관찰 질문 ───────── */
export type ExplainResult = {
  kidSummary: string;
  observeQuestions: string[];
  compareHint: string;
  mock?: boolean;
};

const EXPLAIN_SCHEMA = {
  type: "OBJECT",
  properties: {
    kidSummary: { type: "STRING" },
    observeQuestions: { type: "ARRAY", items: { type: "STRING" } },
    compareHint: { type: "STRING" },
  },
  required: ["kidSummary", "observeQuestions", "compareHint"],
};

export async function explain(
  official: Record<string, string>,
  grade: string,
  key: string,
  standards: Standard[] = [],
): Promise<ExplainResult> {
  if (isMock()) {
    return {
      mock: true,
      kidSummary: "[모의] 이 식물은 잎이 부채처럼 생겼어요. 가을이 되면 잎이 노랗게 물들고 떨어져요. 공원이나 길가에서 자주 볼 수 있어요.",
      observeQuestions: [
        "잎의 가장자리가 어떻게 생겼나요? 매끈한가요, 갈라져 있나요?",
        "잎맥이 어떤 모양으로 뻗어 있나요?",
        "이 식물이 자라는 곳은 햇빛이 잘 드나요?",
      ],
      compareHint: "[모의] 비슷하게 생긴 식물과 잎 모양, 잎맥, 줄기를 비교해 보세요.",
    };
  }
  const prompt = `아래는 국립수목원 식물도감의 공식 정보(JSON)입니다. 이 원문에 있는 사실만 사용해 초등 ${grade} 어휘로 다시 써 주세요.
규칙:
- kidSummary: 3~4문장. 원문에 없는 내용은 절대 쓰지 말 것. 모르는 항목은 언급하지 말 것.
- observeQuestions: 학생이 지금 눈앞의 실제 식물을 보고 확인할 수 있는 관찰 질문 3개 (잎, 줄기, 꽃, 열매, 자라는 환경 중심)
- compareHint: 원문의 '유사종' 정보가 있으면 그것과 구별하는 관찰 포인트 1~2문장, 없으면 "비슷한 식물과 잎 모양·잎맥·줄기를 비교해 보세요."
${curriculumBlock(standards)}공식 정보:
${JSON.stringify(official, null, 0)}`;
  const { json } = await generate(key, [{ text: prompt }], EXPLAIN_SCHEMA);
  return json;
}

/** 연결된 성취기준과 해설에 따라 '다루지 않는 내용'을 프롬프트에 붙인다 */
export function curriculumBlock(standards: Standard[]): string {
  if (!standards.length) return "";
  const lines = standards.map((s) => `- ${s.code} ${s.officialText}`).join("\n");
  const avoid = [...new Set(standards.flatMap((s) => s.aiAvoid))];
  return `- 관찰 질문은 아래 교육과정 성취기준의 탐구로 이어지게 만들 것 (성취기준 코드나 '성취기준'이라는 말은 쓰지 말 것):
${lines}
${avoid.length ? `- 이 학년에서 다루지 않는 내용이므로 쓰지 말 것: ${avoid.join(", ")}\n` : ""}`;
}

/* ───────── 연결 확인 ───────── */
export async function checkGemini(key: string): Promise<{ ok: boolean; model?: string }> {
  if (isMock()) return { ok: true };
  const r = await generate(
    key,
    [{ text: "ok 항목에 true를 넣어 답하세요." }],
    { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } }, required: ["ok"] },
  );
  return { ok: Boolean(r.json?.ok), model: r.model };
}

/** 오류 종류별 안내문 (설정 화면과 각 기능이 같은 문장을 쓴다) */
export function friendlyGeminiMessage(e: GeminiError): string {
  switch (e.kind) {
    case "key":
      return "제미나이 키가 올바르지 않거나 권한이 없어요. AI 스튜디오에서 키를 빠짐없이 다시 복사하거나, 새 키를 만들어 넣어 보세요.";
    case "quota":
      return "제미나이 무료 호출 한도를 넘었어요. 잠시 뒤에 다시 하거나, 한국 시간 오후 4~5시 이후에 다시 시도하세요.";
    case "busy":
      return "제미나이가 지금 많이 바빠요. 잠시 후 다시 시도하세요.";
    case "retired":
      return `이 키로 쓸 수 있는 제미나이 모델을 찾지 못했어요. (구글 안내: ${e.message})`;
    case "parse":
      return "AI 응답을 해석하지 못했어요. 한 번 더 시도해 주세요.";
    default:
      return `제미나이 호출에 실패했어요. (${e.message})`;
  }
}

export function geminiErrorResponse(e: unknown) {
  if (e instanceof GeminiError) {
    const bad = e.kind === "key";
    return Response.json(
      { error: bad ? "BAD_GEMINI_KEY" : "GEMINI_ERROR", status: e.status, kind: e.kind, message: friendlyGeminiMessage(e) },
      { status: bad ? 401 : 502 },
    );
  }
  const msg = e instanceof Error ? e.message : "알 수 없는 오류";
  return Response.json({ error: "SERVER_ERROR", message: msg }, { status: 500 });
}
