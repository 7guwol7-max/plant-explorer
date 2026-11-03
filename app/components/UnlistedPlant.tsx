"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Steps from "./Steps";
import ErrorAlert from "./ErrorAlert";
import CurriculumLinks from "./CurriculumLinks";
import RecordForm, { DEFAULT_QUESTIONS, type RecordData } from "./RecordForm";
import { Glossary, SECTION_ICON } from "./PlantDetail";
import { api, ApiError, toApiError } from "@/lib/client/keys";
import { useConnection } from "@/lib/client/useConnection";
import { loadDraft, clearDraft, type Draft } from "@/lib/client/draft";
import { saveCard, newCardId, toCardCurriculum, type Card } from "@/lib/client/cards";
import { shrinkDataUrl } from "@/lib/client/image";
import { loadGrade, saveGrade, useRole } from "@/lib/client/prefs";
import { linkCurriculum, DEFAULT_GRADE, GRADE_LABEL, type GradeBand } from "@/lib/curriculum";
import { sciBinomial, squashName } from "@/lib/names";
import { AI_NAME } from "@/lib/ai";

type Summary = { pilbkNo: string; koreanName: string; scientificName: string; family?: string };
type Info = {
  known: boolean;
  koreanName: string;
  scientificName: string;
  otherNames: string[];
  whyNotListed: string;
  kidSummary: string;
  sections: { title: string; text: string }[];
  glossary: { term: string; meaning: string }[];
  observeQuestions: string[];
  wonder: string;
  listedAs: Summary | null;
  relatives: Summary[];
  searched?: string[];
  checked: boolean;
  mock?: boolean;
};
type Err = { message: string; needsSettings?: boolean } | null;

/**
 * 국립수목원 식물도감에 없는 식물 (③ 확인 + ④ 기록)
 * 1. 도감에서 찾지 못했다고 먼저 알린다
 * 2. AI에게 이 식물 정보와 '도감에 실렸을 수 있는 다른 이름'을 묻고, 서버가 그 이름으로 도감을 다시 찾는다
 *    - 다른 이름으로 실려 있으면 → 공식 정보 화면으로 안내
 *    - 없으면 → '국립수목원 식물도감에 정식으로 등록되어 있지 않아요' + AI가 알려 준 정보(공식 아님 표시)
 * 3. 교과서 연결은 장소·내 관찰로만 계산하고, 공식 정보 없이 할 수 있는 활동 문장을 쓴다
 */
