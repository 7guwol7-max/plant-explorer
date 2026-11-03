"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Steps from "./Steps";
import ErrorAlert from "./ErrorAlert";
import CurriculumLinks from "./CurriculumLinks";
import RecordForm, { DEFAULT_QUESTIONS, type RecordData } from "./RecordForm";
import { api, ApiError, toApiError } from "@/lib/client/keys";
import { useConnection } from "@/lib/client/useConnection";
import { loadDraft, clearDraft, type Draft } from "@/lib/client/draft";
import { saveCard, newCardId, toCardCurriculum, type Card } from "@/lib/client/cards";
import { shrinkDataUrl } from "@/lib/client/image";
import { loadGrade, saveGrade, useRole } from "@/lib/client/prefs";
import { OFFICIAL_FIELDS, SOURCE_NAME } from "@/lib/fields";
import { linkCurriculum, DEFAULT_GRADE, GRADE_LABEL, type GradeBand } from "@/lib/curriculum";
import { AI_NAME } from "@/lib/ai";

type Detail = Record<string, string> & { mock?: boolean };
type Explain = {
  kidSummary: string;
  sections?: { title: string; text: string }[];
  fieldsEasy?: { field: string; easy: string }[];
  glossary?: { term: string; meaning: string }[];
  observeQuestions: string[];
  compareHint: string;
  wonder?: string;
  mock?: boolean;
  model?: string;
};
type Err = { message: string; needsSettings?: boolean } | null;

export const SECTION_ICON: Record<string, string> = { 생김새: "🌿", "사는 곳": "🏞️", "특별한 점": "✨", "우리 생활과 함께": "🏠", "지키는 방법": "🛡️", "기르는 방법": "🪴", "조심할 점": "⚠️" };

/**
 * 화면 ③ 확인 + 📚 교과서 연결 + ④ 기록
 * - 공식 정보: 국립수목원 원문 그대로 + (AI) 학년 눈높이 풀이를 항목마다 나란히
 *   학생 보기는 쉬운 풀이를 먼저, 선생님 보기는 원문을 먼저 보여 준다
 * - 쉬운 설명 탭: 소개 · 주제별 설명 · 낱말 풀이 · 비교 힌트 · 더 궁금한 점
 */
