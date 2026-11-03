import raw from "@/app-settings.json";

export const dynamic = "force-static";

/**
 * GET /api/settings-file → 지금 배포된 app-settings.json 내용 (글자 그대로)
 * 선생님 모드 '📋 지금 설정 파일 복사' 버튼이 쓴다. 클로드 채팅에 GitHub 를 연결하지 않아도
 * 이 내용을 붙여 넣고 프롬프트를 보내면 된다. (키는 이 파일에 없으므로 공개돼도 괜찮다)
 */
export function GET() {
  return new Response(JSON.stringify(raw, null, 2) + "\n", {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