export default function UnlistedPlant({ name, sci }: { name: string; sci: string }) {
  const router = useRouter();
  const conn = useConnection();
  const role = useRole();
  const [draft, setDraft] = useState<Draft>({});
  const [grade, setGrade] = useState<GradeBand>(DEFAULT_GRADE);
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Err>(null);
  const [curriAnswers, setCurriAnswers] = useState<Record<string, string>>({});
  const asked = useRef(false);

  useEffect(() => {
    setDraft(loadDraft());
    setGrade(loadGrade());
  }, []);

  const links = useMemo(
    () => linkCurriculum({ gradeBand: grade, official: null, place: draft.place, observation: draft.observation }),
    [grade, draft.place, draft.observation],
  );

  useEffect(() => {
    if (!name || !conn.ready || !conn.ai || asked.current) return;
    asked.current = true;
    void load(loadGrade());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, conn.ready, conn.ai]);

  async function load(g: GradeBand) {
    setBusy(true);
    setErr(null);
    try {
      const d = loadDraft();
      const codes = linkCurriculum({ gradeBand: g, official: null, place: d.place, observation: d.observation })
        .slice(0, 3)
        .map((l) => l.standard.code);
      const res = await api("/api/unlisted", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ koreanName: name, scientificName: sci, gradeBand: g, standards: codes }),
      });
      if (!res.ok) throw await toApiError(res);
      setInfo(await res.json());
    } catch (e) {
      setErr(e instanceof ApiError ? { message: e.message, needsSettings: e.needsSettings } : { message: e instanceof Error ? e.message : "AI에게 묻지 못했어요" });
    } finally {
      setBusy(false);
    }
  }

  function changeGrade(g: GradeBand) {
    setGrade(g);
    saveGrade(g);
    if (conn.ai && info?.known) void load(g); // 그 학년 말로 다시
  }

  const aiLabel = conn.ready && conn.ai && !conn.mock ? AI_NAME[conn.provider] : "AI";
  const known = Boolean(info?.known);
  const listedAs = info?.listedAs ?? null;
  const shownName = known && info?.koreanName ? info.koreanName : name;
  const shownSci = (known && info?.scientificName) || sci;
  const noAi = conn.ready && !conn.ai;
  const canRecord = Boolean(name) && !listedAs && (info ? known : noAi);

  // 찾아본 이름들 (학생이 고른 이름 → 학명 → AI가 알려 준 다른 이름)
  const searchedNames = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const n of [name, sciBinomial(sci), ...(info?.searched ?? [])]) {
      const k = squashName(n).toLowerCase();
      if (n && !seen.has(k)) { seen.add(k); out.push(n); }
    }
    return out.slice(0, 6);
  }, [name, sci, info?.searched]);

  function openOfficial(s: Summary) {
    router.push(`/plant/${encodeURIComponent(s.pilbkNo)}`);
  }

  async function save(rec: RecordData) {
    const card: Card = {
      id: newCardId(),
      createdAt: new Date().toISOString(),
      photo: draft.photo ? await shrinkDataUrl(draft.photo, 640) : undefined,
      place: draft.place,
      myObservation: draft.observation,
      aiCandidates: draft.aiCandidates,
      confirmed: { pilbkNo: "", koreanName: shownName, scientificName: shownSci },
      official: {},
      unlisted: { by: info?.known ? aiLabel : "", whyNotListed: info?.whyNotListed ?? "", sections: info?.sections ?? [] },
      kidSummary: info?.kidSummary || undefined,
      ...rec,
      gradeBand: grade,
      curriculum: toCardCurriculum(links, curriAnswers, true),
    };
    const r = saveCard(card);
    if (r.ok) {
      clearDraft();
      router.push("/my");
    }
    return r;
  }

  if (!name) {
    return (
      <>
        <Steps current={3} />
        <div className="card">
          <h2>식물 이름이 없어요</h2>
          <p>사진으로 식물을 먼저 알아봐요.</p>
          <Link href="/" className="btn btn-primary">📷 발견하러 가기</Link>
        </div>
      </>
    );
  }

  const status = listedAs ? { cls: "official", text: "다른 이름으로 실려 있어요" } : info?.known || noAi ? { cls: "warn", text: "국립수목원 미등록" } : { cls: "warn", text: "도감에서 찾지 못함" };

  return (
    <>
      <Steps current={3} />

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>③ {shownName}</h2>
          <span className={`badge ${status.cls}`}>{status.text}</span>
        </div>
        {shownSci && <div className="sci" style={{ fontStyle: "italic", color: "var(--muted)" }}>{shownSci}</div>}
        {known && squashName(info?.koreanName) !== squashName(name) && (
          <div className="muted small">내가 고른 이름: {name}</div>
        )}
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

      {/* 1. 찾는 중 */}
      {busy && !info && (
        <div className="unlisted-notice checking" role="status">
          <div className="unlisted-title">🔎 국립수목원 식물도감에서 &lsquo;{name}&rsquo;을(를) 찾지 못했어요</div>
          <p>{aiLabel}에게 이 식물에 대해 묻고, 국립수목원 도감에 다른 이름으로 실려 있는지 한 번 더 확인하고 있어요…</p>
        </div>
      )}
      {err && (
        <>
          <ErrorAlert {...err} />
          <button className="btn" style={{ marginBottom: 12 }} disabled={busy} onClick={() => load(grade)}>🔄 다시 물어보기</button>
        </>
      )}

      {/* 2-가. 다른 이름으로 실려 있음 */}
      {listedAs && (
        <div className="card listed-as">
          <h2>🎉 국립수목원 도감에 다른 이름으로 실려 있어요</h2>
          <p>
            &lsquo;{name}&rsquo;은(는) 국립수목원 식물도감에 <strong>&lsquo;{listedAs.koreanName}&rsquo;</strong>
            {listedAs.scientificName ? <> (<em>{listedAs.scientificName}</em>)</> : null}(이)라는 이름으로 실려 있어요.
            같은 식물을 부르는 이름이 여러 개일 수 있어요.
          </p>
          <button className="btn btn-primary" onClick={() => openOfficial(listedAs)}>📗 국립수목원 공식 정보 보기</button>
        </div>
      )}

      {/* 2-나. AI도 모르는 이름 */}
      {info && !known && (
        <div className="card">
          <h2>🤔 AI도 &lsquo;{name}&rsquo;을(를) 잘 몰라요</h2>
          <p>국립수목원 식물도감에서도 찾지 못했고, {aiLabel}도 이 이름의 식물을 확실히 알지 못해요. 이름이 맞는지 다시 확인하거나, 잎·꽃을 가까이 찍은 사진을 더 넣어 다시 물어보세요.</p>
          <Link href="/" className="btn btn-primary">📷 사진으로 다시 알아보기</Link>
        </div>
      )}

      {/* 2-다. 정식 등록 안 됨 + AI 정보 */}
      {(known && !listedAs) || noAi ? (
        <div className="unlisted-notice" role="status">
          <div className="unlisted-title">📕 국립수목원 식물도감에 정식으로 등록되어 있지 않아요</div>
          <p>
            국립수목원 식물도감에서 {searchedNames.map((n, i) => <span key={n}>{i > 0 && ", "}&lsquo;{n}&rsquo;</span>)}(으)로 찾아보았지만 등록된 공식 정보가 없었어요.
            {info && !info.checked && " (공공데이터포털 키가 없어 다른 이름으로는 다시 찾아보지 못했어요)"}
          </p>
          {known ? (
            <p><strong>그래서 아래 내용은 국립수목원 공식 정보가 아니라 {aiLabel}가 알려 준 내용이에요.</strong> 틀린 곳이 있을 수 있어요.</p>
          ) : (
            <p>AI 키를 넣으면 AI가 이 식물에 대해 알려 줘요. <Link href="/settings" className="link">설정에서 넣기 →</Link></p>
          )}
          {info?.whyNotListed && (
            <div className="why-not"><strong>🤔 왜 도감에 없을까요?</strong> {info.whyNotListed}</div>
          )}
          <div className="check-tips">
            <strong>✅ 정확한지 이렇게 확인해요</strong>
            <ul>
              <li>🏷️ 식물 옆 이름표나 안내판을 찾아봐요</li>
              <li>📚 학교 도서관의 식물도감에서 찾아봐요</li>
              <li>🙋 선생님이나 어른께 여쭤봐요</li>
            </ul>
          </div>
        </div>
      ) : null}

      {known && !listedAs && info && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>🤖 {aiLabel}가 알려 준 정보</h2>
            <span className="badge ai">공식 정보 아님</span>
          </div>
          <p className="muted small" style={{ margin: "4px 0 10px" }}>{GRADE_LABEL[grade]} 눈높이로 썼어요. 학년은 아래 &lsquo;교과서와 연결하기&rsquo;에서 바꿀 수 있어요.</p>
          {busy && <p className="muted">🧒 {GRADE_LABEL[grade]} 눈높이로 다시 쓰는 중…</p>}
          {info.mock && <div className="alert warn">연습 모드: 연습용 설명이에요.</div>}
          <div className="stack">
            {info.kidSummary && <p className="kid-summary">{info.kidSummary}</p>}
            {info.sections.map((s, i) => (
              <div key={i} className={`easy-section ${s.title === "조심할 점" ? "caution" : ""}`}>
                <strong>{SECTION_ICON[s.title] ?? "📌"} {s.title}</strong>
                <p>{s.text}</p>
              </div>
            ))}
            {info.glossary.length ? <Glossary items={info.glossary} /> : null}
            {info.wonder && (
              <div className="easy-section wonder">
                <strong>💡 더 알아볼까요?</strong>
                <p>{info.wonder}</p>
              </div>
            )}
          </div>
          <div className="source">출처: {aiLabel}(AI)가 쓴 글 · 국립수목원 공식 원문이 없는 식물이라 이름표·도감·선생님과 꼭 확인해요</div>
        </div>
      )}

      {!listedAs && info?.relatives?.length ? (
        <div className="card">
          <h2>🌿 국립수목원 도감에 있는 같은 무리(속) 식물</h2>
          <p className="small muted" style={{ marginTop: -4 }}>&lsquo;{shownName}&rsquo;과(와) 같은 무리지만 <strong>다른 식물</strong>이에요. 공식 정보를 열어 생김새를 비교해 볼 수 있어요.</p>
          {info.relatives.map((r) => (
            <button key={r.pilbkNo} className="cand relative" onClick={() => openOfficial(r)}>
              <div className="name">{r.koreanName}</div>
              <div className="sci">{r.scientificName}{r.family ? ` · ${r.family}` : ""}</div>
              <span className="badge official" style={{ marginTop: 6 }}>공식 정보 보기 →</span>
            </button>
          ))}
        </div>
      ) : null}

      {canRecord && (
        <>
          <CurriculumLinks
            links={links}
            grade={grade}
            role={role}
            onGrade={changeGrade}
            answers={curriAnswers}
            onAnswer={(code, v) => setCurriAnswers((a) => ({ ...a, [code]: v }))}
            unlisted
          />
          <Steps current={4} />
          <RecordForm
            matchQuestion="AI가 말한 식물과 내가 관찰한 모습이 일치하나요?"
            questions={info?.observeQuestions?.length ? info.observeQuestions.slice(0, 3) : DEFAULT_QUESTIONS}
            questionsLabel={`관찰 질문 ${info?.observeQuestions?.length ? "(AI 제안)" : "(기본)"}`}
            learningPlaceholder="관찰하며 알게 된 것, 이름표·도감으로 확인한 것, 더 궁금한 것"
            photo={draft.photo}
            onSave={save}
          />
        </>
      )}
    </>
  );
}
