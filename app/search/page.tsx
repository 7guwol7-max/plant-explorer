"use client";
import { useState } from "react";
import Link from "next/link";
import ErrorAlert from "../components/ErrorAlert";
import { api, ApiError, toApiError } from "@/lib/client/keys";
import { clearDraft } from "@/lib/client/draft";

type Summary = { pilbkNo: string; koreanName: string; scientificName: string; family: string };

/** 이름으로 찾는 작은 도감 (1단계 기능) */
export default function SearchPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Summary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ message: string; needsSettings?: boolean } | null>(null);
  const [mock, setMock] = useState(false);
  const [searched, setSearched] = useState(""); // 마지막으로 찾은 낱말

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    const word = q.trim();
    if (!word) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api(`/api/plants/search?q=${encodeURIComponent(word)}`);
      if (!res.ok) throw await toApiError(res);
      const j = await res.json();
      setItems(j.items ?? []);
      setSearched(word);
      setTotal(j.totalCount ?? 0);
      setMock(Boolean(j.mock));
    } catch (e2) {
      setErr(e2 instanceof ApiError ? { message: e2.message, needsSettings: e2.needsSettings } : { message: e2 instanceof Error ? e2.message : "검색 실패" });
      setItems(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>🔍 이름으로 찾기</h2>
        <form onSubmit={run} className="row">
          <input className="input" style={{ flex: 1 }} placeholder="식물 이름 또는 학명 (예: 은행나무, Pinus)" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-primary btn-sm" disabled={busy || !q.trim()}>{busy ? "찾는 중" : "찾기"}</button>
        </form>
        <p className="muted small" style={{ marginTop: 8 }}>국립수목원 식물도감에서 검색해요. 지역에서 부르는 이름이나 품종명은 안 나올 수 있어요.</p>
      </div>

      {mock && <div className="alert warn">연습 모드예요. 연습용 자료 4종만 검색돼요.</div>}
      {err && <ErrorAlert {...err} />}

      {items && items.length === 0 && (
        <div className="card">
          <p style={{ marginTop: 0 }}>국립수목원 식물도감에서 &lsquo;{searched}&rsquo;을(를) 찾지 못했어요. 다른 이름이나 학명으로 다시 찾아 보세요.</p>
          <p className="muted small">그래도 없으면 국립수목원 도감에 정식으로 등록되지 않은 식물일 수 있어요. AI에게 이 식물에 대해 물어볼 수 있어요.</p>
          <Link href={`/unlisted?name=${encodeURIComponent(searched)}`} className="btn" onClick={() => clearDraft()}>🤖 AI에게 &lsquo;{searched}&rsquo; 알아보기</Link>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="card">
          <p className="muted small">모두 {total}건 중 {items.length}건 표시</p>
          {items.map((s) => (
            <Link key={s.pilbkNo} href={`/plant/${encodeURIComponent(s.pilbkNo)}`} onClick={() => clearDraft()}>
              <div className="cand">
                <div className="name">{s.koreanName}</div>
                <div className="sci">{s.scientificName}{s.family ? ` · ${s.family}` : ""}</div>
                <span className="badge official" style={{ marginTop: 6 }}>공식 정보 보기 →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
