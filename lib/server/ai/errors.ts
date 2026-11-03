/**
 * AI 호출 오류 — 공급자(제미나이·클로드·GPT)와 상관없이 같은 종류로 나눠 같은 안내문을 쓴다
 */
import { AI_NAME, type AiProvider } from "../../ai";

export type AiErrorKind =
  | "key"      // 키가 틀렸거나 권한 없음 → 설정에서 고쳐야 함
  | "billing"  // 유료 크레딧·결제가 필요함 (클로드·GPT)
  | "quota"    // 호출 한도 초과 (잠시 뒤 다시)
  | "busy"     // 서버 혼잡·시간 초과
  | "retired"  // 모델 은퇴·없음
  | "refusal"  // AI가 답을 거절
  | "parse"    // 응답 해석 실패
  | "other";

export class AiError extends Error {
  constructor(
    public status: number,
    message: string,
    public kind: AiErrorKind = "other",
    public provider: AiProvider = "gemini",
  ) {
    super(message);
    this.name = "AiError";
  }
}

export function friendlyAiMessage(e: AiError): string {
  const n = AI_NAME[e.provider];
  switch (e.kind) {
    case "key":
      return `${n} 키가 올바르지 않거나 권한이 없어요. 키를 빠짐없이 다시 복사하거나, 새 키를 만들어 넣어 보세요.`;
    case "billing":
      return `${n} 계정에 쓸 수 있는 크레딧(결제)이 없어요. ${e.provider === "claude" ? "Anthropic 콘솔" : "OpenAI 플랫폼"}에서 결제·크레딧을 확인하거나, 무료로 쓸 수 있는 제미나이를 골라 보세요.`;
    case "quota":
      return `${n} 호출 한도를 넘었어요. 잠시 뒤에 다시 시도하세요.${e.provider === "gemini" ? " (무료 한도는 한국 시간 오후 4~5시에 다시 채워져요)" : ""}`;
    case "busy":
      return `${n}가 지금 많이 바빠요. 잠시 후 다시 시도하세요.`;
    case "retired":
      return `이 키로 쓸 수 있는 ${n} 모델을 찾지 못했어요. (안내: ${e.message})`;
    case "refusal":
      return `${n}가 이 요청에는 답하지 않았어요. 다른 사진으로 다시 해 보세요.`;
    case "parse":
      return "AI 응답을 해석하지 못했어요. 한 번 더 시도해 주세요.";
    default:
      return `${n} 호출에 실패했어요. (${e.message})`;
  }
}

export function aiErrorResponse(e: unknown) {
  if (e instanceof AiError) {
    const bad = e.kind === "key";
    return Response.json(
      { error: bad ? "BAD_AI_KEY" : "AI_ERROR", provider: e.provider, status: e.status, kind: e.kind, message: friendlyAiMessage(e) },
      { status: bad ? 401 : 502 },
    );
  }
  const msg = e instanceof Error ? e.message : "알 수 없는 오류";
  return Response.json({ error: "SERVER_ERROR", message: msg }, { status: 500 });
}
