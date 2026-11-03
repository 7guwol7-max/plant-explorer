import { NextRequest } from "next/server";
import { getKeys, isMock } from "@/lib/server/keys";
import { searchPlants, DataGoKrError } from "@/lib/server/datagokr";
import { checkGemini, GeminiError } from "@/lib/server/gemini";

export const dynamic = "force-dynamic";

/** 공공데이터포털 결과코드 → 사용자 안내문 */
const DATA_CODE_MSG: Record<string, string> = {
  "20": "활용신청이 승인되지 않았거나 접근 권한이 없어요. 마이페이지에서 승인 상태를 확인하세요.",
  "22": "오늘 호출 한도(개발계정 1,000건)를 넘었어요. 내일 다시 시도하세요.",
  "30": "등록되지 않은 키예요. '디코딩(Decoding)' 키를 넣었는지, 신규 발급이면 반영 시간을 기다렸는지 확인하세요.",
  "31": "키 사용 기한이 만료되었어요. 공공데이터포털에서 연장하세요.",
  "10": "요청 형식 오류예요. (서버 코드 점검 필요)",
  "11": "필수 요청 값이 빠졌어요. (서버 코드 점검 필요)",
  "05": "국립수목원 서버가 응답하지 않아요. 잠시 후 다시 시도하세요.",
  NETWORK: "국립수목원 서버에 연결하지 못했어요. 인터넷 연결을 확인하세요.",
};

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
      const r = await searchPlants("소나무", dataKey);
      return Response.json({ ok: true, mock: isMock(), shared: !req.headers.get("x-data-key") && shared, sample: r.items[0]?.koreanName ?? null, totalCount: r.totalCount });
    } catch (e) {
      const code = e instanceof DataGoKrError ? e.code : "UNKNOWN";
      const message = DATA_CODE_MSG[code] ?? (e instanceof Error ? e.message : "알 수 없는 오류");
      return Response.json({ ok: false, code, message });
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
