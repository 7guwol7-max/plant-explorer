import { NextRequest } from "next/server";
import { getKeys, isMock, noKey } from "@/lib/server/keys";
import { aboutUnlisted } from "@/lib/server/ai/tasks";
import { aiErrorResponse } from "@/lib/server/ai/errors";
import { searchPlants } from "@/lib/server/datagokr";
import { lookupOtherNames } from "@/lib/server/unlisted";
import { DEFAULT_GRADE, getStandard, isGradeBand, type Standard } from "@/lib/curriculum";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // AI 모델을 차례로 시도 + 도감 다시 찾기

/**
 * POST /api/unlisted  { koreanName, scientificName?, gradeBand, standards: ["[4과03-01]", …] }
 * 국립수목원 식물도감에서 찾지 못한 식물일 때:
 * 1) AI가 아는 정보를 학년 눈높이로 + 도감에 실렸을 수 있는 다른 이름
 * 2) 그 이름으로 국립수목원 도감을 다시 찾아본다 (공공데이터포털 키가 있을 때)
 * → { ...AI 정보, listedAs: 다른 이름으로 실린 항목 | null, relatives: 같은 속 도감 식물[], searched: 다시 찾아본 검색어[], checked: 다시 찾았는지 }
 */
export async function POST(req: NextRequest) {
  const { ai, dataKey } = getKeys(req);
  if (!ai.key && !isMock()) return noKey("NO_AI_KEY");

  let body: { koreanName?: unknown; scientificName?: unknown; gradeBand?: unknown; standards?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "BAD_JSON" }, { status: 400 });
  }
  const name = typeof body.koreanName === "string" ? body.koreanName.trim().slice(0, 40) : "";
  const sci = typeof body.scientificName === "string" ? body.scientificName.trim().slice(0, 80) : "";
  if (!name) return Response.json({ error: "NO_NAME", message: "식물 이름이 없어요" }, { status: 400 });

  const gradeBand = isGradeBand(body.gradeBand) ? body.gradeBand : DEFAULT_GRADE;
  const standards: Standard[] = (Array.isArray(body.standards) ? body.standards : [])
    .filter((c): c is string => typeof c === "string")
    .map(getStandard)
    .filter((s): s is Standard => Boolean(s) && s!.gradeBand === gradeBand)
    .slice(0, 4);

  let info;
  try {
    info = await aboutUnlisted(name, sci, gradeBand, ai, standards);
  } catch (e) {
    return aiErrorResponse(e);
  }

  const canSearch = Boolean(dataKey) || isMock();
  if (!info.known || !canSearch) return Response.json({ ...info, listedAs: null, relatives: [], searched: [], checked: false });

  const found = await lookupOtherNames(
    { asked: { koreanName: name, scientificName: sci }, ai: info },
    async (q) => (await searchPlants(q, dataKey)).items,
  );
  return Response.json({ ...info, ...found, checked: true });
}
