import { NextRequest } from "next/server";
import { getKeys, isMock } from "@/lib/server/keys";
import { searchPlants, DataGoKrError, friendlyDataMessage, KEY_ERROR_CODES } from "@/lib/server/datagokr";
import { checkGemini, GeminiError } from "@/lib/server/gemini";

export const dynamic = "force-dynamic";

/**
 * GET /api/check?target=data | gemini
 * 설정 화면의 "연결 확인" 버튼이 호출. 헤더에 실린 키로 실제 호출을 한 번 해 본다.
 */
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("target");
  const { dataKey, geminiKey, shared } = getKeys(req);

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

  if (target === "gemini") {
    if (!geminiKey && !isMock()) return Response.json({ ok: false, message: "키를 입력하세요" });
    try {
      const ok = await checkGemini(geminiKey);
      return Response.json({ ok, mock: isMock(), shared: !req.headers.get("x-gemini-key") && shared });
    } catch (e) {
      const status = e instanceof GeminiError ? e.status : 0;
      const message =
        status === 400 || status === 403
          ? "키가 올바르지 않거나 권한이 없어요. AI 스튜디오에서 키를 다시 확인하세요."
          : status === 429
            ? "호출 한도를 넘었어요. 잠시 후 다시 시도하세요."
            : status === 404
              ? "모델 이름을 찾지 못했어요. 서버의 GEMINI_MODEL 설정을 확인하세요."
              : e instanceof Error ? e.message : "알 수 없는 오류";
      return Response.json({ ok: false, status, message });
    }
  }

  return Response.json({ error: "BAD_TARGET" }, { status: 400 });
}
