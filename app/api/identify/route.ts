import { NextRequest } from "next/server";
import { getKeys, isMock, noKey } from "@/lib/server/keys";
import { identify, geminiErrorResponse } from "@/lib/server/gemini";
import { parseImages } from "@/lib/server/images";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 제미나이 모델을 차례로 시도할 시간

/**
 * POST /api/identify  { images: ["data:image/jpeg;base64,...", …(최대 3장)], taxon: "plant" | "insect" }
 * → 제미나이가 후보 2~3종을 제안. 같은 식물을 여러 방향에서 찍은 사진을 함께 보면 더 정확하다.
 *   사진은 호출 후 버리며 저장하지 않는다.
 */
export async function POST(req: NextRequest) {
  const { geminiKey } = getKeys(req);
  if (!geminiKey && !isMock()) return noKey("NO_GEMINI_KEY");

  let body: { image?: unknown; images?: unknown; taxon?: "plant" | "insect" };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "BAD_JSON" }, { status: 400 });
  }

  const parsed = parseImages(body);
  if (!parsed.ok) return Response.json({ error: parsed.error, message: parsed.message }, { status: parsed.status });

  try {
    const result = await identify(parsed.images, body.taxon === "insect" ? "insect" : "plant", geminiKey);
    return Response.json(result);
  } catch (e) {
    return geminiErrorResponse(e);
  }
}
