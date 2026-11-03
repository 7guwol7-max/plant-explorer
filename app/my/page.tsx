"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadCards, deleteCard, type Card } from "@/lib/client/cards";
import { LEAF_SHAPES, LEAF_VEINS, STEMS, PLACES } from "@/lib/client/draft";
import { FIELD_SHORT } from "@/lib/fields";
import { GRADE_LABEL, activitySteps } from "@/lib/curriculum";
import { useRole } from "@/lib/client/prefs";

type View = "cards" | "sort" | "curri";
type Criterion = "leafShape" | "leafVein" | "stem" | "place" | "custom";
type CustomSort = { question: string; yes: string[]; no: string[] };

const CRITERIA: { key: Criterion; label: string; order?: string[] }[] = [
  { key: "leafShape", label: "잎 모양", order: LEAF_SHAPES },
  { key: "leafVein", label: "잎맥", order: LEAF_VEINS },
  { key: "stem", label: "줄기", order: STEMS },
  { key: "place", label: "찾은 장소", order: PLACES },
  { key: "custom", label: "✍️ 내가 정한 기준" },
];

const SORT_KEY = "mySort";
const NONE = "기록 없음";

function loadSort(): CustomSort {
  try {
    const j = JSON.parse(localStorage.getItem(SORT_KEY) ?? "null");
    if (j && typeof j.question === "string") return { question: j.question, yes: j.yes ?? [], no: j.no ?? [] };
  } catch {}
  return { question: "", yes: [], no: [] };
}
function storeSort(s: CustomSort) {
  try { localStorage.setItem(SORT_KEY, JSON.stringify(s)); } catch {}
}

function valueOf(c: Card, k: Exclude<Criterion, "custom">): string {
  const v = k === "place" ? c.place : c.myObservation?.[k];
  return v && v.trim() ? v : NONE;
}

