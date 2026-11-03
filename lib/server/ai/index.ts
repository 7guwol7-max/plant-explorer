/**
 * AI 공급자 고르기 — 화면이 보낸 공급자(x-ai-provider)와 키(x-ai-key)로 알맞은 모듈을 부른다
 */
import type { AiProvider } from "../../ai";
import { generateGemini } from "./gemini";
import { generateClaude } from "./claude";
import { generateOpenAI } from "./openai";
import type { AiRequest } from "./types";

export type AiTarget = { provider: AiProvider; key: string };

export function generateJSON(target: AiTarget, req: Omit<AiRequest, "key">): Promise<{ json: unknown; model: string }> {
  const full = { ...req, key: target.key };
  switch (target.provider) {
    case "claude":
      return generateClaude(full);
    case "openai":
      return generateOpenAI(full);
    default:
      return generateGemini(full);
  }
}

export { AiError, aiErrorResponse, friendlyAiMessage } from "./errors";
