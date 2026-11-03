"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { activeProvider, aiKeyOf, loadKeys } from "@/lib/client/keys";
import { AI_NAME } from "@/lib/ai";
import { useConnection } from "@/lib/client/useConnection";
import { loadGrade, saveGrade, saveRole, useRole } from "@/lib/client/prefs";
import { GRADE_BANDS, GRADE_LABEL, type GradeBand } from "@/lib/curriculum";
import EditAppCard from "@/app/components/EditAppCard";

type Mode = "keys" | "url";

/**
 * 👩‍🏫 선생님 모드 — 수업 준비 3단계
 * ① 내 키 저장 ② 학년 고르기 ③ 학생에게 QR 보여 주기 (칠판·TV 전체 화면)
 *
 * QR 두 가지
 * - 키까지 한 번에: 이 기기의 키와 학년을 주소의 프래그먼트(#k=…)에 담는다.
 *   학생 기기가 열면 KeyFromFragment 가 저장하고 주소에서 지운다. 프래그먼트는 서버로 전송되지 않는다.
 *   단, 링크를 열어 보면 키가 보이므로 학급 안에서만 쓰고, 제미나이 키는 결제 미연결 프로젝트의 키를 쓴다.
 * - 앱 주소만: 학생이 각자 자기 키를 넣는 경우 (설정 화면으로 바로)
 */
