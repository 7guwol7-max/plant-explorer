"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Steps from "./Steps";
import ErrorAlert from "./ErrorAlert";
import CurriculumLinks from "./CurriculumLinks";
import { api, ApiError, toApiError } from "@/lib/client/keys";
import { useConnection } from "@/lib/client/useConnection";
import { loadDraft, clearDraft, type Draft } from "@/lib/client/draft";
import { saveCard, newCardId, type Card } from "@/lib/client/cards";
import { shrinkDataUrl } from "@/lib/client/image";
import { loadGrade, saveGrade } from "@/lib/client/prefs";
import { OFFICIAL_FIELDS, SOURCE_NAME } from "@/lib/fields";
import { linkCurriculum, DEFAULT_GRADE, type GradeBand } from "@/lib/curriculum";

type Detail = Record<string, string> & { mock?: boolean };
type Explain = { kidSummary: string; observeQuestions: string[]; compareHint: string; mock?: boolean };
type Err = { message: string; needsSettings?: boolean } | null;

const DEFAULT_QUESTIONS = [
  "잎의 모양과 가장자리는 어떻게 생겼나요?",
  "줄기는 나무처럼 단단한가요, 풀처럼 부드러운가요?",
  "이 식물이 자라는 곳은 어떤 환경인가요? (햇빛, 물, 흙)",
];

