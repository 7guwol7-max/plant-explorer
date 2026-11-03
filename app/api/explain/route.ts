import { NextRequest } from "next/server";
import { getKeys, isMock, noKey } from "@/lib/server/keys";
import { explain, geminiErrorResponse } from "@/lib/server/gemini";

export const dynamic = "force-dynamic";

/**
 * POST /api/explain  { official: {...국립수목원 상세 항목}, grade: "3~4학년" }
 * → 쉬운 설명(3~4문장) + 관찰 질문 3개 + 유사종 비교 힌트
 *   서버는 원문만 넘기고, 원문에 없는 사실을 쓰지 않도록 지시한다.
 */
export async function POST(req: NextRequest) {
  const { geminiKey } = getKeys(req);
  if (!geminiKey && !isMock()) return noKey("NO_GEMINI_KEY");

  let body: { official?: Record<string, string>; grade?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "BAD_JSON" }, { status: 400 });
  }
  if (!body.official || typeof body.official !== "object") {
    return Response.json({ error: "NO_OFFICIAL", message: "공식 정보가 없어요" }, { status: 400 });
  }

  // 설명에 쓰는 항목만 추려서 넘긴다 (빈 항목 제거)
  const allow = ["koreanName", "scientificName", "family", "shpe", "spft", "grwEvrntDesc", "dstrb", "osDstrb", "rrngType", "rrngGubun", "smlrPlntDesc", "useMthdDesc", "prtcPlnDesc", "orplcNm", "inductionDesc"];
  const official: Record<string, string> = {};
  for (const k of allow) {
    const v = body.official[k];
    if (typeof v === "string" && v.trim()) official[k] = v.trim();
  }

  try {
    const result = await explain(official, body.grade || "3~4학년", geminiKey);
    return Response.json(result);
  } catch (e) {
    return geminiErrorResponse(e);
  }
}
