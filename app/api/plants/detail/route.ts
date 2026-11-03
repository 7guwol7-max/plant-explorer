import { NextRequest } from "next/server";
import { getKeys, isMock, noKey } from "@/lib/server/keys";
import { getPlantDetail, dataErrorResponse } from "@/lib/server/datagokr";

export const dynamic = "force-dynamic";

/** GET /api/plants/detail?no=도감번호 → 국립수목원 식물도감 상세정보 */
export async function GET(req: NextRequest) {
  const no = (req.nextUrl.searchParams.get("no") ?? "").trim();
  if (!no) return Response.json({ error: "EMPTY_NO", message: "도감번호가 없어요" }, { status: 400 });

  const { dataKey } = getKeys(req);
  if (!dataKey && !isMock()) return noKey("NO_DATA_KEY");

  try {
    const detail = await getPlantDetail(no, dataKey);
    if (!detail) return Response.json({ notFound: true }, { status: 404 });
    return Response.json(detail);
  } catch (e) {
    return dataErrorResponse(e);
  }
}