/** 화면 ③ 확인 + 📚 교과서 연결 + ④ 기록 */
export default function PlantDetail({ no }: { no: string }) {
  const router = useRouter();
  const conn = useConnection();
  const [draft, setDraft] = useState<Draft>({});
  const [detail, setDetail] = useState<Detail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [err, setErr] = useState<Err>(null);
  const [tab, setTab] = useState<"official" | "easy">("official");
  const [exp, setExp] = useState<Explain | null>(null);
  const [expBusy, setExpBusy] = useState(false);
  const [expErr, setExpErr] = useState<Err>(null);
  const [grade, setGrade] = useState<GradeBand>(DEFAULT_GRADE);

  // 기록(④)
  const [verified, setVerified] = useState<"일치" | "불일치" | "모름">("모름");
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [curriAnswers, setCurriAnswers] = useState<Record<string, string>>({});
  const [newLearning, setNewLearning] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraft(loadDraft());
    setGrade(loadGrade());
    (async () => {
      try {
        const res = await api(`/api/plants/detail?no=${encodeURIComponent(no)}`);
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) throw await toApiError(res);
        setDetail(await res.json());
      } catch (e) {
        setErr(e instanceof ApiError ? { message: e.message, needsSettings: e.needsSettings } : { message: e instanceof Error ? e.message : "조회 실패" });
      }
    })();
  }, [no]);

  const links = useMemo(
    () => (detail ? linkCurriculum({ gradeBand: grade, official: detail, place: draft.place, observation: draft.observation }) : []),
    [detail, grade, draft.place, draft.observation],
  );

  function changeGrade(g: GradeBand) {
    setGrade(g);
    saveGrade(g);
    setExp(null); // 학년이 바뀌면 쉬운 설명도 그 학년 말로 다시
    setExpErr(null);
    if (tab === "easy") void loadExplain(g, true);
  }

  async function loadExplain(g: GradeBand = grade, force = false) {
    if ((exp && !force) || !detail || !conn.gemini) return;
    setExpBusy(true);
    setExpErr(null);
    try {
      const codes = linkCurriculum({ gradeBand: g, official: detail, place: draft.place, observation: draft.observation })
        .slice(0, 3)
        .map((l) => l.standard.code);
      const res = await api("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ official: detail, gradeBand: g, standards: codes }),
      });
      if (!res.ok) throw await toApiError(res);
      setExp(await res.json());
    } catch (e) {
      setExpErr(e instanceof ApiError ? { message: e.message, needsSettings: e.needsSettings } : { message: e instanceof Error ? e.message : "설명 생성 실패" });
    } finally {
      setExpBusy(false);
    }
  }

  const questions = exp?.observeQuestions?.length ? exp.observeQuestions.slice(0, 3) : DEFAULT_QUESTIONS;

  async function save() {
    if (!detail) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const official: Record<string, string> = {};
      for (const [k] of OFFICIAL_FIELDS) if (detail[k]) official[k] = detail[k];
      official.source = detail.source ?? SOURCE_NAME;
      const card: Card = {
        id: newCardId(),
        createdAt: new Date().toISOString(),
        photo: draft.photo ? await shrinkDataUrl(draft.photo, 640) : undefined,
        place: draft.place,
        myObservation: draft.observation,
        aiCandidates: draft.aiCandidates,
        confirmed: { pilbkNo: no, koreanName: detail.koreanName, scientificName: detail.scientificName, family: detail.family },
        official,
        kidSummary: exp?.kidSummary,
        answers: questions.map((q, i) => ({ q, a: answers[i] ?? "" })),
        newLearning,
        verified,
        gradeBand: grade,
        curriculum: links.map(({ standard: s }) => ({
          code: s.code,
          subject: s.subject,
          unit: s.unit,
          officialText: s.officialText,
          activity: s.activity,
          answer: curriAnswers[s.code] ?? "",
        })),
      };
      const r = saveCard(card);
      if (!r.ok) { setSaveMsg(r.message ?? "저장 실패"); return; }
      clearDraft();
      router.push("/my");
    } finally {
      setSaving(false);
    }
  }

  if (notFound) return (<><Steps current={3} /><div className="card"><h2>도감에 없어요</h2><p>국립수목원 식물도감에서 이 번호의 정보를 찾지 못했어요.</p><button className="btn" onClick={() => router.back()}>← 돌아가기</button></div></>);
  if (err) return (<><Steps current={3} /><ErrorAlert {...err} /><button className="btn" onClick={() => router.back()}>← 돌아가기</button></>);
  if (!detail) return (<><Steps current={3} /><div className="card"><p>국립수목원에서 공식 정보를 가져오는 중…</p></div></>);

  return (
    <>
      <Steps current={3} />

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>③ {detail.koreanName}</h2>
          <span className="badge official">국립수목원 공식 정보</span>
        </div>
        <div className="sci" style={{ fontStyle: "italic", color: "var(--muted)" }}>{detail.scientificName}{detail.engNm ? ` · ${detail.engNm}` : ""}</div>
        <div className="muted small">{detail.family}{detail.genus ? ` · ${detail.genus}` : ""}</div>
        {detail.mock && <div className="alert warn" style={{ marginTop: 10 }}>연습 모드: 연습용 자료예요. 실제 국립수목원 설명이 아니에요.</div>}
        {(draft.photo || draft.observation) && (
          <div className="row" style={{ marginTop: 10, alignItems: "flex-start" }}>
            {draft.photo && <img src={draft.photo} alt="내가 찍은 사진" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 10 }} />}
            <div className="small">
              {draft.chosen && <div><span className={`badge ${draft.aiCandidates?.length ? "ai" : "official"}`}>{draft.aiCandidates?.length ? "AI 추정" : "내가 찾은 이름"}</span> {draft.chosen.koreanName}</div>}
              {draft.observation && <div className="muted" style={{ marginTop: 4 }}>내 관찰: {draft.observation.leafShape} · {draft.observation.leafVein} · {draft.observation.stem}</div>}
              {draft.place && <div className="muted">장소: {draft.place}</div>}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="tabs">
          <button className={tab === "official" ? "on" : ""} onClick={() => setTab("official")}>📗 공식 정보 (원문)</button>
          <button className={`ai ${tab === "easy" ? "on" : ""}`} onClick={() => { setTab("easy"); void loadExplain(); }}>🤖 쉬운 설명</button>
        </div>

        {tab === "official" && (
          <>
            {OFFICIAL_FIELDS.filter(([k]) => detail[k]).map(([k, label], i) => (
              <details key={k} className="field-block" open={i < 2}>
                <summary>{label}</summary>
                <p>{detail[k]}</p>
              </details>
            ))}
            {OFFICIAL_FIELDS.every(([k]) => !detail[k]) && <p className="muted">이 식물은 도감에 설명 항목이 비어 있어요.</p>}
            <div className="source">출처: {detail.source ?? SOURCE_NAME} · 원문을 수정하지 않고 그대로 보여줘요</div>
          </>
        )}

        {tab === "easy" && (
          <>
            <span className="badge ai">AI가 공식 정보를 바꿔 쓴 글 · 원문과 꼭 비교해요</span>
            {conn.ready && !conn.gemini && (
              <div className="alert warn" style={{ marginTop: 10 }}>
                제미나이 키를 넣으면 AI가 공식 정보를 쉬운 말로 풀어 주고, 이 식물에 맞는 관찰 질문도 만들어 줘요. <Link href="/settings" className="link">설정에서 넣기 →</Link>
              </div>
            )}
            {expBusy && <p className="muted" style={{ marginTop: 10 }}>AI가 쉽게 풀어 쓰는 중…</p>}
            {expErr && <div style={{ marginTop: 10 }}><ErrorAlert {...expErr} /></div>}
            {exp && (
              <div className="stack" style={{ marginTop: 10 }}>
                {exp.mock && <div className="alert warn">연습 모드: 연습용 설명이에요.</div>}
                <p style={{ fontSize: 17 }}>{exp.kidSummary}</p>
                <div><strong>비슷한 식물과 구별하려면</strong><p className="small" style={{ margin: "4px 0 0" }}>{exp.compareHint}</p></div>
              </div>
            )}
          </>
        )}
      </div>

      <CurriculumLinks
        links={links}
        grade={grade}
        onGrade={changeGrade}
        answers={curriAnswers}
        onAnswer={(code, v) => setCurriAnswers((a) => ({ ...a, [code]: v }))}
      />

      <Steps current={4} />
      <div className="card">
        <h2>④ 나의 탐구 기록</h2>

        <h3>{draft.aiCandidates?.length ? "AI가 말한 식물과 내가 관찰한 모습이 일치하나요?" : "공식 정보와 내가 관찰한 모습이 일치하나요?"}</h3>
        <div className="chips">
          {(["일치", "불일치", "모름"] as const).map((v) => (
            <button key={v} className={`chip ${verified === v ? "on" : ""}`} onClick={() => setVerified(v)}>{v === "일치" ? "✅ 일치해요" : v === "불일치" ? "❌ 달라요" : "❓ 잘 모르겠어요"}</button>
          ))}
        </div>

        <h3>관찰 질문 {exp ? "(AI 제안)" : "(기본)"}</h3>
        {!exp && conn.gemini && <p className="muted small">'쉬운 설명' 탭을 열면 이 식물과 교과서 내용에 맞는 질문을 AI가 제안해요.</p>}
        {questions.map((q, i) => (
          <label className="field" key={i}>
            <span>{i + 1}. {q}</span>
            <textarea className="input" rows={2} value={answers[i] ?? ""} onChange={(e) => { const a = [...answers]; a[i] = e.target.value; setAnswers(a); }} placeholder="실제로 관찰한 것을 써요" />
          </label>
        ))}

        <label className="field">
          <span>새롭게 알게 된 점</span>
          <textarea className="input" rows={3} value={newLearning} onChange={(e) => setNewLearning(e.target.value)} placeholder="공식 정보를 읽고 알게 된 것, 더 궁금한 것" />
        </label>

        {saveMsg && <div className="alert err">{saveMsg}</div>}
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? "저장 중…" : "📒 나의 도감에 저장"}</button>
        <p className="muted small" style={{ textAlign: "center", marginTop: 8 }}>교과서 연결 활동에 적은 내용도 함께 저장돼요.</p>
      </div>
    </>
  );
}
