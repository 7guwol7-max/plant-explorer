/**
 * GPT (OpenAI 플랫폼 키: sk-… / sk-proj-…)
 * - Chat Completions REST 호출, 사진은 data URL 로
 * - 구조화 출력: response_format json_schema (strict)
 * - 모델: 환경변수 OPENAI_MODEL(쉼표로 여러 개) → 최근 성공 → 기본 목록을 차례로 (chain.ts)
 * - reasoning_effort 를 모르는 모델이면 빼고 다시 보낸다
 */
import { runChain, modelCandidates, postJson, type Attempt, type Failure } from "./chain";
import type { AiErrorKind } from "./errors";
import type { AiRequest } from "./types";

export const OPENAI_MODELS = ["gpt-5-mini", "gpt-5", "gpt-4.1-mini", "gpt-4o-mini"];

export function classifyOpenAI(f: Failure): AiErrorKind | "degrade" {
  const { status, message, code } = f;
  if (status === 401 || status === 403) return "key";
  if (code === "insufficient_quota" || /insufficient_quota|billing/i.test(message)) return "billing";
  if (status === 400 && /reasoning_effort|reasoning\.effort/i.test(message)) return "degrade";
  if (status === 404 || code === "model_not_found" || /does not exist|model_not_found/i.test(message)) return "retired";
  if (status === 429) return "quota";
  if (status === 0 || status >= 500) return "busy";
  if (status === 200 && message === "refusal") return "refusal";
  if (status === 200) return "parse";
  return "other";
}

export async function generateOpenAI(req: AiRequest): Promise<{ json: unknown; model: string }> {
  const content = [
    ...(req.images ?? []).map((im) => ({ type: "image_url", image_url: { url: `data:${im.mimeType};base64,${im.data}` } })),
    { type: "text", text: req.prompt },
  ];

  const call = async (model: string, variant: 0 | 1, timeoutMs: number): Promise<Attempt> => {
    const r = await postJson(
      "https://api.openai.com/v1/chat/completions",
      { authorization: `Bearer ${req.key}` },
      {
        model,
        messages: [{ role: "user", content }],
        response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema: req.schema } },
        ...(variant === 0 ? { reasoning_effort: req.effort ?? "low" } : {}),
      },
      timeoutMs,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = r.data as any;
    if (!r.ok) return { ok: false, status: r.status, message: d?.error?.message ?? r.text.slice(0, 400), code: d?.error?.code ?? d?.error?.type };
    const msg = d?.choices?.[0]?.message;
    if (msg?.refusal) return { ok: false, status: 200, message: "refusal" };
    try {
      return { ok: true, json: JSON.parse(msg?.content ?? "") };
    } catch {
      return { ok: false, status: 200, message: "AI 응답을 해석하지 못했어요" };
    }
  };

  return runChain({
    provider: "openai",
    models: modelCandidates("openai", process.env.OPENAI_MODEL, OPENAI_MODELS),
    call,
    classify: classifyOpenAI,
  });
}
