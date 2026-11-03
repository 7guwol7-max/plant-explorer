"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, loadKeys, saveKeys, clearKeys, isPersisted } from "@/lib/client/keys";

type Check = { state: "idle" | "busy" | "ok" | "bad"; message?: string };

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

  const [dataKey, setDataKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [persist, setPersist] = useState(true);
  const [showData, setShowData] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [dataCheck, setDataCheck] = useState<Check>({ state: "idle" });
  const [geminiCheck, setGeminiCheck] = useState<Check>({ state: "idle" });
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    const k = loadKeys();
    setDataKey(k.dataKey ?? "");
    setGeminiKey(k.geminiKey ?? "");
    setPersist(isPersisted() || !(k.dataKey || k.geminiKey));
  }, []);

  /** 입력란의 값으로 실제 호출을 한 번 해 본다 (저장 전에도 가능) */
  async function check(target: "data" | "gemini") {
    const set = target === "data" ? setDataCheck : setGeminiCheck;
    set({ state: "busy" });
    try {
      const res = await api(`/api/check?target=${target}`, {}, { dataKey, geminiKey });
      const j = await res.json();
      if (j.ok) {
        set({ state: "ok", message: j.mock ? "모의 모드예요 (실제 키 없이도 동작)" : j.shared ? "강사 공유 키로 연결됨" : target === "data" ? `국립수목원 연결됨 (검색 예: ${j.sample ?? "소나무"})` : "제미나이 연결됨" });
      } else {
        set({ state: "bad", message: j.message ?? "연결 실패" });
      }
    } catch {
      set({ state: "bad", message: "서버에 연결하지 못했어요" });
    }
  }

  function save() {
    saveKeys({ dataKey, geminiKey }, persist);
    setSaved(persist ? "이 기기에 저장했어요." : "이번 사용만 적용했어요. 탭을 닫으면 사라져요.");
    setTimeout(() => setSaved(null), 3000);
  }

  function remove() {
    if (!confirm("이 기기에서 키 두 개를 모두 지울까요?")) return;
    clearKeys();
    setDataKey("");
    setGeminiKey("");
    setDataCheck({ state: "idle" });
    setGeminiCheck({ state: "idle" });
    setSaved("지웠어요.");
  }

  return (
    <>
      {need === "NO_DATA_KEY" && <div className="alert warn">공공데이터포털 키가 필요해요. 아래에 입력하고 저장하세요.</div>}
      {need === "NO_GEMINI_KEY" && <div className="alert warn">제미나이 키가 필요해요. 아래에 입력하고 저장하세요.</div>}

      <div className="card">
        <h2>⚙️ 내 키 설정</h2>
        <p className="muted small">
          키는 <strong>이 기기의 브라우저</strong>에만 저장되고, 요청할 때마다 서버를 거쳐 국립수목원·제미나이로 전달돼요. 서버는 키를 저장하지 않아요.
        </p>
      </div>

      {/* 공공데이터포털 */}
      <div className="card">
        <h2>1. 공공데이터포털 인증키 <span className="badge official">국립수목원</span></h2>
        <label className="field">
          <span>일반 인증키 — <strong>Decoding</strong> 쪽을 넣어요</span>
          <div className="row">
            <input className="input" style={{ flex: 1 }} type={showData ? "text" : "password"} autoComplete="off" spellCheck={false} value={dataKey} onChange={(e) => setDataKey(e.target.value)} placeholder="마이페이지 → 활용신청 현황 → 상세" />
            <button className="btn btn-sm" type="button" onClick={() => setShowData((v) => !v)}>{showData ? "가리기" : "보기"}</button>
          </div>
        </label>
        <div className="row">
          <button className="btn btn-sm" type="button" disabled={!dataKey.trim() || dataCheck.state === "busy"} onClick={() => check("data")}>{dataCheck.state === "busy" ? "확인 중…" : "연결 확인"}</button>
          {dataCheck.state === "ok" && <span className="badge official">✓ {dataCheck.message}</span>}
          {dataCheck.state === "bad" && <span className="small" style={{ color: "var(--danger)" }}>✗ {dataCheck.message}</span>}
        </div>
        <details style={{ marginTop: 10 }}>
          <summary className="small" style={{ cursor: "pointer", color: "var(--muted)" }}>키 발급 방법</summary>
          <ol className="small" style={{ paddingLeft: 18, margin: "6px 0 0" }}>
            <li>공공데이터포털(data.go.kr) 가입 후 로그인</li>
            <li>"산림청 국립수목원_식물자원 조회 서비스" 검색 → 활용신청 (자동승인)</li>
            <li>마이페이지 → 활용신청 현황 → 해당 서비스 클릭 → 일반 인증키(Decoding) 복사</li>
            <li>새로 발급한 키는 반영까지 시간이 걸릴 수 있어요 (연수 전날까지 발급 권장)</li>
          </ol>
        </details>
      </div>

      {/* 제미나이 */}
      <div className="card">
        <h2>2. 제미나이 API 키 <span className="badge ai">사진 식별·쉬운 설명</span></h2>
        <label className="field">
          <span>구글 AI 스튜디오에서 만든 키</span>
          <div className="row">
            <input className="input" style={{ flex: 1 }} type={showGemini ? "text" : "password"} autoComplete="off" spellCheck={false} value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIza… 로 시작" />
            <button className="btn btn-sm" type="button" onClick={() => setShowGemini((v) => !v)}>{showGemini ? "가리기" : "보기"}</button>
          </div>
        </label>
        <div className="row">
          <button className="btn btn-sm" type="button" disabled={!geminiKey.trim() || geminiCheck.state === "busy"} onClick={() => check("gemini")}>{geminiCheck.state === "busy" ? "확인 중…" : "연결 확인"}</button>
          {geminiCheck.state === "ok" && <span className="badge official">✓ {geminiCheck.message}</span>}
          {geminiCheck.state === "bad" && <span className="small" style={{ color: "var(--danger)" }}>✗ {geminiCheck.message}</span>}
        </div>
        <details style={{ marginTop: 10 }}>
          <summary className="small" style={{ cursor: "pointer", color: "var(--muted)" }}>키 발급 방법과 주의</summary>
          <ol className="small" style={{ paddingLeft: 18, margin: "6px 0 0" }}>
            <li>구글 AI 스튜디오(aistudio.google.com) → API 키 만들기</li>
            <li><strong>결제 계정을 연결하지 않은 프로젝트</strong>로 만들면 한도 초과가 있어도 요금이 생기지 않아요</li>
            <li>일일 한도는 미국 태평양 시간 자정(한국 오후 4~5시)에 초기화돼요</li>
          </ol>
        </details>
      </div>

      {/* 저장 */}
      <div className="card">
        <h2>3. 저장 방식</h2>
        <div className="chips">
          <button className={`chip ${persist ? "on" : ""}`} onClick={() => setPersist(true)}>이 기기에 저장 (내 휴대폰·학급 태블릿)</button>
          <button className={`chip ${!persist ? "on" : ""}`} onClick={() => setPersist(false)}>이번만 사용 (공용 컴퓨터)</button>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={save} disabled={!dataKey.trim() && !geminiKey.trim()}>저장</button>
          <button className="btn btn-danger" onClick={remove}>이 기기에서 키 삭제</button>
          {saved && <div className="alert ok">{saved}</div>}
        </div>
      </div>

      <div className="card">
        <h2>선생님용</h2>
        <p className="small">학급 기기 여러 대에 같은 키를 넣어야 하면 <Link href="/teacher" style={{ color: "var(--green)", fontWeight: 700 }}>학급 설정 QR →</Link></p>
      </div>
    </>
  );
}
