"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Steps from "./Steps";
import { api, errorMessage } from "@/lib/client/keys";
import { fileToDataUrl } from "@/lib/client/image";
import { saveDraft, loadDraft, clearDraft, PLACES, LEAF_SHAPES, LEAF_VEINS, STEMS, type CandidateLite, type Observation } from "@/lib/client/draft";

type Summary = { pilbkNo: string; koreanName: string; scientificName: string; family: string };

/**
 * 화면 ① 발견 → 화면 ② 추정
 * - 사진은 브라우저에서 1024px로 줄여 /api/identify 로 보낸다 (서버는 저장하지 않음)
 * - AI 후보를 학생이 고르면 /api/plants/search 로 국립수목원 도감번호를 찾아 확인 화면으로
 */
export default function DiscoverFlow() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [photo, setPhoto] = useState<string>();
  const [place, setPlace] = useState(PLACES[0]);
  const [obs, setObs] = useState<Observation>({ leafShape: "", leafVein: "", stem: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cands, setCands] = useState<CandidateLite[]>([]);
  const [uncertain, setUncertain] = useState(false);
  const [isMock, setIsMock] = useState(false);
  const [manual, setManual] = useState("");
  const [choices, setChoices] = useState<Summary[] | null>(null); // 검색 결과가 여러 개일 때

  // 뒤로 왔을 때 작업 중 자료 복원
  useEffect(() => {
    const d = loadDraft();
    if (d.photo) setPhoto(d.photo);
    if (d.place) setPlace(d.place);
    if (d.observation) setObs(d.observation);
    if (d.aiCandidates?.length) {
      setCands(d.aiCandidates);
      setUncertain(Boolean(d.aiUncertain));
      setStep(2);
    }
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr(null);
    setBusy("사진 준비 중…");
    try {
      const url = await fileToDataUrl(f, 1024);
      setPhoto(url);
      saveDraft({ ...loadDraft(), photo: url });
    } catch {
      setErr("사진을 읽지 못했어요. 다른 사진으로 해 보세요.");
    } finally {
      setBusy(null);
    }
  }

  const obsDone = obs.leafShape && obs.leafVein && obs.stem;

  async function askAI() {
    if (!photo) return;
    setErr(null);
    setBusy("AI가 사진을 살펴보는 중…");
    try {
      const res = await api("/api/identify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: photo, taxon: "plant" }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      const j = await res.json();
      setCands(j.candidates ?? []);
      setUncertain(Boolean(j.uncertain));
      setIsMock(Boolean(j.mock));
      saveDraft({ photo, place, observation: obs, aiCandidates: j.candidates ?? [], aiUncertain: Boolean(j.uncertain) });
      setStep(2);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI 호출에 실패했어요");
    } finally {
      setBusy(null);
    }
  }

  /** 후보 또는 직접 입력한 이름으로 국립수목원 도감 검색 → 확인 화면 */
  async function confirm(c: CandidateLite) {
    setErr(null);
    setChoices(null);
    setBusy("국립수목원 도감에서 찾는 중…");
    try {
      let items = await search(c.koreanName);
      // 0건이면 학명의 속명(첫 단어)으로 한 번 더
      if (items.length === 0 && c.scientificName) {
        const genus = c.scientificName.trim().split(/\s+/)[0];
        if (genus) items = await search(genus);
      }
      if (items.length === 0) {
        setErr(`'${c.koreanName}'을(를) 국립수목원 도감에서 찾지 못했어요. 이름을 조금 바꿔서 직접 입력해 보거나 선생님과 확인해 보세요.`);
        return;
      }
      saveDraft({ ...loadDraft(), photo, place, observation: obs, chosen: c });
      if (items.length === 1 || items.some((i) => i.koreanName === c.koreanName)) {
        const hit = items.find((i) => i.koreanName === c.koreanName) ?? items[0];
        router.push(`/plant/${encodeURIComponent(hit.pilbkNo)}`);
      } else {
        setChoices(items); // 여러 개면 학생이 고르게
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "검색에 실패했어요");
    } finally {
      setBusy(null);
    }
  }

  async function search(q: string): Promise<Summary[]> {
    const res = await api(`/api/plants/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(await errorMessage(res));
    const j = await res.json();
    return j.items ?? [];
  }

  function restart() {
    clearDraft();
    setPhoto(undefined);
    setCands([]);
    setChoices(null);
    setManual("");
    setStep(1);
  }

  /* ───────── 화면 ① ───────── */
  if (step === 1) {
    return (
      <>
        <Steps current={1} />
        <div className="card">
          <h2>① 식물을 발견했어요</h2>
          <div className="photo-box">
            {photo ? <img src={photo} alt="찍은 식물 사진" /> : <span>잎과 식물 전체가 잘 보이게 찍어요</span>}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <label className="btn btn-primary file-btn" style={{ flex: 1 }}>
              📷 사진 찍기
              <input type="file" accept="image/*" capture="environment" onChange={onFile} />
            </label>
            <label className="btn file-btn" style={{ flex: 1 }}>
              🖼️ 앨범에서 고르기
              <input type="file" accept="image/*" onChange={onFile} />
            </label>
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>휴대폰은 카메라가, 노트북은 파일 선택이 열려요. 사진은 AI 식별에만 쓰고 서버에 저장하지 않아요.</p>
        </div>

        <div className="card">
          <h2>어디에서 찾았나요?</h2>
          <div className="chips">
            {PLACES.map((p) => (
              <button key={p} className={`chip ${place === p ? "on" : ""}`} onClick={() => setPlace(p)}>{p}</button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>AI에게 묻기 전에, 먼저 내 눈으로 관찰해요</h2>
          <h3>잎 모양</h3>
          <div className="chips">{LEAF_SHAPES.map((v) => <button key={v} className={`chip ${obs.leafShape === v ? "on" : ""}`} onClick={() => setObs({ ...obs, leafShape: v })}>{v}</button>)}</div>
          <h3>잎맥</h3>
          <div className="chips">{LEAF_VEINS.map((v) => <button key={v} className={`chip ${obs.leafVein === v ? "on" : ""}`} onClick={() => setObs({ ...obs, leafVein: v })}>{v}</button>)}</div>
          <h3>줄기</h3>
          <div className="chips">{STEMS.map((v) => <button key={v} className={`chip ${obs.stem === v ? "on" : ""}`} onClick={() => setObs({ ...obs, stem: v })}>{v}</button>)}</div>
        </div>

        {err && <div className="alert err">{err}</div>}
        <button className="btn btn-ai" disabled={!photo || !obsDone || Boolean(busy)} onClick={askAI}>
          {busy ?? "🤖 AI에게 어떤 식물인지 물어보기"}
        </button>
        {!obsDone && photo && <p className="muted small" style={{ textAlign: "center", marginTop: 8 }}>관찰 3가지를 모두 고르면 AI에게 물어볼 수 있어요</p>}
      </>
    );
  }

  /* ───────── 화면 ② ───────── */
  return (
    <>
      <Steps current={2} />
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>② AI의 추정</h2>
          <span className="badge ai">AI 추정 · 확정 아님</span>
        </div>
        {photo && <div className="photo-box" style={{ marginTop: 10, aspectRatio: "16/9" }}><img src={photo} alt="찍은 식물 사진" /></div>}
        <p className="muted small" style={{ marginTop: 8 }}>
          내가 관찰한 것: {obs.leafShape} · {obs.leafVein} · {obs.stem} · {place}
        </p>
        {isMock && <div className="alert warn">모의 모드예요. 실제 AI가 아니라 연습용 답을 보여주고 있어요.</div>}
        {uncertain && <div className="alert warn">AI도 확실하지 않대요. 사진을 다시 찍거나, 잎과 줄기를 더 자세히 관찰해 보세요.</div>}
      </div>

      {cands.map((c, i) => (
        <div className="cand" key={i}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="name">{c.koreanName}</span>
            <span className={`badge ${c.confidence === "높음" ? "official" : "warn"}`}>신뢰도 {c.confidence ?? "?"}</span>
          </div>
          <div className="sci">{c.scientificName}</div>
          {c.evidence && <div className="ev">👀 AI가 본 근거: {c.evidence}</div>}
          <p className="small" style={{ margin: "0 0 8px" }}>내가 관찰한 모습과 맞나요?</p>
          <button className="btn btn-primary btn-sm" disabled={Boolean(busy)} onClick={() => confirm(c)}>이 식물로 국립수목원 정보 확인하기</button>
        </div>
      ))}

      <div className="card">
        <h2>직접 이름을 입력할래요</h2>
        <div className="row">
          <input className="input" style={{ flex: 1 }} placeholder="예: 은행나무" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="btn btn-sm" disabled={!manual.trim() || Boolean(busy)} onClick={() => confirm({ koreanName: manual.trim(), scientificName: "" })}>찾기</button>
        </div>
      </div>

      {choices && (
        <div className="card">
          <h2>비슷한 이름이 여러 개예요. 어느 것일까요?</h2>
          {choices.map((s) => (
            <div className="cand" key={s.pilbkNo}>
              <div className="name">{s.koreanName}</div>
              <div className="sci">{s.scientificName} · {s.family}</div>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => { saveDraft({ ...loadDraft(), chosen: { koreanName: s.koreanName, scientificName: s.scientificName } }); router.push(`/plant/${encodeURIComponent(s.pilbkNo)}`); }}>이것이에요</button>
            </div>
          ))}
        </div>
      )}

      {busy && <div className="alert ok">{busy}</div>}
      {err && <div className="alert err">{err}</div>}
      <div className="row">
        <button className="btn btn-ghost" onClick={() => setStep(1)}>← 사진 다시 찍기</button>
        <button className="btn btn-ghost" onClick={restart}>처음부터</button>
      </div>
    </>
  );
}
