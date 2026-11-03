/**
 * 제미나이 (구글 AI 스튜디오 키: AIza… 또는 AQ.…)
 * - 키는 x-goog-api-key 헤더로 보낸다 (주소에 키를 넣지 않음)
 * - responseSchema 로 JSON 구조를 강제한다
 * - 모델 은퇴·혼잡이 잦아 chain.ts 로 차례로 시도한다
 */
import { runChain, modelCandidates, postJson, type Attempt, type Failure } from "./chain";
import type { AiErrorKind } from "./errors";
import type { AiRequest, JsonSchema } from "./types";

export const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
];

/** 표준 JSON 스키마 → 제미나이 responseSchema (대문자 type, additionalProperties 없음) */
export function toGeminiSchema(s: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (s.type) out.type = String(s.type).toUpperCase();
  if (s.enum) out.enum = s.enum;
  if (s.required) out.required = s.required;
  if (s.items) out.items = toGeminiSchema(s.items);
  if (s.properties) out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
  return out;
}

export function classifyGemini(f: Failure): AiErrorKind | "degrade" {
  const { status, message } = f;
  if (status === 401 || status === 403) return "key";
  if (status === 400 && /api[ _-]?key|API_KEY|UNAUTHENTICATED|credential|ACCESS_TOKEN/i.test(message)) return "key";
  if (status === 400 && /thinking/i.test(message)) return "degrade";
  if (status === 404) return "retired";
  if (status === 429) return "quota";
  if (status === 0 || status >= 500) return "busy";
  if (status === 200 && message.startsWith("AI 응답")) return "parse";
  return "other";
}

/** "Please update your code to use models/gemini-x" 에서 대체 모델 이름 꺼내기 */
export const suggestGemini = (message: string) => /use\s+models\/([A-Za-z0-9._-]+)/i.exec(message)?.[1];

export async function generateGemini(req: AiRequest): Promise<{ json: unknown; model: string }> {
  const parts = [...(req.images ?? []).map((im) => ({ inlineData: im })), { text: req.prompt }];
  const responseSchema = toGeminiSchema(req.schema);

  const call = async (model: string, variant: 0 | 1, timeoutMs: number): Promise<Attempt> => {
    const r = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { "x-goog-api-key": req.key },
      {
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.2,
          // 생각 단계를 줄여 수업 중 기다리는 시간을 줄인다 (모르는 모델이면 빼고 다시)
          ...(variant === 0 ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
        },
      },
      timeoutMs,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = r.data as any;
    if (!r.ok) return { ok: false, status: r.status, message: d?.error?.message ?? r.text.slice(0, 400) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text: string = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    try {
      return { ok: true, json: JSON.parse(text) };
    } catch {
      return { ok: false, status: 200, message: "AI 응답을 해석하지 못했어요" };
    }
  };

  return runChain({
    provider: "gemini",
    models: modelCandidates("gemini", process.env.GEMINI_MODEL, GEMINI_MODELS),
    call,
    classify: classifyGemini,
    suggest: suggestGemini,
  });
}
