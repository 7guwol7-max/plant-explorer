import { NextRequest } from "next/server";
import { getKeys, isMock, noKey } from "@/lib/server/keys";
import { identify, geminiErrorResponse } from "@/lib/server/gemini";

export const dynamic = "force-dynamic";

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_BASE64 = 6_000_000; // 약 4.5MB

/**
 * POST /api/identify  { image: "data:image/jpeg;base64,...", taxon: "plant" | "insect" }
 * → 제미나이가 후보 2~3종을 제안. 사진은 호출 후 버리며 저장하지 않는다.
 */
export async function POST(req: NextRequest) {
  const { geminiKey } = getKeys(req);
  if (!geminiKey && !isMock()) return noKey("NO_GEMINI_KEY");

  let body: { image?: string; taxon?: "plant" | "insect" };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "BAD_JSON" }, { status: 400 });
  }

  const m = DATA_URL.exec(body.image ?? "");
  if (!m) return Response.json({ error: "BAD_IMAGE", message: "jpeg/png/webp 사진만 보낼 수 있어요" }, { status: 400 });
  if (m[2].length > MAX_BASE64) return Response.json({ error: "TOO_LARGE", message: "사진이 너무 커요" }, { status: 413 });

  try {
    const result = await identify(m[2], m[1], body.taxon === "insect" ? "insect" : "plant", geminiKey);
    return Response.json(result);
  } catch (e) {
    return geminiErrorResponse(e);
  }
}
