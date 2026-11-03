/**
 * 클로드 (Anthropic 콘솔 키: sk-ant-…)
 * - 공식 SDK(@anthropic-ai/sdk)로 Messages API 호출
 * - 모델: 기본 claude-opus-5-5 (환경변수 CLAUDE_MODEL 로 바꿀 수 있음)
 * - 구조화 출력: output_config.format = json_schema
 * - 생각 깊이: output_config.effort (수업 중 대기 시간을 줄이려 low 기본)
 * - 안전 분류기가 거절하면 서버가 다른 모델로 다시 돌리도록 fallbacks: "default" 를 켠다
 *   (beta server-side-fallback-2026-07-01). 그래도 거절이면 stop_reason "refusal"
 */
import Anthropic from "@anthropic-ai/sdk";
import { AiError } from "./errors";
import type { AiRequest } from "./types";

export const CLAUDE_MODEL = () => (process.env.CLAUDE_MODEL || "claude-opus-5-5").trim();

type ClaudeImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export function toClaudeError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return new AiError(e.status, e.message, "key", "claude");
  }
  if (e instanceof Anthropic.NotFoundError) return new AiError(404, e.message, "retired", "claude");
  if (e instanceof Anthropic.RateLimitError) return new AiError(429, e.message, "quota", "claude");
  if (e instanceof Anthropic.BadRequestError) {
    // 크레딧이 없을 때는 400 으로 "credit balance is too low" 를 준다
    return new AiError(400, e.message, /credit|billing|balance/i.test(e.message) ? "billing" : "other", "claude");
  }
  if (e instanceof Anthropic.InternalServerError) return new AiError(e.status ?? 500, e.message, "busy", "claude");
  if (e instanceof Anthropic.APIConnectionError) return new AiError(0, e.message, "busy", "claude");
  if (e instanceof Anthropic.APIError) return new AiError(e.status ?? 0, e.message, "other", "claude");
  return new AiError(0, e instanceof Error ? e.message : "알 수 없는 오류", "other", "claude");
}

export async function generateClaude(req: AiRequest): Promise<{ json: unknown; model: string }> {
  const client = new Anthropic({ apiKey: req.key, maxRetries: 1, timeout: 55_000 });
  const model = CLAUDE_MODEL();
  try {
    const res = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: req.effort ?? "low",
        format: { type: "json_schema", schema: req.schema as Record<string, unknown> },
      },
      messages: [
        {
          role: "user",
          content: [
            ...(req.images ?? []).map((im) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: im.mimeType as ClaudeImageType, data: im.data },
            })),
            { type: "text" as const, text: req.prompt },
          ],
        },
      ],
    });
    if (res.stop_reason === "refusal") throw new AiError(200, "refusal", "refusal", "claude");
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    try {
      return { json: JSON.parse(text), model: res.model ?? model };
    } catch {
      throw new AiError(200, "AI 응답을 해석하지 못했어요", res.stop_reason === "max_tokens" ? "other" : "parse", "claude");
    }
  } catch (e) {
    throw toClaudeError(e);
  }
}
