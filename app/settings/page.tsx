"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, loadKeys, saveKeys, clearKeys, isPersisted, activeProvider, type Keys } from "@/lib/client/keys";
import { AI_MAKER, AI_NAME, AI_PROVIDERS, detectProvider, normalizeAiKey, type AiProvider } from "@/lib/ai";
import { useConnection } from "@/lib/client/useConnection";
import { normalizeDataKey } from "@/lib/datakey";
import { loadGrade, saveGrade } from "@/lib/client/prefs";
import { GRADE_BANDS, GRADE_LABEL, type GradeBand } from "@/lib/curriculum";

type Check = { state: "idle" | "busy" | "ok" | "bad"; message?: string; keyProblem?: boolean };

const PORTAL = "https://www.data.go.kr";
const DEV_ACCOUNT = "https://www.data.go.kr/iim/api/selectAPIAcountView.do";
const AI_STUDIO = "https://aistudio.google.com/apikey";
const CLAUDE_CONSOLE = "https://platform.claude.com";
const OPENAI_KEYS = "https://platform.openai.com/api-keys";

/** AI 공급자별 안내 */
const AI_INFO: Record<AiProvider, { cost: string; placeholder: string; link: string; linkLabel: string; steps: string[] }> = {
  gemini: {
    cost: "무료로 시작할 수 있어요",
    placeholder: "AQ.… 또는 AIza… 로 시작",
    link: AI_STUDIO,
    linkLabel: "구글 AI 스튜디오 열기",
    steps: [
      "구글 계정으로 AI 스튜디오에 들어가 'API 키 만들기'를 눌러요. 요즘 키는 AQ.로, 예전 키는 AIza로 시작해요.",
      "결제 계정을 연결하지 않은 프로젝트로 만들면 한도를 넘어도 요금이 생기지 않아요.",
      "무료 한도는 미국 태평양 시간 자정(한국 오후 4~5시)에 다시 채워져요.",
    ],
  },
  claude: {
    cost: "유료 (크레딧 충전 필요)",
    placeholder: "sk-ant-… 로 시작",
    link: CLAUDE_CONSOLE,
    linkLabel: "Claude 개발자 콘솔 열기",
    steps: [
      "Claude 개발자 콘솔(Anthropic)에 가입하고 결제 메뉴에서 크레딧을 충전해요.",
      "API 키 메뉴에서 새 키를 만들어요. 키는 만들 때 한 번만 보이니 바로 복사해요.",
      "학생들과 함께 쓸 키라면 콘솔에서 사용 한도(월 한도)를 꼭 정해 두세요.",
    ],
  },
  openai: {
    cost: "유료 (크레딧 충전 필요)",
    placeholder: "sk-… 또는 sk-proj-… 로 시작",
    link: OPENAI_KEYS,
    linkLabel: "OpenAI 플랫폼 열기",
    steps: [
      "OpenAI 플랫폼에 가입하고 결제(Billing) 메뉴에서 크레딧을 충전해요. ChatGPT 구독과는 따로예요.",
      "API keys 메뉴에서 새 키를 만들어요. 키는 만들 때 한 번만 보이니 바로 복사해요.",
      "학생들과 함께 쓸 키라면 사용 한도(Limits)를 꼭 정해 두세요.",
    ],
  },
};
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
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [aiKeys, setAiKeys] = useState<Record<AiProvider, string>>({ gemini: "", claude: "", openai: "" });
  const [persist, setPersist] = useState(true);
  const [showData, setShowData] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [dataCheck, setDataCheck] = useState<Check>({ state: "idle" });
  const [aiCheck, setAiCheck] = useState<Check>({ state: "idle" });
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [grade, setGrade] = useState<GradeBand>("3-4");
  const [hadKey, setHadKey] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const k = loadKeys();
    setDataKey(k.dataKey ?? "");
    setProvider(activeProvider(k));
    setAiKeys({ gemini: k.geminiKey ?? "", claude: k.claudeKey ?? "", openai: k.openaiKey ?? "" });
    setHadKey(Boolean(k.dataKey));
    setPersist(isPersisted() || !(k.dataKey || k.geminiKey || k.claudeKey || k.openaiKey));
    setGrade(loadGrade());
  }, []);

  const dataInfo = normalizeDataKey(dataKey);
  const aiKey = aiKeys[provider];
  const allKeys = (): Keys => ({
    dataKey,
    aiProvider: provider,
    geminiKey: aiKeys.gemini,
    claudeKey: aiKeys.claude,
    openaiKey: aiKeys.openai,
  });

  /** 키를 붙여 넣으면 모양을 보고 공급자를 알아서 맞춘다 */
  function onAiKey(v: string) {
    setAiCheck({ state: "idle" });
    const guess = detectProvider(v);
    if (guess && guess !== provider) {
      setAiKeys((a) => ({ ...a, [guess]: v }));
      setProvider(guess);
      setAiNote(`✓ ${AI_NAME[guess]} 키 같아요. ${AI_NAME[guess]}로 바꿨어요.`);
    } else {
      setAiKeys((a) => ({ ...a, [provider]: v }));
      setAiNote(null);
    }
  }

  function pickProvider(p: AiProvider) {
    setProvider(p);
    setAiCheck({ state: "idle" });
    setAiNote(null);
  }

  /** 입력란의 값으로 실제 호출을 한 번 해 본다 (저장 전에도 가능) */
  async function check(target: "data" | "ai", keys: Keys = allKeys()) {
    const set = target === "data" ? setDataCheck : setAiCheck;
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
                : `${AI_NAME[(j.provider as AiProvider) ?? provider]} 연결 성공!${j.model ? ` (모델: ${j.model})` : ""}`,
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
    const keys = allKeys();
    const ok = saveKeys(keys, persist);
    setDataKey(dataInfo.key);
    setSaved(ok ? (persist ? "이 기기에 저장했어요." : "이번 사용만 적용했어요. 탭을 닫으면 사라져요.") : "이 브라우저는 저장을 막고 있어요(사생활 보호 창 등). 일반 창에서 다시 해 주세요.");
    setHadKey(Boolean(dataInfo.key));
    const jobs: Promise<void>[] = [];
    if (dataInfo.key) jobs.push(check("data", keys));
    if (normalizeAiKey(aiKey)) jobs.push(check("ai", keys));
    await Promise.all(jobs);
  }

  function remove() {
    if (!confirm("이 기기에서 키를 모두 지울까요?")) return;
    clearKeys();
    setDataKey("");
    setAiKeys({ gemini: "", claude: "", openai: "" });
    setDataCheck({ state: "idle" });
    setAiCheck({ state: "idle" });
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

  const ready =
    (dataCheck.state === "ok" || (conn.ready && conn.data && dataCheck.state !== "bad")) &&
    (aiCheck.state === "ok" || (conn.ready && conn.ai && aiCheck.state !== "bad"));

  return (
    <>
      {need === "NO_DATA_KEY" && <div className="alert warn">국립수목원 정보를 보려면 공공데이터포털 인증키가 필요해요. 아래 순서대로 넣어 주세요.</div>}
      {conn.mock && <div className="alert ok">지금은 <strong>연습 모드</strong>예요. 키 없이 연습 자료로 모든 화면을 써 볼 수 있어요.</div>}
      {!conn.mock && conn.sharedData && !conn.ownData && <div className="alert ok">선생님(강사)이 준비한 공유 키로 연결돼 있어요. 내 키를 넣으면 내 키를 먼저 써요.</div>}

      <Link href="/teacher" className="card teacher-callout">
        <span className="big">👩‍🏫</span>
        <span>
          <strong>선생님이신가요?</strong>
          <span className="small" style={{ display: "block" }}>키를 한 번 넣고, 학생 기기에는 QR 하나로 한꺼번에 넣어 주세요 →</span>
        </span>
      </Link>

      <div className="card">
        <h2>⚙️ 내 키로 연결하기</h2>
        <p className="small" style={{ margin: 0 }}>
          이 앱은 <strong>쓰는 사람마다 자기 키</strong>를 넣어 써요. 키는 <strong>이 기기의 브라우저</strong>에만 저장되고, 요청할 때만 앱 서버를 거쳐 국립수목원과 내가 고른 AI 회사로 전달돼요. 서버는 키를 저장하거나 기록하지 않아요.
        </p>
        <ol className="steps-list">
          <li><strong>키 두 개 받기</strong> — 공공데이터포털 키 + AI 키(제미나이·클로드·GPT 중 하나)</li>
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

      {/* 2. AI — 꼭 필요 */}
      <div className="card">
        <h2>2. AI 키 <span className="badge official">꼭 필요</span></h2>
        <p className="muted small" style={{ marginTop: -4 }}>
          <strong>사진을 보고 어떤 식물인지</strong> 후보를 알려 주고, 국립수목원 공식 정보를 학년 눈높이로 풀어 줘요. 아래 셋 중 하나를 골라 그 회사의 키를 넣어요.
        </p>
        <div className="seg seg3" role="tablist" aria-label="AI 고르기">
          {AI_PROVIDERS.map((p) => (
            <button key={p} role="tab" aria-selected={provider === p} className={provider === p ? "on" : ""} onClick={() => pickProvider(p)}>
              {AI_NAME[p]}
              <small>{AI_MAKER[p]} · {AI_INFO[p].cost}</small>
              {aiKeys[p] && <small className="has-key">키 있음 ✓</small>}
            </button>
          ))}
        </div>
        <label className="field" style={{ marginTop: 12 }}>
          <span>{AI_NAME[provider]} API 키</span>
          <div className="row">
            <input className="input" style={{ flex: 1 }} type={showAi ? "text" : "password"} autoComplete="off" spellCheck={false} value={aiKey} onChange={(e) => onAiKey(e.target.value)} placeholder={AI_INFO[provider].placeholder} aria-label={`${AI_NAME[provider]} API 키`} />
            <button className="btn btn-sm" type="button" onClick={() => setShowAi((v) => !v)}>{showAi ? "가리기" : "보기"}</button>
          </div>
        </label>
        {aiNote && <p className="small ok-text">{aiNote}</p>}
        <div className="row">
          <button className="btn btn-sm" type="button" disabled={!normalizeAiKey(aiKey) || aiCheck.state === "busy"} onClick={() => check("ai")}>{aiCheck.state === "busy" ? "확인 중…" : "연결 확인"}</button>
          {aiCheck.state === "ok" && <span className="badge official">✓ {aiCheck.message}</span>}
        </div>
        {aiCheck.state === "bad" && <div className="alert err" style={{ marginTop: 10 }}>✗ {aiCheck.message}</div>}
        <details className="guide" style={{ marginTop: 10 }} open={!aiKey}>
          <summary>{AI_NAME[provider]} 키 받는 방법</summary>
          <ol>
            <li><a href={AI_INFO[provider].link} target="_blank" rel="noreferrer">{AI_INFO[provider].linkLabel} ↗</a></li>
            {AI_INFO[provider].steps.map((t, i) => <li key={i}>{t}</li>)}
          </ol>
          <p className="small muted" style={{ margin: "8px 0 0" }}>세 회사 키를 모두 저장해 둘 수 있어요. 지금 고른 AI({AI_NAME[provider]})의 키를 써요.</p>
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
          <button className="btn btn-primary" onClick={save} disabled={!dataInfo.key && !normalizeAiKey(aiKey)}>저장하고 연결 확인</button>
          {Boolean(dataInfo.key) !== Boolean(normalizeAiKey(aiKey)) && <p className="small warn-text" style={{ margin: 0 }}>공공데이터포털 키와 AI 키를 모두 넣어야 사진으로 식물을 알아볼 수 있어요.</p>}
          {saved && <div className="alert ok">{saved}</div>}
          {ready && saved && (
            <Link href="/" className="btn btn-ai">🌿 준비 끝! 식물 찾으러 가기 →</Link>
          )}
          <button className="btn btn-danger" onClick={remove}>이 기기에서 키 삭제</button>
        </div>
      </div>

      <div className="card">
        <h2>다른 선생님께 알려 줄 때</h2>
        <p className="small" style={{ margin: 0 }}>이 앱 주소만 보내면 돼요. 각자 이 화면에서 자기 키를 넣으면 연결돼요. 학생 기기에는 <Link href="/teacher" className="link">선생님 화면의 QR</Link>로 한꺼번에 넣을 수 있어요.</p>
      </div>
    </>
  );
}
