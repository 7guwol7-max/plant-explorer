import { serverMode } from "@/lib/server/keys";
import { SETTINGS, SETTINGS_FILE } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/config → { mock, sharedData, sharedAi, sharedAiProvider, repo, dataApi }
 * - 화면이 "이 사람은 키를 넣어야 하나?"를 판단할 때 쓴다. 키 값은 보내지 않는다.
 * - repo: 이 앱을 만든 GitHub 저장소와 지금 배포된 저장 내용 (Vercel 이 넣어 주는 시스템 환경변수)
 *   선생님 모드의 '✏️ 앱 고치기' 카드가 설정 파일 편집 주소와 '지금 앱 버전'을 보여 줄 때 쓴다.
 */
export function GET() {
  const e = process.env;
  const repo =
    e.VERCEL_GIT_REPO_OWNER && e.VERCEL_GIT_REPO_SLUG
      ? {
          owner: e.VERCEL_GIT_REPO_OWNER,
          slug: e.VERCEL_GIT_REPO_SLUG,
          ref: e.VERCEL_GIT_COMMIT_REF || "main",
          sha: (e.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7),
          message: (e.VERCEL_GIT_COMMIT_MESSAGE || "").split("\n")[0].slice(0, 80),
          file: SETTINGS_FILE,
        }
      : null;
  // 공공데이터포털 API 연결 정보가 app-settings.json 에 있는지 (주소만, 키 아님)
  const dataApi = SETTINGS.dataApi ? { connected: true, service: SETTINGS.dataApi.service } : { connected: false, service: "" };
  return Response.json({ ...serverMode(), repo, dataApi }, { headers: { "cache-control": "no-store" } });
}
