import { NextRequest } from "next/server";
import { getKeys, isMock, noKey } from "@/lib/server/keys";
import { explain, geminiErrorResponse } from "@/lib/server/gemini";
import { DEFAULT_GRADE, GRADE_LABEL, getStandard, isGradeBand, type Standard } from "@/lib/curriculum";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 제미나이 모델을 차례로 시도할 시간

/**
 * POST /api/explain  { official: {...국립수목원 상세 항목}, gradeBand: "3-4", standards: ["[4과03-01]", …] }
 * → 쉬운 설명(3~4문장) + 관찰 질문 3개 + 유사종 비교 힌트
 *   서버는 원문만 넘기고, 원문에 없는 사실을 쓰지 않도록 지시한다.
 *   성취기준은 코드만 받고 문장은 서버의 data/curriculum.json 에서 찾는다 (임의 문장이 프롬프트에 섞이지 않게).
 */
export async function POST(req: NextRequest) {
  const { geminiKey } = getKeys(req);
  if (!geminiKey && !isMock()) return noKey("NO_GEMINI_KEY");

  let body: { official?: Record<string, string>; gradeBand?: string; standards?: unknown };
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

  const gradeBand = isGradeBand(body.gradeBand) ? body.gradeBand : DEFAULT_GRADE;
  const standards: Standard[] = (Array.isArray(body.standards) ? body.standards : [])
    .filter((c): c is string => typeof c === "string")
    .map(getStandard)
    .filter((s): s is Standard => Boolean(s) && s!.gradeBand === gradeBand)
    .slice(0, 4);

  try {
    const result = await explain(official, GRADE_LABEL[gradeBand], geminiKey, standards);
    return Response.json(result);
  } catch (e) {
    return geminiErrorResponse(e);
  }
}
