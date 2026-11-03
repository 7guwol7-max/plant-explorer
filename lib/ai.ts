/**
 * AI 공급자 (브라우저·서버 공용)
 * 사진으로 식물 알아보기·쉬운 설명에 쓸 AI를 사용자가 고른다: 제미나이 / 클로드 / GPT
 */
export type AiProvider = "gemini" | "claude" | "openai";
export const AI_PROVIDERS: AiProvider[] = ["gemini", "claude", "openai"];

export const AI_NAME: Record<AiProvider, string> = { gemini: "제미나이", claude: "클로드", openai: "GPT" };
export const AI_MAKER: Record<AiProvider, string> = { gemini: "구글", claude: "Anthropic", openai: "OpenAI" };

export const isAiProvider = (v: unknown): v is AiProvider => typeof v === "string" && (AI_PROVIDERS as string[]).includes(v);

/** 키 모양으로 어느 회사 키인지 짐작한다 (붙여 넣은 키에 맞춰 공급자를 바꿔 주기 위해) */
export function detectProvider(key: string | null | undefined): AiProvider | undefined {
  const k = (key ?? "").trim();
  if (/^sk-ant-/i.test(k)) return "claude";
  if (/^sk-/i.test(k)) return "openai";
  if (/^AIza/.test(k) || /^AQ\./.test(k)) return "gemini";
  return undefined;
}

/** 공백·따옴표 지우기 */
export function normalizeAiKey(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").replace(/\s+/g, "");
}
