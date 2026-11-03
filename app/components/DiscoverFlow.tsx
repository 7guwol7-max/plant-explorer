"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Steps from "./Steps";
import CameraCapture from "./CameraCapture";
import ErrorAlert from "./ErrorAlert";
import { api, ApiError, toApiError } from "@/lib/client/keys";
import { useConnection } from "@/lib/client/useConnection";
import { fileToDataUrl } from "@/lib/client/image";
import { saveDraft, loadDraft, clearDraft, PLACES, LEAF_SHAPES, LEAF_VEINS, STEMS, type CandidateLite, type Observation } from "@/lib/client/draft";

type Summary = { pilbkNo: string; koreanName: string; scientificName: string; family: string };
type Err = { message: string; needsSettings?: boolean } | null;

const toErr = (e: unknown, fallback: string): Err =>
  e instanceof ApiError ? { message: e.message, needsSettings: e.needsSettings } : { message: e instanceof Error ? e.message : fallback };

/**
 * 화면 ① 발견 → 화면 ② 추정
 * - 휴대폰: 기본 카메라 앱으로 찍기 / 컴퓨터: 웹캠 창으로 찍기 또는 파일 고르기·끌어 놓기
 * - 사진은 브라우저에서 1024px로 줄여 /api/identify 로 보낸다 (서버는 저장하지 않음)
 * - 제미나이 키가 없으면 AI 단계를 건너뛰고 이름을 직접 넣어 국립수목원 정보를 찾는다
 * - 고른 이름은 /api/plants/search 로 국립수목원 도감번호를 찾아 확인 화면으로
 */