export default function TeacherPage() {
  const conn = useConnection();
  const role = useRole();
  const [grade, setGrade] = useState<GradeBand>("3-4");
  const [mode, setMode] = useState<Mode>("keys");
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => setGrade(loadGrade()), []);

  const keysReady = conn.ownData && conn.ownAi;
  const sharedReady = conn.sharedData && conn.sharedAi;

  // 공유 키·연습 모드 배포본이면 학생 기기에 키가 필요 없으므로 '앱 주소만'이 기본
  useEffect(() => {
    if (conn.ready && (conn.mock || (sharedReady && !keysReady))) setMode("url");
  }, [conn.ready, conn.mock, sharedReady, keysReady]);

  useEffect(() => {
    if (!conn.ready) return;
    let url = "";
    if (mode === "url") {
      url = `${window.location.origin}/settings`;
    } else if (keysReady) {
      const k = loadKeys();
      const p = activeProvider(k);
      const payload = JSON.stringify({ dataKey: k.dataKey ?? "", aiProvider: p, aiKey: aiKeyOf(k, p), grade });
      const b64 = btoa(encodeURIComponent(payload)).replace(/\+/g, "-").replace(/\//g, "_");
      url = `${window.location.origin}/#k=${b64}`;
    }
    setLink(url);
    if (!url) {
      setQr("");
      return;
    }
    QRCode.toDataURL(url, { width: 720, margin: 1, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(""));
  }, [conn.ready, keysReady, mode, grade]);

  // Esc 로 전체 화면 닫기
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  function pickGrade(g: GradeBand) {
    setGrade(g);
    saveGrade(g);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const done1 = keysReady || sharedReady || conn.mock;

  const studentSteps = (
    <ol className="student-steps">
      <li>휴대폰·태블릿 <strong>카메라</strong>로 QR을 비춰요</li>
      <li>화면에 뜨는 <strong>주소를 눌러</strong> 열어요</li>
      <li>
        {mode === "keys" ? (
          <>맨 위에 <strong className="ok-text-strong">● 연결됨</strong>이 보이면 준비 끝!</>
        ) : (
          <>설정 화면에서 <strong>자기 키를 넣고</strong> 연결 확인</>
        )}
      </li>
    </ol>
  );

  return (
    <>
      <div className="card teacher-hero">
        <h2>👩‍🏫 선생님 모드</h2>
        <p className="small" style={{ margin: 0 }}>
          학생 기기에 키를 한 대씩 넣지 않아도 돼요. <strong>아래 3단계</strong>면 수업 준비 끝! 마지막 단계의 QR을 칠판이나 TV에 크게 띄워 학생들이 찍게 하세요.
        </p>
      </div>

      <div className={`card role-card ${role === "teacher" ? "on" : ""}`}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <strong>이 기기의 보기 방식</strong>
            <p className="small muted" style={{ margin: "2px 0 0" }}>
              {role === "teacher"
                ? "선생님 보기: 교과서 연결에 성취기준 코드·원문·해설이 그대로 보여요."
                : "학생 보기: 교과서 연결이 학생 말(‘우리 교과서에 이런 내용이 나와요’)로 보여요."}
            </p>
          </div>
          <div className="seg seg-inline" role="tablist" aria-label="보기 방식">
            <button role="tab" aria-selected={role === "student"} className={role === "student" ? "on" : ""} onClick={() => saveRole("student")}>🧒 학생 보기</button>
            <button role="tab" aria-selected={role === "teacher"} className={role === "teacher" ? "on" : ""} onClick={() => saveRole("teacher")}>👩‍🏫 선생님 보기</button>
          </div>
        </div>
      </div>

      {/* ① 키 */}
      <div className={`card t-step ${done1 ? "done" : ""}`}>
        <div className="t-head">
          <span className="num">1</span>
          <h3>내 키 저장하기</h3>
          <span className={`badge ${done1 ? "official" : "warn"}`}>{done1 ? "✓ 완료" : "해야 해요"}</span>
        </div>
        {conn.mock ? (
          <p className="small" style={{ margin: 0 }}>지금은 연습 모드라 키가 없어도 돼요.</p>
        ) : (
          <>
            <ul className="key-check small">
              <li>{conn.ownData ? "✅" : "⬜"} 공공데이터포털 인증키 (국립수목원 공식 정보)</li>
              <li>{conn.ownAi ? "✅" : "⬜"} AI 키 — {AI_NAME[conn.provider]} (사진으로 식물 알아보기)</li>
            </ul>
            {sharedReady && !keysReady && <p className="small muted" style={{ margin: "0 0 8px" }}>이 배포본에는 강사 공유 키가 있어, 학생 기기에 키가 없어도 돼요.</p>}
            {!keysReady && <Link href="/settings" className="btn btn-primary">⚙️ 설정에서 키 넣기 (처음이면 받는 방법도 있어요)</Link>}
          </>
        )}
      </div>

      {/* ② 학년 */}
      <div className="card t-step done">
        <div className="t-head">
          <span className="num">2</span>
          <h3>학년 고르기</h3>
          <span className="badge official">{GRADE_LABEL[grade]}</span>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>QR에 학년도 함께 담겨, 학생 기기의 교과서 연결이 이 학년으로 맞춰져요.</p>
        <div className="chips">
          {GRADE_BANDS.map((g) => (
            <button key={g} className={`chip ${grade === g ? "on" : ""}`} onClick={() => pickGrade(g)}>{GRADE_LABEL[g]}</button>
          ))}
        </div>
      </div>

      {/* ③ QR */}
      <div className="card t-step qr-step">
        <div className="t-head">
          <span className="num">3</span>
          <h3>학생에게 QR 보여 주기</h3>
        </div>

        <div className="seg" role="tablist" aria-label="QR 종류">
          <button role="tab" aria-selected={mode === "keys"} className={mode === "keys" ? "on" : ""} onClick={() => setMode("keys")}>
            🔑 키까지 한 번에
            <small>학급 태블릿·학생 휴대폰</small>
          </button>
          <button role="tab" aria-selected={mode === "url"} className={mode === "url" ? "on" : ""} onClick={() => setMode("url")}>
            🔗 앱 주소만
            <small>학생이 각자 자기 키</small>
          </button>
        </div>

        {mode === "keys" && !keysReady ? (
          <div className="alert warn" style={{ marginTop: 12 }}>
            1단계에서 키 두 개를 먼저 저장하면 여기에 QR이 나타나요.
            {sharedReady && " (공유 키가 있는 배포본이면 '앱 주소만'을 쓰세요.)"}
          </div>
        ) : (
          <>
            <div className="qr-wrap">
              {qr ? <img className="qr big" src={qr} alt={mode === "keys" ? "학급 설정 QR (키 포함)" : "앱 주소 QR"} /> : <div className="qr big placeholder">QR 만드는 중…</div>}
              <div className="qr-side">
                <div className="student-box">
                  <strong>학생은 이렇게 해요</strong>
                  {studentSteps}
                </div>
                <button className="btn btn-primary" onClick={() => setFull(true)} disabled={!qr}>⛶ 칠판·TV에 크게 띄우기</button>
                <button className="btn btn-sm" onClick={copy} disabled={!link}>{copied ? "복사됨 ✓" : "🔗 링크 복사 (메신저로 보내기)"}</button>
              </div>
            </div>
            {mode === "keys" && (
              <p className="muted small" style={{ marginBottom: 0 }}>
                🔒 링크 끝의 <code className="inline">#k=…</code>에 키가 들어 있어요. 학급 안에서만 보여 주고, 공개 게시판·누리집에는 올리지 마세요. 앱 서버로는 전송되지 않아요.
              </p>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h2>수업 전 점검</h2>
        <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
          <li>학생 기기 한 대로 QR을 찍어 머리글이 <strong>● 연결됨</strong>으로 바뀌는지 확인</li>
          <li>국립수목원 호출 한도: 개발계정 하루 1,000건 — 같은 식물은 앱 서버가 기억해 호출을 아껴요</li>
          <li>한 반이 AI 키 하나를 함께 쓰면 호출 한도(1분당 호출 수)에 걸릴 수 있어요. 모둠별로 한 기기씩 쓰면 넉넉해요</li>
          <li>클로드·GPT 키는 쓴 만큼 요금이 나가요. 학생 기기에 QR로 나눠 줄 때는 콘솔에서 월 사용 한도를 꼭 정해 두세요</li>
          <li>공용 컴퓨터에서는 설정에서 &quot;이번만 사용&quot;을 고르거나 수업 후 &quot;키 삭제&quot;</li>
        </ul>
      </div>

      <EditAppCard />

      <Link href="/curriculum" className="card teacher-callout">
        <span className="big">📚</span>
        <span>
          <strong>교육과정 연결표</strong>
          <span className="small" style={{ display: "block" }}>학년별로 어떤 성취기준과 이어지는지, 해설 원문과 함께 보기 →</span>
        </span>
      </Link>

      {full && qr && (
        <div className="qr-full" role="dialog" aria-modal="true" aria-label="QR 크게 보기">
          <div className="qr-full-inner">
            <h2>📷 카메라로 QR을 찍어요</h2>
            <img src={qr} alt="QR 크게 보기" />
            {studentSteps}
            <button className="btn" onClick={() => setFull(false)}>닫기 (Esc)</button>
          </div>
        </div>
      )}
    </>
  );
}
