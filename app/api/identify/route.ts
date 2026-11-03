import { NextRequest } from "next/server";
import { getKeys, isMock, noKey } from "@/lib/server/keys";
import { identify } from "@/lib/server/ai/tasks";
import { aiErrorResponse } from "@/lib/server/ai/errors";
import { parseImages } from "@/lib/server/images";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 모델을 차례로 시도할 시간

/**
 * POST /api/identify  { images: ["data:image/jpeg;base64,...", …(최대 3장)] }
 * → 고른 AI(제미나이·클로드·GPT)가 후보 2~3종을 제안. 같은 식물을 여러 방향에서 찍은 사진을 함께 보면 더 정확하다.
 *   사진은 호출 후 버리며 저장하지 않는다.
 */
export async function POST(req: NextRequest) {
  const { ai } = getKeys(req);
  if (!ai.key && !isMock()) return noKey("NO_AI_KEY");

  let body: { image?: unknown; images?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "BAD_JSON" }, { status: 400 });
  }

  const parsed = parseImages(body);
  if (!parsed.ok) return Response.json({ error: parsed.error, message: parsed.message }, { status: parsed.status });

  try {
    return Response.json(await identify(parsed.images, ai));
  } catch (e) {
    return aiErrorResponse(e);
  }
}