export default function DiscoverFlow() {
  const router = useRouter();
  const conn = useConnection();
  const [step, setStep] = useState<1 | 2>(1);
  const [photo, setPhoto] = useState<string>();
  const [place, setPlace] = useState(PLACES[0]);
  const [obs, setObs] = useState<Observation>({ leafShape: "", leafVein: "", stem: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Err>(null);
  const [cands, setCands] = useState<CandidateLite[]>([]);
  const [uncertain, setUncertain] = useState(false);
  const [isMock, setIsMock] = useState(false);
  const [noAI, setNoAI] = useState(false); // AI 없이 이름으로 찾는 중
  const [manual, setManual] = useState("");
  const [choices, setChoices] = useState<Summary[] | null>(null); // 검색 결과가 여러 개일 때
  const [touch, setTouch] = useState(true);
  const [camOpen, setCamOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  // 뒤로 왔을 때 작업 중 자료 복원 + 기기 종류 판단
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
    setTouch(window.matchMedia?.("(pointer: coarse)").matches ?? false);
  }, []);

  async function readPhotoFile(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErr({ message: "사진 파일만 쓸 수 있어요." });
      return;
    }
    setErr(null);
    setBusy("사진 준비 중…");
    try {
      const url = await fileToDataUrl(f, 1024);
      setPhotoUrl(url);
    } catch {
      setErr({ message: "사진을 읽지 못했어요. 다른 사진으로 해 보세요." });
    } finally {
      setBusy(null);
    }
  }

  function setPhotoUrl(url: string) {
    setPhoto(url);
    saveDraft({ ...loadDraft(), photo: url });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    void readPhotoFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    void readPhotoFile(e.dataTransfer.files?.[0]);
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
      if (res.status === 401) {
        // 제미나이 키가 없거나 막힌 경우: 이름으로 찾기로 넘어간다
        goManual();
        setErr({ message: (await toApiError(res)).message, needsSettings: true });
        return;
      }
      if (!res.ok) throw await toApiError(res);
      const j = await res.json();
      setCands(j.candidates ?? []);
      setUncertain(Boolean(j.uncertain));
      setIsMock(Boolean(j.mock));
      setNoAI(false);
      saveDraft({ photo, place, observation: obs, aiCandidates: j.candidates ?? [], aiUncertain: Boolean(j.uncertain) });
      setStep(2);
    } catch (e) {
      setErr(toErr(e, "AI 호출에 실패했어요"));
    } finally {
      setBusy(null);
    }
  }

  /** AI 없이 바로 이름 입력 단계로 */
  function goManual() {
    setCands([]);
    setUncertain(false);
    setNoAI(true);
    saveDraft({ photo, place, observation: obs, aiCandidates: [] });
    setStep(2);
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
        setErr({ message: `'${c.koreanName}'을(를) 국립수목원 도감에서 찾지 못했어요. 이름을 조금 바꿔서 직접 입력해 보거나 선생님과 확인해 보세요.` });
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
      setErr(toErr(e, "검색에 실패했어요"));
    } finally {
      setBusy(null);
    }
  }

  async function search(q: string): Promise<Summary[]> {
    const res = await api(`/api/plants/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw await toApiError(res);
    const j = await res.json();
    return j.items ?? [];
  }

  function restart() {
    clearDraft();
    setPhoto(undefined);
    setCands([]);
    setChoices(null);
    setManual("");
    setNoAI(false);
    setErr(null);
    setStep(1);
  }

  const setupBanner = conn.ready && !conn.data && (
    <div className="card setup">
      <h2>👋 처음 오셨나요?</h2>
      <p className="small" style={{ margin: "0 0 10px" }}>
        국립수목원 공식 정보를 보려면 <strong>공공데이터포털 인증키</strong>를 한 번 넣어야 해요. 무료이고 5분이면 받을 수 있어요. 키는 이 기기에만 저장돼요.
      </p>
      <Link href="/settings" className="btn btn-primary">⚙️ 내 키 넣으러 가기</Link>
    </div>
  );

  /* ───────── 화면 ① ───────── */
  if (step === 1) {
    return (
      <>
        {setupBanner}
        <Steps current={1} />
        <div className="card">
          <h2>① 식물을 발견했어요</h2>
          <div
            className={`photo-box ${dragging ? "drag" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {photo ? <img src={photo} alt="찍은 식물 사진" /> : <span>{touch ? "잎과 식물 전체가 잘 보이게 찍어요" : "잎과 식물 전체가 잘 보이게 찍거나, 사진을 여기로 끌어다 놓아요"}</span>}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            {touch ? (
              <>
                <label className="btn btn-primary file-btn" style={{ flex: 1 }}>
                  📷 사진 찍기
                  <input type="file" accept="image/*" capture="environment" onChange={onFile} />
                </label>
                <label className="btn file-btn" style={{ flex: 1 }}>
                  🖼️ 앨범에서 고르기
                  <input type="file" accept="image/*" onChange={onFile} />
                </label>
              </>
            ) : (
              <>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setCamOpen(true)}>📷 웹캠으로 찍기</button>
                <label className="btn file-btn" style={{ flex: 1 }}>
                  🖼️ 사진 파일 고르기
                  <input type="file" accept="image/*" onChange={onFile} />
                </label>
              </>
            )}
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>
            {touch ? "휴대폰·태블릿 카메라가 열려요." : "노트북 카메라를 쓰거나, 휴대폰으로 찍은 사진 파일을 골라요."} 사진은 AI 식별에만 쓰고 서버에 저장하지 않아요.
          </p>
        </div>
        {camOpen && <CameraCapture onCapture={(url) => { setPhotoUrl(url); setCamOpen(false); }} onClose={() => setCamOpen(false)} />}

        <div className="card">
          <h2>어디에서 찾았나요?</h2>
          <div className="chips">
            {PLACES.map((p) => (
              <button key={p} className={`chip ${place === p ? "on" : ""}`} onClick={() => setPlace(p)}>{p}</button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>{conn.gemini ? "AI에게 묻기 전에, 먼저 내 눈으로 관찰해요" : "먼저 내 눈으로 관찰해요"}</h2>
          <h3>잎 모양</h3>
          <div className="chips">{LEAF_SHAPES.map((v) => <button key={v} className={`chip ${obs.leafShape === v ? "on" : ""}`} onClick={() => setObs({ ...obs, leafShape: v })}>{v}</button>)}</div>
          <h3>잎맥</h3>
          <div className="chips">{LEAF_VEINS.map((v) => <button key={v} className={`chip ${obs.leafVein === v ? "on" : ""}`} onClick={() => setObs({ ...obs, leafVein: v })}>{v}</button>)}</div>
          <h3>줄기</h3>
          <div className="chips">{STEMS.map((v) => <button key={v} className={`chip ${obs.stem === v ? "on" : ""}`} onClick={() => setObs({ ...obs, stem: v })}>{v}</button>)}</div>
        </div>

        {err && <ErrorAlert {...err} />}
        {conn.gemini || !conn.ready ? (
          <button className="btn btn-ai" disabled={!photo || !obsDone || Boolean(busy)} onClick={askAI}>
            {busy ?? "🤖 AI에게 어떤 식물인지 물어보기"}
          </button>
        ) : (
          <button className="btn btn-primary" disabled={!obsDone || Boolean(busy)} onClick={goManual}>
            {busy ?? "📗 이름으로 국립수목원 정보 찾기"}
          </button>
        )}
        {!obsDone && (photo || !conn.gemini) && <p className="muted small" style={{ textAlign: "center", marginTop: 8 }}>관찰 3가지를 모두 고르면 다음으로 넘어갈 수 있어요</p>}
        {conn.ready && conn.data && !conn.gemini && (
          <p className="muted small" style={{ textAlign: "center", marginTop: 8 }}>
            제미나이 키를 넣으면 AI가 사진을 보고 후보를 알려 줘요. <Link href="/settings" className="link">설정</Link>
          </p>
        )}
      </>
    );
  }

  /* ───────── 화면 ② ───────── */
  return (
    <>
      <Steps current={2} />
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>{noAI ? "② 이름으로 찾기" : "② AI의 추정"}</h2>
          {!noAI && <span className="badge ai">AI 추정 · 확정 아님</span>}
        </div>
        {photo && <div className="photo-box" style={{ marginTop: 10, aspectRatio: "16/9" }}><img src={photo} alt="찍은 식물 사진" /></div>}
        <p className="muted small" style={{ marginTop: 8 }}>
          내가 관찰한 것: {obs.leafShape} · {obs.leafVein} · {obs.stem} · {place}
        </p>
        {isMock && <div className="alert warn">연습 모드예요. 실제 AI가 아니라 연습용 답을 보여주고 있어요.</div>}
        {uncertain && <div className="alert warn">AI도 확실하지 않대요. 사진을 다시 찍거나, 잎과 줄기를 더 자세히 관찰해 보세요.</div>}
        {noAI && <p className="small" style={{ margin: 0 }}>식물 이름을 알면 아래에 넣어요. 모르면 선생님·친구와 함께 찾아보거나 도감 검색을 써 봐요.</p>}
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
        <h2>{noAI ? "식물 이름을 넣어요" : "직접 이름을 입력할래요"}</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) void confirm({ koreanName: manual.trim(), scientificName: "" }); }}>
          <input className="input" style={{ flex: 1 }} placeholder="예: 은행나무" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="btn btn-sm" disabled={!manual.trim() || Boolean(busy)}>찾기</button>
        </form>
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
      {err && <ErrorAlert {...err} />}
      <div className="row">
        <button className="btn btn-ghost" onClick={() => setStep(1)}>← 사진 다시 찍기</button>
        <button className="btn btn-ghost" onClick={restart}>처음부터</button>
      </div>
    </>
  );
}
