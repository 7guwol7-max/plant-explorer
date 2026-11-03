import { serverMode } from "@/lib/server/keys";

export const dynamic = "force-dynamic";

/**
 * GET /api/config → { mock, sharedData, sharedGemini }
 * 화면이 "이 사람은 키를 넣어야 하나?"를 판단할 때 쓴다. 키 값은 보내지 않는다.
 */
export function GET() {
  return Response.json(serverMode(), { headers: { "cache-control": "no-store" } });
}
