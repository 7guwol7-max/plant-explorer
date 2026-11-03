"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, loadKeys, saveKeys, clearKeys, isPersisted, type Keys } from "@/lib/client/keys";
import { useConnection } from "@/lib/client/useConnection";
import { normalizeDataKey } from "@/lib/datakey";
import { loadGrade, saveGrade } from "@/lib/client/prefs";
import { GRADE_BANDS, GRADE_LABEL, type GradeBand } from "@/lib/curriculum";

type Check = { state: "idle" | "busy" | "ok" | "bad"; message?: string; keyProblem?: boolean };

const PORTAL = "https://www.data.go.kr";
const DEV_ACCOUNT = "https://www.data.go.kr/iim/api/selectAPIAcountView.do";
const AI_STUDIO = "https://aistudio.google.com/apikey";
const PURPOSE =
  "초등학교 과학 수업에서 학생이 학교 식물을 사진으로 관찰하고, 국립수목원 식물도감 공식 정보를 조회해 교육과정과 연결된 관찰 기록을 작성하는 비영리 교육용 웹앱에 활용합니다.";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <Settings />
    </Suspense>
  );
}

function Settings() {
  const params = useSearchParams();
  const need = params.get("need");
  const conn = useConnection();

  const [dataKey, setDataKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [persist, setPersist] = useState(true);
  const [showData, setShowData] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [dataCheck, setDataCheck] = useState<Check>({ state: "idle" });
  const [geminiCheck, setGeminiCheck] = useState<Check>({ state: "idle" });
  const [saved, setSaved] = useState<string | null>(null);
  const [grade, setGrade] = useState<GradeBand>("3-4");
  const [hadKey, setHadKey] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const k = loadKeys();
    setDataKey(k.dataKey ?? "");
    setGeminiKey(k.geminiKey ?? "");
    setHadKey(Boolean(k.dataKey));
    setPersist(isPersisted() || !(k.dataKey || k.geminiKey));
    setGrade(loadGrade());
  }, []);

  const dataInfo = normalizeDataKey(dataKey);

  /** 입력란의 값으로 실제 호출을 한 번 해 본다 (저장 전에도 가능) */
  async function check(target: "data" | "gemini", keys: Keys = { dataKey, geminiKey }) {
    const set = target === "data" ? setDataCheck : setGeminiCheck;
    set({ state: "busy" });
    try {
      const res = await api(`/api/check?target=${target}`, {}, keys);
      const j = await res.json();
      if (j.ok) {
        set({
          state: "ok",
          message: j.mock
            ? "연습 모드예요 (실제 키 없이도 동작)"
            : j.shared
              ? "강사 공유 키로 연결됨"
              : target === "data"
                ? `국립수목원 연결 성공! (시험 검색: ${j.sample ?? "소나무"})`
                : "제미나이 연결 성공!",
        });
      } else {
        set({ state: "bad", message: j.message ?? "연결 실패", keyProblem: Boolean(j.keyProblem) });
      }
    } catch {
      set({ state: "bad", message: "앱 서버에 연결하지 못했어요. 인터넷 연결을 확인하세요." });
    }
  }

  /** 저장하고, 넣은 키는 바로 연결 확인까지 */
  async function save() {
    const ok = saveKeys({ dataKey, geminiKey }, persist);
    const clean = { dataKey: dataInfo.key, geminiKey: geminiKey.trim() };
    setDataKey(clean.dataKey);
    setSaved(ok ? (persist ? "이 기기에 저장했어요." : "이번 사용만 적용했어요. 탭을 닫으면 사라져요.") : "이 브라우저는 저장을 막고 있어요(사생활 보호 창 등). 일반 창에서 다시 해 주세요.");
    setHadKey(Boolean(clean.dataKey));
    const jobs: Promise<void>[] = [];
    if (clean.dataKey) jobs.push(check("data", clean));
    if (clean.geminiKey) jobs.push(check("gemini", clean));
    await Promise.all(jobs);
  }

  function remove() {
    if (!confirm("이 기기에서 키를 모두 지울까요?")) return;
    clearKeys();
    setDataKey("");
    setGeminiKey("");
    setDataCheck({ state: "idle" });
    setGeminiCheck({ state: "idle" });
    setHadKey(false);
    setSaved("지웠어요.");
  }

  function pickGrade(g: GradeBand) {
    setGrade(g);
    saveGrade(g);
  }

  async function copyPurpose() {
    try {
      await navigator.clipboard.writeText(PURPOSE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const ready = dataCheck.state === "ok" || (conn.ready && conn.data && dataCheck.state !== "bad");

  return (
    <>
      {need === "NO_DATA_KEY" && <div className="alert warn">국립수목원 정보를 보려면 공공데이터포털 인증키가 필요해요. 아래 순서대로 넣어 주세요.</div>}
      {conn.mock && <div className="alert ok">지금은 <strong>연습 모드</strong>예요. 키 없이 연습 자료로 모든 화면을 써 볼 수 있어요.</div>}
      {!conn.mock && conn.sharedData && !conn.ownData && <div className="alert ok">선생님(강사)이 준비한 공유 키로 연결돼 있어요. 내 키를 넣으면 내 키를 먼저 써요.</div>}

      <div className="card">
        <h2>⚙️ 내 키로 연결하기</h2>
        <p className="small" style={{ margin: 0 }}>
          이 앱은 <strong>쓰는 사람마다 자기 키</strong>를 넣어 써요. 키는 <strong>이 기기의 브라우저</strong>에만 저장되고, 요청할 때만 앱 서버를 거쳐 국립수목원·제미나이로 전달돼요. 서버는 키를 저장하거나 기록하지 않아요.
        </p>
        <ol className="steps-list">
          <li><strong>키 받기</strong> — 공공데이터포털에서 무료로 (5분)</li>
          <li><strong>붙여 넣기</strong> — 아래 칸에</li>
          <li><strong>저장하고 연결 확인</strong> — 초록 글씨가 나오면 끝</li>
        </ol>
      </div>

      {/* 1. 공공데이터포털 — 필수 */}
      <div className="card">
        <h2>1. 공공데이터포털 인증키 <span className="badge official">꼭 필요</span></h2>
        <p className="muted small" style={{ marginTop: -4 }}>국립수목원 식물도감의 공식 정보를 불러올 때 써요.</p>

        <details className="guide" open={!hadKey}>
          <summary>키 받는 방법 (처음이면 열어 보세요)</summary>
          <ol>
            <li>
              공공데이터포털에 회원가입하고 로그인해요.{" "}
              <a href={PORTAL} target="_blank" rel="noreferrer">공공데이터포털 열기 ↗</a>
            </li>
            <li>
              검색창에 <strong>국립수목원 식물자원</strong>을 검색해 <strong>‘산림청 국립수목원_식물자원 조회 서비스’</strong>(오픈 API)를 열고 <strong>활용신청</strong>을 눌러요. 자동으로 승인돼요.
              <div className="purpose">
                <span className="muted small">활용 목적 칸 예시</span>
                <p className="small" style={{ margin: "4px 0 6px" }}>{PURPOSE}</p>
                <button className="btn btn-sm" type="button" onClick={copyPurpose}>{copied ? "복사됨 ✓" : "예시 복사"}</button>
              </div>
            </li>
            <li>
              <strong>마이페이지 → 개발계정</strong>에서 그 서비스를 눌러 <strong>일반 인증키</strong>를 복사해요.{" "}
              <a href={DEV_ACCOUNT} target="_blank" rel="noreferrer">개발계정 화면 열기 ↗</a>
              <div className="muted small">Encoding·Decoding 어느 쪽을 복사해도 괜찮아요. 앱이 알아서 맞춰요.</div>
            </li>
            <li>아래 칸에 붙여 넣고 <strong>저장하고 연결 확인</strong>을 눌러요.</li>
          </ol>
          <ul className="tips small">
            <li>다른 API 때문에 이미 키가 있어도, 이 서비스는 <strong>따로 활용신청</strong>을 해야 해요. (키 글자는 같아요)</li>
            <li>방금 신청했다면 키가 반영될 때까지 시간이 걸릴 수 있어요. 수업 전날까지 받아 두세요.</li>
            <li>개발계정은 하루 1,000번까지 불러올 수 있어요. 같은 식물은 앱 서버가 기억해서 호출을 아껴요.</li>
          </ul>
        </details>

        <label className="field" style={{ marginTop: 12 }}>
          <span>일반 인증키</span>
          <div className="row">
            <input className="input" style={{ flex: 1 }} type={showData ? "text" : "password"} autoComplete="off" spellCheck={false} value={dataKey} onChange={(e) => { setDataKey(e.target.value); setDataCheck({ state: "idle" }); }} placeholder="마이페이지 → 개발계정 → 일반 인증키" />
            <button className="btn btn-sm" type="button" onClick={() => setShowData((v) => !v)}>{showData ? "가리기" : "보기"}</button>
          </div>
        </label>
        {dataInfo.kind === "encoding" && <p className="small ok-text">✓ 인코딩 키를 넣었네요. 저장할 때 디코딩 키로 바꿔 둘게요.</p>}
        {dataInfo.kind === "url" && <p className="small ok-text">✓ 주소를 통째로 넣었네요. 그 안의 키만 꺼내 쓸게요.</p>}
        <div className="row">
          <button className="btn btn-sm" type="button" disabled={!dataInfo.key || dataCheck.state === "busy"} onClick={() => check("data")}>{dataCheck.state === "busy" ? "확인 중…" : "연결 확인"}</button>
          {dataCheck.state === "ok" && <span className="badge official">✓ {dataCheck.message}</span>}
        </div>
        {dataCheck.state === "bad" && (
          <div className="alert err" style={{ marginTop: 10 }}>
            ✗ {dataCheck.message}
            {dataCheck.keyProblem && (
              <div style={{ marginTop: 6 }}>
                <a href={DEV_ACCOUNT} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>공공데이터포털 개발계정 화면에서 확인하기 ↗</a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. 제미나이 — 선택 */}
      <div className="card">
        <h2>2. 제미나이 API 키 <span className="badge ai">있으면 좋아요</span></h2>
        <p className="muted small" style={{ marginTop: -4 }}>
          사진을 보고 식물 후보를 알려 주고, 공식 정보를 쉬운 말로 풀어 줘요. <strong>없어도</strong> 식물 이름을 직접 넣어 공식 정보·교과서 연결·관찰 기록을 모두 쓸 수 있어요.
        </p>
        <label className="field">
          <span>구글 AI 스튜디오에서 만든 키</span>
          <div className="row">
            <input className="input" style={{ flex: 1 }} type={showGemini ? "text" : "password"} autoComplete="off" spellCheck={false} value={geminiKey} onChange={(e) => { setGeminiKey(e.target.value); setGeminiCheck({ state: "idle" }); }} placeholder="AIza… 로 시작" />
            <button className="btn btn-sm" type="button" onClick={() => setShowGemini((v) => !v)}>{showGemini ? "가리기" : "보기"}</button>
          </div>
        </label>
        <div className="row">
          <button className="btn btn-sm" type="button" disabled={!geminiKey.trim() || geminiCheck.state === "busy"} onClick={() => check("gemini")}>{geminiCheck.state === "busy" ? "확인 중…" : "연결 확인"}</button>
          {geminiCheck.state === "ok" && <span className="badge official">✓ {geminiCheck.message}</span>}
        </div>
        {geminiCheck.state === "bad" && <div className="alert err" style={{ marginTop: 10 }}>✗ {geminiCheck.message}</div>}
        <details className="guide" style={{ marginTop: 10 }}>
          <summary>키 받는 방법과 주의</summary>
          <ol>
            <li>구글 AI 스튜디오에서 API 키를 만들어요. <a href={AI_STUDIO} target="_blank" rel="noreferrer">AI 스튜디오 열기 ↗</a></li>
            <li><strong>결제 계정을 연결하지 않은 프로젝트</strong>로 만들면 한도를 넘어도 요금이 생기지 않아요.</li>
            <li>무료 한도는 미국 태평양 시간 자정(한국 오후 4~5시)에 다시 채워져요.</li>
          </ol>
        </details>
      </div>

      {/* 3. 학년 */}
      <div className="card">
        <h2>3. 학년</h2>
        <p className="muted small" style={{ marginTop: -4 }}>교과서 연결과 AI 설명의 낱말 수준이 학년에 맞춰져요.</p>
        <div className="chips">
          {GRADE_BANDS.map((g) => (
            <button key={g} className={`chip ${grade === g ? "on" : ""}`} onClick={() => pickGrade(g)}>{GRADE_LABEL[g]}</button>
          ))}
        </div>
      </div>

      {/* 4. 저장 */}
      <div className="card">
        <h2>4. 저장</h2>
        <div className="chips">
          <button className={`chip ${persist ? "on" : ""}`} onClick={() => setPersist(true)}>이 기기에 저장 (내 휴대폰·학급 태블릿)</button>
          <button className={`chip ${!persist ? "on" : ""}`} onClick={() => setPersist(false)}>이번만 사용 (공용 컴퓨터)</button>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={save} disabled={!dataInfo.key && !geminiKey.trim()}>저장하고 연결 확인</button>
          {saved && <div className="alert ok">{saved}</div>}
          {ready && saved && (
            <Link href="/" className="btn btn-ai">🌿 준비 끝! 식물 찾으러 가기 →</Link>
          )}
          <button className="btn btn-danger" onClick={remove}>이 기기에서 키 삭제</button>
        </div>
      </div>

      <div className="card">
        <h2>선생님용</h2>
        <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
          <li>학급 기기 여러 대에 같은 키를 넣으려면 <Link href="/teacher" className="link">학급 설정 QR →</Link></li>
          <li>이 앱이 어떤 성취기준과 이어지는지 <Link href="/curriculum" className="link">교육과정 연결표 →</Link></li>
          <li>다른 선생님께 이 앱을 알려 줄 때는 주소만 보내면 돼요. 각자 이 화면에서 자기 키를 넣으면 연결돼요.</li>
        </ul>
      </div>
    </>
  );
}
