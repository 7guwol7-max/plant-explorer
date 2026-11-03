"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadCards, deleteCard, type Card } from "@/lib/client/cards";

const LABEL: Record<string, string> = {
  shpe: "형태", spft: "특징", grwEvrntDesc: "생육환경", rrngType: "생육형", rrngGubun: "생육상 구분",
  dstrb: "분포", osDstrb: "해외 분포", orplcNm: "원산지", inductionDesc: "도입 여부",
  smlrPlntDesc: "유사종", useMthdDesc: "이용 방안", prtcPlnDesc: "보호 방안",
};

/** 나의 도감 — 이 기기에 저장된 카드 */
export default function MyPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [open, setOpen] = useState<Card | null>(null);

  useEffect(() => { setCards(loadCards()); }, []);

  function remove(id: string) {
    if (!confirm("이 카드를 지울까요?")) return;
    deleteCard(id);
    setCards(loadCards());
    setOpen(null);
  }

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
            <span className={`badge ${c.verified === "일치" ? "official" : "warn"}`}>AI와 내 관찰: {c.verified}</span>
          </div>
          <div className="muted small" style={{ fontStyle: "italic" }}>{c.confirmed.scientificName}{c.confirmed.family ? ` · ${c.confirmed.family}` : ""}</div>
          {c.photo && <img src={c.photo} alt="" style={{ width: "100%", borderRadius: 12, marginTop: 10 }} />}
          <p className="small" style={{ marginTop: 8 }}>
            📍 {c.place ?? "-"} · 🗓️ {new Date(c.createdAt).toLocaleDateString("ko-KR")}<br />
            👀 내 관찰: {c.myObservation ? `${c.myObservation.leafShape} · ${c.myObservation.leafVein} · ${c.myObservation.stem}` : "-"}
          </p>
          {c.aiCandidates?.length ? <p className="small"><span className="badge ai">AI 후보</span> {c.aiCandidates.map((a) => a.koreanName).join(", ")}</p> : null}
        </div>

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

        {c.kidSummary && (
          <div className="card">
            <span className="badge ai">AI 쉬운 설명</span>
            <p style={{ marginTop: 8 }}>{c.kidSummary}</p>
          </div>
        )}

        <div className="card">
          <span className="badge official">국립수목원 공식 정보</span>
          {Object.entries(c.official).filter(([k]) => k !== "source" && LABEL[k]).map(([k, v]) => (
            <details key={k} className="field-block" style={{ marginTop: 8 }}>
              <summary>{LABEL[k]}</summary>
              <p>{v}</p>
            </details>
          ))}
          <div className="source">출처: {c.official.source}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>📒 나의 도감</h2>
          <span className="muted small">{cards.length}장 · 이 기기에만 저장</span>
        </div>
      </div>
      {cards.length === 0 && (
        <div className="card">
          <p>아직 카드가 없어요. <Link href="/" style={{ color: "var(--green)", fontWeight: 700 }}>식물을 발견하러 가기 →</Link></p>
        </div>
      )}
      <div className="grid">
        {cards.map((c) => (
          <div key={c.id} className="tile" onClick={() => setOpen(c)}>
            {c.photo ? <img src={c.photo} alt="" /> : <div className="noimg">🌱</div>}
            <div className="body">
              <div className="name">{c.confirmed.koreanName}</div>
              <div className="meta">{c.place ?? ""} · {new Date(c.createdAt).toLocaleDateString("ko-KR")}</div>
              <div className="meta">{c.verified === "일치" ? "✅ 관찰 일치" : c.verified === "불일치" ? "❌ 관찰 다름" : "❓ 확인 필요"}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
