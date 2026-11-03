"use client";
import { useEffect, useState } from "react";

type Repo = { owner: string; slug: string; ref: string; sha: string; message: string; file: string };

/**
 * ✏️ 프롬프트로 앱 고치기 — 선생님 모드 카드
 * 연수에서 선생님이 실습 프롬프트로 자기 저장소의 app-settings.json 하나만 바꾸고,
 * Vercel 이 다시 배포한 결과를 바로 확인하게 돕는다.
 * - 이 앱을 만든 GitHub 저장소의 설정 파일 편집 화면으로 바로 가는 버튼
 * - '지금 앱 버전' (마지막으로 배포된 저장 내용) — 붙여 넣고 1~2분 뒤 새로고침하면 바뀐다
 */
export default function EditAppCard() {
  const [repo, setRepo] = useState<Repo | null | undefined>(undefined);
  const [api, setApi] = useState<{ connected: boolean; service: string } | null>(null);

  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setRepo(j.repo ?? null);
        setApi(j.dataApi ?? null);
      })
      .catch(() => setRepo(null));
  }, []);

  const base = repo ? `https://github.com/${repo.owner}/${repo.slug}` : "";
  const ref = repo ? repo.ref.split("/").map(encodeURIComponent).join("/") : "";

  return (
    <div className="card edit-app">
      <h2>✏️ 프롬프트로 앱 고치기</h2>
      <p className="small" style={{ marginTop: -4 }}>
        이 앱에서 우리 학교에 맞게 바꾸는 것은 모두 <code className="inline">app-settings.json</code> <strong>파일 하나</strong>에 있어요.
        (앱 이름·메뉴·장소·첫 화면 안내·새 화면·그림 도움말·교과서 연결 활동)
      </p>
      <ol className="steps-list">
        <li><a className="link" href="https://claude.ai/new" target="_blank" rel="noreferrer">클로드 새 채팅</a> → 입력창 <strong>+</strong> → <strong>Add from GitHub</strong> → {repo ? <strong>{repo.slug}</strong> : "내 저장소"} → <code className="inline">app-settings.json</code> 하나만 체크</li>
        <li>실습 프롬프트를 붙여 보내고, 클로드가 준 JSON 코드 블록의 <strong>Copy</strong></li>
        <li>아래 <strong>설정 파일 고치러 가기</strong> → 편집 칸 클릭 → <strong>Ctrl+A</strong> → <strong>Ctrl+V</strong> → <strong>Commit changes</strong></li>
        <li>1~2분 뒤 이 화면을 새로고침 → '지금 앱 버전'이 방금 저장한 내용으로 바뀌면 반영 끝!</li>
      </ol>
      {repo ? (
        <>
          <div className="row" style={{ marginTop: 10 }}>
            <a className="btn btn-primary" style={{ flex: 1 }} href={`${base}/edit/${ref}/${repo.file}`} target="_blank" rel="noreferrer">📝 설정 파일 고치러 가기</a>
            <a className="btn" style={{ flex: 1 }} href={`${base}/commits/${ref}`} target="_blank" rel="noreferrer">🕘 저장 기록 보기</a>
          </div>
          <div className="app-version small">
            <strong>지금 앱 버전</strong> {repo.message || "(저장 메시지 없음)"} <span className="muted">· {repo.sha}</span>
          </div>
        </>
      ) : repo === null ? (
        <p className="muted small">이 앱이 어느 GitHub 저장소에서 만들어졌는지 알 수 없어요(내 컴퓨터에서 실행 중이거나 Vercel 이 아닌 곳). 저장소의 <code className="inline">app-settings.json</code> 을 직접 열어 고쳐요.</p>
      ) : (
        <p className="muted small">저장소 정보를 불러오는 중…</p>
      )}
      {api && (
        <div className={`app-version small ${api.connected ? "" : "warn-box"}`}>
          <strong>공공데이터포털 API</strong>{" "}
          {api.connected ? `✅ 연결됨 — ${api.service}` : "⏳ 아직 연결 안 됨 — 실습 프롬프트로 app-settings.json 의 dataApi 를 채우면 연결돼요"}
        </div>
      )}
      <p className="muted small" style={{ marginBottom: 0 }}>
        붙여 넣은 내용이 틀려서 배포가 실패해도 앱은 직전 모습 그대로 열려요. 그럴 땐 클로드에게 &lsquo;JSON 이 맞는지 확인하고 파일 전체를 다시 줘&rsquo;라고 해요.
      </p>
    </div>
  );
}