export default function PlantDetail({ no }: { no: string }) {
  const router = useRouter();
  const conn = useConnection();
  const role = useRole();
  const teacher = role === "teacher";
  const [draft, setDraft] = useState<Draft>({});
  const [detail, setDetail] = useState<Detail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [err, setErr] = useState<Err>(null);
  const [tab, setTab] = useState<"official" | "easy">("official");
  const [exp, setExp] = useState<Explain | null>(null);
  const [expBusy, setExpBusy] = useState(false);
  const [expErr, setExpErr] = useState<Err>(null);
  const [grade, setGrade] = useState<GradeBand>(DEFAULT_GRADE);
  const autoAsked = useRef(false);

  const [curriAnswers, setCurriAnswers] = useState<Record<string, string>>({});

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

  // 학생 보기에서는 공식 정보가 오면 학년 눈높이 풀이를 바로 불러온다
  useEffect(() => {
    if (!detail || !conn.ready || !conn.ai || teacher || autoAsked.current) return;
    autoAsked.current = true;
    void loadExplain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, conn.ready, conn.ai, teacher]);

  function changeGrade(g: GradeBand) {
    setGrade(g);
    saveGrade(g);
    setExp(null); // 학년이 바뀌면 그 학년 말로 다시
    setExpErr(null);
    if (exp || tab === "easy") void loadExplain(g, true);
  }

  async function loadExplain(g: GradeBand = grade, force = false) {
    if ((exp && !force) || !detail || !conn.ai) return;
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
      setExpErr(e instanceof ApiError ? { message: e.message, needsSettings: e.needsSettings } : { message: e instanceof Error ? e.message : "설명 만들기 실패" });
    } finally {
      setExpBusy(false);
    }
  }

  const easyOf = (k: string) => exp?.fieldsEasy?.find((f) => f.field === k)?.easy;
  const questions = exp?.observeQuestions?.length ? exp.observeQuestions.slice(0, 3) : DEFAULT_QUESTIONS;

  async function save(rec: RecordData) {
    if (!detail) return { ok: false };
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
      ...rec,
      gradeBand: grade,
      curriculum: toCardCurriculum(links, curriAnswers),
    };
    const r = saveCard(card);
    if (r.ok) {
      clearDraft();
      router.push("/my");
    }
    return r;
  }

  if (notFound) {
    const c = draft.chosen;
    return (
      <>
        <Steps current={3} />
        <div className="card">
          <h2>도감에 없어요</h2>
          <p>국립수목원 식물도감에서 이 번호의 정보를 찾지 못했어요.</p>
          {c?.koreanName && (
            <Link href={`/unlisted?name=${encodeURIComponent(c.koreanName)}&sci=${encodeURIComponent(c.scientificName ?? "")}`} className="btn btn-primary" style={{ marginBottom: 8 }}>
              🤖 AI에게 &lsquo;{c.koreanName}&rsquo; 알아보기
            </Link>
          )}
          <button className="btn" onClick={() => router.back()}>← 돌아가기</button>
        </div>
      </>
    );
  }
  if (err) return (<><Steps current={3} /><ErrorAlert {...err} /><button className="btn" onClick={() => router.back()}>← 돌아가기</button></>);
  if (!detail) return (<><Steps current={3} /><div className="card"><p>국립수목원에서 공식 정보를 가져오는 중…</p></div></>);

  const fields = OFFICIAL_FIELDS.filter(([k]) => detail[k]);
  const aiLabel = conn.ready && conn.ai && !conn.mock ? AI_NAME[conn.provider] : "AI";

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
          <button className={tab === "official" ? "on" : ""} onClick={() => setTab("official")}>📗 공식 정보</button>
          <button className={`ai ${tab === "easy" ? "on" : ""}`} onClick={() => { setTab("easy"); void loadExplain(); }}>🧒 {GRADE_LABEL[grade]} 눈높이 설명</button>
        </div>

        {conn.ready && !conn.ai && (
          <div className="alert warn">
            AI 키를 넣으면 국립수목원 공식 정보를 {GRADE_LABEL[grade]} 눈높이로 풀어 줘요. <Link href="/settings" className="link">설정에서 넣기 →</Link>
          </div>
        )}
        {expBusy && <p className="muted" style={{ marginTop: 0 }}>🧒 {aiLabel}가 {GRADE_LABEL[grade]} 눈높이로 풀어 쓰는 중…</p>}
        {expErr && <ErrorAlert {...expErr} />}

        {tab === "official" && (
          <>
            {conn.ai && !exp && !expBusy && (
              <button className="btn btn-sm btn-ai-soft" style={{ marginBottom: 10 }} onClick={() => loadExplain()}>🧒 {GRADE_LABEL[grade]} 눈높이 풀이 함께 보기</button>
            )}
            {fields.map(([k, label], i) => {
              const easy = easyOf(k);
              const original = (
                <div className={easy && !teacher ? "orig muted-orig" : "orig"}>
                  {easy && !teacher && <span className="orig-label">📗 국립수목원 원문</span>}
                  <p>{detail[k]}</p>
                </div>
              );
              const easyBox = easy && (
                <div className="easy-box">
                  <span className="easy-label">🧒 {GRADE_LABEL[grade]} 눈높이로 풀면 <em>({aiLabel}가 쓴 글)</em></span>
                  <p>{easy}</p>
                </div>
              );
              return (
                <details key={k} className="field-block" open={i < 2 || Boolean(easy)}>
                  <summary>{label}</summary>
                  {teacher ? <>{original}{easyBox}</> : <>{easyBox}{original}</>}
                </details>
              );
            })}
            {fields.length === 0 && <p className="muted">이 식물은 도감에 설명 항목이 비어 있어요.</p>}
            {exp?.glossary?.length ? <Glossary items={exp.glossary} /> : null}
            <div className="source">출처: {detail.source ?? SOURCE_NAME} · 원문은 고치지 않고 그대로 보여 줘요{exp ? ` · 눈높이 풀이는 ${aiLabel}가 원문을 바꿔 쓴 글이라 꼭 원문과 비교해요` : ""}</div>
          </>
        )}

        {tab === "easy" && (
          <>
            <span className="badge ai">{aiLabel}가 공식 정보를 {GRADE_LABEL[grade]} 눈높이로 바꿔 쓴 글 · 원문과 꼭 비교해요</span>
            {exp && (
              <div className="stack" style={{ marginTop: 12 }}>
                {exp.mock && <div className="alert warn">연습 모드: 연습용 설명이에요.</div>}
                <p className="kid-summary">{exp.kidSummary}</p>
                {exp.sections?.map((s, i) => (
                  <div key={i} className="easy-section">
                    <strong>{SECTION_ICON[s.title] ?? "📌"} {s.title}</strong>
                    <p>{s.text}</p>
                  </div>
                ))}
                {exp.glossary?.length ? <Glossary items={exp.glossary} /> : null}
                <div className="easy-section">
                  <strong>🔍 비슷한 식물과 구별하려면</strong>
                  <p>{exp.compareHint}</p>
                </div>
                {exp.wonder && (
                  <div className="easy-section wonder">
                    <strong>💡 더 알아볼까요?</strong>
                    <p>{exp.wonder}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <CurriculumLinks
        links={links}
        grade={grade}
        role={role}
        onGrade={changeGrade}
        answers={curriAnswers}
        onAnswer={(code, v) => setCurriAnswers((a) => ({ ...a, [code]: v }))}
      />

      <Steps current={4} />
      <RecordForm
        matchQuestion={draft.aiCandidates?.length ? "AI가 말한 식물과 내가 관찰한 모습이 일치하나요?" : "공식 정보와 내가 관찰한 모습이 일치하나요?"}
        questions={questions}
        questionsLabel={`관찰 질문 ${exp ? "(AI 제안)" : "(기본)"}`}
        questionsHint={!exp && conn.ai ? "눈높이 설명을 열면 이 식물과 교과서 내용에 맞는 질문을 AI가 제안해요." : undefined}
        learningPlaceholder="공식 정보를 읽고 알게 된 것, 더 궁금한 것"
        photo={draft.photo}
        onSave={save}
      />
    </>
  );
}

export function Glossary({ items }: { items: { term: string; meaning: string }[] }) {
  return (
    <div className="glossary">
      <strong>📖 어려운 낱말 풀이</strong>
      <dl>
        {items.map((g, i) => (
          <div key={i}>
            <dt>{g.term}</dt>
            <dd>{g.meaning}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
