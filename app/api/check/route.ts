import { NextRequest } from "next/server";
import { getKeys, isMock } from "@/lib/server/keys";
import { searchPlants, DataGoKrError, friendlyDataMessage, KEY_ERROR_CODES } from "@/lib/server/datagokr";
import { checkAi } from "@/lib/server/ai/tasks";
import { AiError, friendlyAiMessage } from "@/lib/server/ai/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 제미나이 모델을 차례로 시도할 시간

/**
 * GET /api/check?target=data | ai   (ai 는 x-ai-provider 가 가리키는 공급자)
 * 설정 화면의 "연결 확인" 버튼이 호출. 헤더에 실린 키로 실제 호출을 한 번 해 본다.
 */
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("target");
  const { dataKey, ai, shared } = getKeys(req);

  if (target === "data") {
    if (!dataKey && !isMock()) return Response.json({ ok: false, message: "키를 입력하세요" });
    try {
      const r = await searchPlants("소나무", dataKey, { fresh: true });
      return Response.json({ ok: true, mock: isMock(), shared: !req.headers.get("x-data-key") && shared, sample: r.items[0]?.koreanName ?? null, totalCount: r.totalCount });
    } catch (e) {
      const code = e instanceof DataGoKrError ? e.code : "UNKNOWN";
      const message = e instanceof DataGoKrError ? friendlyDataMessage(e) : e instanceof Error ? e.message : "알 수 없는 오류";
      return Response.json({ ok: false, code, keyProblem: KEY_ERROR_CODES.has(code), message });
    }
  }

  if (target === "ai" || target === "gemini") {
    if (!ai.key && !isMock()) return Response.json({ ok: false, message: "키를 입력하세요" });
    try {
      const r = await checkAi(ai);
      return Response.json({ ok: r.ok, provider: ai.provider, model: r.model, mock: isMock(), shared: !req.headers.get("x-ai-key") && shared });
    } catch (e) {
      const ae = e instanceof AiError ? e : null;
      return Response.json({
        ok: false,
        provider: ai.provider,
        status: ae?.status ?? 0,
        kind: ae?.kind,
        keyProblem: ae?.kind === "key",
        message: ae ? friendlyAiMessage(ae) : e instanceof Error ? e.message : "알 수 없는 오류",
      });
    }
  }

  return Response.json({ error: "BAD_TARGET" }, { status: 400 });
}