/** 나의 도감 — 이 기기에 저장된 카드 · 분류해 보기 · 교과서 연결별 보기 */
export default function MyPage() {
  const role = useRole();
  const teacher = role === "teacher";
  const [cards, setCards] = useState<Card[]>([]);
  const [open, setOpen] = useState<Card | null>(null);
  const [view, setView] = useState<View>("cards");
  const [crit, setCrit] = useState<Criterion>("leafShape");
  const [custom, setCustom] = useState<CustomSort>({ question: "", yes: [], no: [] });

  useEffect(() => {
    setCards(loadCards());
    setCustom(loadSort());
    const v = new URLSearchParams(window.location.search).get("view");
    if (v === "sort" || v === "curri") setView(v);
  }, []);

  function updateCustom(next: CustomSort) {
    setCustom(next);
    storeSort(next);
  }

  function place(id: string, side: "yes" | "no") {
    const yes = custom.yes.filter((x) => x !== id);
    const no = custom.no.filter((x) => x !== id);
    (side === "yes" ? yes : no).push(id);
    updateCustom({ ...custom, yes, no });
  }

  function remove(id: string) {
    if (!confirm("이 카드를 지울까요?")) return;
    deleteCard(id);
    setCards(loadCards());
    setOpen(null);
  }

  /** 기준별 무리 나누기 */
  const groups = useMemo(() => {
    if (crit === "custom") return [];
    const order = CRITERIA.find((c) => c.key === crit)?.order ?? [];
    const map = new Map<string, Card[]>();
    for (const c of cards) {
      const v = valueOf(c, crit);
      map.set(v, [...(map.get(v) ?? []), c]);
    }
    const rank = (v: string) => (v === NONE ? 999 : order.indexOf(v) < 0 ? 500 : order.indexOf(v));
    return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [cards, crit]);

  /** 성취기준별 모아 보기 */
  const byStandard = useMemo(() => {
    const map = new Map<string, { code: string; subject: string; unit: string; officialText: string; kidText?: string; cards: Card[] }>();
    for (const c of cards) {
      for (const k of c.curriculum ?? []) {
        const e = map.get(k.code) ?? { code: k.code, subject: k.subject, unit: k.unit, officialText: k.officialText, kidText: k.kidText, cards: [] };
        e.cards.push(c);
        map.set(k.code, e);
      }
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code, "ko"));
  }, [cards]);

  /* ───────── 카드 한 장 ───────── */
  if (open) {
    const c = open;
    return (
      <>
        <div className="row no-print" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <button className="btn btn-sm" onClick={() => setOpen(null)}>← 목록</button>
          <div className="row">
            <button className="btn btn-sm" onClick={() => window.print()}>🖨️ 인쇄</button>
            <button className="btn btn-sm btn-danger" onClick={() => remove(c.id)}>지우기</button>
          </div>
        </div>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>{c.confirmed.koreanName}</h2>
            <span className={`badge ${c.verified === "일치" ? "official" : "warn"}`}>내 관찰과: {c.verified}</span>
          </div>
          <div className="muted small" style={{ fontStyle: "italic" }}>{c.confirmed.scientificName}{c.confirmed.family ? ` · ${c.confirmed.family}` : ""}</div>
          {c.unlisted && <div style={{ marginTop: 6 }}><span className="badge warn">📕 국립수목원 미등록 식물</span></div>}
          {c.photo && <img src={c.photo} alt="" style={{ width: "100%", borderRadius: 12, marginTop: 10 }} />}
          <p className="small" style={{ marginTop: 8 }}>
            📍 {c.place ?? "-"} · 🗓️ {new Date(c.createdAt).toLocaleDateString("ko-KR")}<br />
            👀 내 관찰: {c.myObservation ? `${c.myObservation.leafShape} · ${c.myObservation.leafVein} · ${c.myObservation.stem}` : "-"}
          </p>
          {c.aiCandidates?.length ? <p className="small"><span className="badge ai">AI 후보</span> {c.aiCandidates.map((a) => a.koreanName).join(", ")}</p> : null}
        </div>

        {c.drawings?.length ? (
          <div className="card">
            <h2>✏️ 나의 관찰 그림</h2>
            <div className="drawings">
              {c.drawings.map((d, i) => (
                <figure key={i} className="drawing" style={{ margin: 0 }}>
                  <img src={d.image} alt={`관찰 그림 ${i + 1}`} />
                  <figcaption className="small">{d.note || <span className="muted">(설명 없음)</span>}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card">
          <h2>나의 기록</h2>
          {c.answers.map((a, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div className="small" style={{ fontWeight: 700 }}>{i + 1}. {a.q}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{a.a || <span className="muted">(비어 있음)</span>}</div>
            </div>
          ))}
          <h3>새롭게 알게 된 점</h3>
          <div style={{ whiteSpace: "pre-wrap" }}>{c.newLearning || <span className="muted">(비어 있음)</span>}</div>
        </div>

        {c.curriculum?.length ? (
          <div className="card curri-card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>📚 교과서 연결</h2>
              {c.gradeBand && <span className="badge curri">{GRADE_LABEL[c.gradeBand]}</span>}
            </div>
            {c.curriculum.map((k) => (
              <div className="curri" key={k.code}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="curri-unit">{k.subject} · {k.unit}</span>
                  {teacher && <code className="inline">{k.code}</code>}
                </div>
                {teacher || !k.kidText ? (
                  <blockquote className="official-text">{k.officialText}</blockquote>
                ) : (
                  <div className="kid-text"><span className="kid-label">📖 우리 교과서에 이런 내용이 나와요</span><p>{k.kidText}</p></div>
                )}
                <div className={`mission ${k.answer ? "done" : ""}`}>
                  <div className="mission-head">
                    <span className="mission-title">🎯 해 본 활동</span>
                    <span className="mission-tag">{k.answer ? "✅ 적었어요" : "아직 안 적었어요"}</span>
                  </div>
                  <ol className="mission-steps">{activitySteps(k.activity).map((t, i) => <li key={i}>{t}</li>)}</ol>
                  <div className="mission-answer">{k.answer || <span className="muted">(비어 있음)</span>}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {c.kidSummary && (
          <div className="card">
            <span className="badge ai">{c.unlisted ? `${c.unlisted.by || "AI"}가 알려 준 소개 · 공식 정보 아님` : "AI 쉬운 설명"}</span>
            <p style={{ marginTop: 8 }}>{c.kidSummary}</p>
          </div>
        )}

        {c.unlisted ? (
          <div className="unlisted-notice">
            <div className="unlisted-title">📕 국립수목원 식물도감에 정식으로 등록되어 있지 않은 식물이에요</div>
            <p>공식 원문이 없어서 {c.unlisted.by ? `${c.unlisted.by}(AI)가 알려 준 내용을` : "내 관찰을"} 남겼어요. 이름표·도감·선생님과 확인해요.</p>
            {c.unlisted.whyNotListed && <div className="why-not"><strong>🤔 왜 도감에 없을까요?</strong> {c.unlisted.whyNotListed}</div>}
            {c.unlisted.sections.map((s, i) => (
              <details key={i} className="field-block" style={{ marginTop: 8 }}>
                <summary>{s.title} <span className="muted small">(AI)</span></summary>
                <p>{s.text}</p>
              </details>
            ))}
          </div>
        ) : (
          <div className="card">
            <span className="badge official">국립수목원 공식 정보</span>
            {Object.entries(c.official).filter(([k]) => k !== "source" && FIELD_SHORT[k]).map(([k, v]) => (
              <details key={k} className="field-block" style={{ marginTop: 8 }}>
                <summary>{FIELD_SHORT[k]}</summary>
                <p>{v}</p>
              </details>
            ))}
            <div className="source">출처: {c.official.source}</div>
          </div>
        )}
      </>
    );
  }

  const tile = (c: Card, extra?: React.ReactNode) => (
    <div key={c.id} className="tile">
      <div onClick={() => setOpen(c)} style={{ cursor: "pointer" }}>
        {c.photo ? <img src={c.photo} alt="" /> : <div className="noimg">🌱</div>}
        <div className="body">
          <div className="name">{c.confirmed.koreanName}</div>
          <div className="meta">{c.place ?? ""} · {new Date(c.createdAt).toLocaleDateString("ko-KR")}{c.unlisted ? " · 📕 도감 미등록" : ""}</div>
          {view === "cards" && <div className="meta">{c.verified === "일치" ? "✅ 관찰 일치" : c.verified === "불일치" ? "❌ 관찰 다름" : "❓ 확인 필요"}{c.drawings?.length ? ` · ✏️ 그림 ${c.drawings.length}` : ""}</div>}
        </div>
      </div>
      {extra}
    </div>
  );

  /* ───────── 목록 ───────── */
  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>📒 나의 도감</h2>
          <span className="muted small">{cards.length}장 · 이 기기에만 저장</span>
        </div>
        {cards.length > 0 && (
          <div className="tabs" style={{ marginTop: 10, marginBottom: 0 }}>
            <button className={view === "cards" ? "on" : ""} onClick={() => setView("cards")}>카드</button>
            <button className={view === "sort" ? "on" : ""} onClick={() => setView("sort")}>🗂️ 분류해 보기</button>
            <button className={view === "curri" ? "on" : ""} onClick={() => setView("curri")}>📚 교과서별</button>
          </div>
        )}
      </div>

      {cards.length === 0 && (
        <div className="card">
          <p>아직 카드가 없어요. <Link href="/" className="link">식물을 발견하러 가기 →</Link></p>
        </div>
      )}

      {view === "cards" && <div className="grid">{cards.map((c) => tile(c))}</div>}

      {view === "sort" && cards.length > 0 && (
        <>
          <div className="card">
            <h2>🗂️ 기준을 정해 나눠 봐요</h2>
            <p className="small" style={{ marginTop: -4 }}>
              누가 나눠도 결과가 똑같이 나오는 기준이 좋은 기준이에요. ‘예쁜가?’처럼 사람마다 생각이 다른 기준은 피해요.
            </p>
            <div className="chips">
              {CRITERIA.map((c) => (
                <button key={c.key} className={`chip ${crit === c.key ? "on" : ""}`} onClick={() => setCrit(c.key)}>{c.label}</button>
              ))}
            </div>
            {crit === "custom" && (
              <label className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                <span>내 분류 기준 (예/아니요로 답할 수 있게)</span>
                <input className="input" value={custom.question} onChange={(e) => updateCustom({ ...custom, question: e.target.value })} placeholder="예: 잎의 가장자리가 톱니 모양인가요?" />
              </label>
            )}
          </div>

          {crit !== "custom" &&
            groups.map(([name, list]) => (
              <div className="card" key={name}>
                <h3 style={{ marginTop: 0 }}>{name} <span className="muted small">({list.length}장)</span></h3>
                <div className="grid">{list.map((c) => tile(c))}</div>
              </div>
            ))}

          {crit === "custom" && (
            <>
              {(["yes", "no"] as const).map((side) => {
                const list = cards.filter((c) => custom[side].includes(c.id));
                return (
                  <div className="card" key={side}>
                    <h3 style={{ marginTop: 0 }}>{side === "yes" ? "⭕ 그렇다" : "❌ 그렇지 않다"} <span className="muted small">({list.length}장)</span></h3>
                    {list.length === 0 ? <p className="muted small">아래 카드에서 골라 넣어요.</p> : <div className="grid">{list.map((c) => tile(c, <SortButtons onPick={(s) => place(c.id, s)} />))}</div>}
                  </div>
                );
              })}
              {cards.some((c) => !custom.yes.includes(c.id) && !custom.no.includes(c.id)) && (
                <div className="card">
                  <h3 style={{ marginTop: 0 }}>아직 안 나눈 카드</h3>
                  <div className="grid">
                    {cards.filter((c) => !custom.yes.includes(c.id) && !custom.no.includes(c.id)).map((c) => tile(c, <SortButtons onPick={(s) => place(c.id, s)} />))}
                  </div>
                </div>
              )}
              <button className="btn btn-ghost" onClick={() => updateCustom({ question: custom.question, yes: [], no: [] })}>다시 나누기</button>
            </>
          )}
        </>
      )}

      {view === "curri" && cards.length > 0 && (
        <>
          {byStandard.length === 0 && <div className="card"><p className="muted">교과서 연결이 저장된 카드가 아직 없어요. 새로 저장하는 카드부터 모여요.</p></div>}
          {byStandard.map((g) => (
            <div className="card curri-card" key={g.code}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="curri-unit">{g.subject} · {g.unit}</span>
                {teacher && <code className="inline">{g.code}</code>}
              </div>
              {teacher || !g.kidText ? (
                <blockquote className="official-text">{g.officialText}</blockquote>
              ) : (
                <div className="kid-text"><p>{g.kidText}</p></div>
              )}
              <div className="grid">{g.cards.map((c) => tile(c))}</div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function SortButtons({ onPick }: { onPick: (s: "yes" | "no") => void }) {
  return (
    <div className="row sort-btns">
      <button className="btn btn-sm" onClick={() => onPick("yes")}>⭕</button>
      <button className="btn btn-sm" onClick={() => onPick("no")}>❌</button>
    </div>
  );
}
