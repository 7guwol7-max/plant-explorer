import { NextRequest } from "next/server";
import { getKeys, isMock, noKey } from "@/lib/server/keys";
import { searchPlants, dataErrorResponse } from "@/lib/server/datagokr";

export const dynamic = "force-dynamic";

/** GET /api/plants/search?q=은행나무 → 국립수목원 식물도감 목록 검색 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return Response.json({ error: "EMPTY_QUERY", message: "검색어를 입력하세요" }, { status: 400 });

  const { dataKey } = getKeys(req);
  if (!dataKey && !isMock()) return noKey("NO_DATA_KEY");

  try {
    return Response.json(await searchPlants(q, dataKey));
  } catch (e) {
    return dataErrorResponse(e);
  }
}
