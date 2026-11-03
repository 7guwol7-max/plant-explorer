"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Steps from "./Steps";
import CameraCapture from "./CameraCapture";
import TermChips from "./TermChips";
import ErrorAlert from "./ErrorAlert";
import { api, ApiError, toApiError } from "@/lib/client/keys";
import { useConnection } from "@/lib/client/useConnection";
import { AI_NAME } from "@/lib/ai";
import { sciBinomial } from "@/lib/names";
import { SITE } from "@/lib/site";
import { fileToDataUrl } from "@/lib/client/image";
import { imageFromPaste, pasteKey, readClipboardImage } from "@/lib/client/clipboard";
import { saveDraft, loadDraft, clearDraft, MAX_PHOTOS, PLACES, LEAF_SHAPES, LEAF_VEINS, STEMS, type CandidateLite, type Observation } from "@/lib/client/draft";

type Summary = { pilbkNo: string; koreanName: string; scientificName: string; family: string };
type Err = { message: string; needsSettings?: boolean } | null;

const toErr = (e: unknown, fallback: string): Err =>
  e instanceof ApiError ? { message: e.message, needsSettings: e.needsSettings } : { message: e instanceof Error ? e.message : fallback };

/**
 * 화면 ① 발견 → 화면 ② 추정
 * - 이 앱의 목적은 "이름을 모르는 식물을 알아보기" → 사진 + AI 식별이 주된 길
 * - 사진 넣는 법: 휴대폰 카메라 / 앨범 / 컴퓨터 웹캠 / 파일 / 끌어다 놓기 / 붙여넣기(Ctrl+V·버튼)
 * - 같은 식물을 여러 방향(전체·잎·꽃이나 열매)으로 최대 3장 → AI가 함께 보고 더 정확하게 판단
 * - 후보가 맞지 않으면 사진을 더 넣어 다시 묻기. 이름 입력은 '이미 알고 있을 때'만 쓰는 접힌 메뉴
 * - 국립수목원 도감에 없는 후보면 /unlisted 화면으로 (AI 정보 + '정식 등록 안 됨' 안내)
 */
export default function DiscoverFlow() {
  const router = useRouter();
  const conn = useConnection();
  const [step, setStep] = useState<1 | 2>(1);
  const [photos, setPhotos] = useState<string[]>([]);
  const [sel, setSel] = useState(0);
  const [place, setPlace] = useState(PLACES[0]);
  const [obs, setObs] = useState<Observation>({ leafShape: "", leafVein: "", stem: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Err>(null);
  const [note, setNote] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null); // 사진 카드 안에 보여 줄 안내
  const [cands, setCands] = useState<CandidateLite[]>([]);
  const [uncertain, setUncertain] = useState(false);
  const [isMock, setIsMock] = useState(false);
  const [manual, setManual] = useState("");
  const [choices, setChoices] = useState<Summary[] | null>(null); // 검색 결과가 여러 개일 때
  const [picked, setPicked] = useState<CandidateLite | null>(null); // 도감에서 찾아본 후보
  const [touch, setTouch] = useState(true);
  const [camOpen, setCamOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [keyLabel, setKeyLabel] = useState("Ctrl+V");
  const photosRef = useRef<string[]>([]);

  // 뒤로 왔을 때 작업 중 자료 복원 + 기기 종류 판단
  useEffect(() => {
    const d = loadDraft();
    const ps = d.photos?.length ? d.photos : d.photo ? [d.photo] : [];
    photosRef.current = ps;
    setPhotos(ps);
    if (d.place) setPlace(d.place);
    if (d.observation) setObs(d.observation);
    if (d.aiCandidates?.length) {
      setCands(d.aiCandidates);
      setUncertain(Boolean(d.aiUncertain));
      setStep(2);
    }
    setTouch(window.matchMedia?.("(pointer: coarse)").matches ?? false);
    setKeyLabel(pasteKey());
  }, []);

  const storePhotos = (next: string[]) => {
    photosRef.current = next;
    setPhotos(next);
    saveDraft({ ...loadDraft(), photos: next, photo: next[0] });
  };

  const addPhoto = useCallback((url: string) => {
    const cur = photosRef.current;
    if (cur.length >= MAX_PHOTOS) {
      setPhotoErr(`사진은 ${MAX_PHOTOS}장까지예요. 작은 사진의 ×를 눌러 하나를 뺀 뒤 넣어 주세요.`);
      return;
    }
    const next = [...cur, url];
    storePhotos(next);
    setSel(next.length - 1);
    setPhotoErr(null);
  }, []);

  function removePhoto(i: number) {
    const next = photosRef.current.filter((_, k) => k !== i);
    storePhotos(next);
    setPhotoErr(null);
    setSel((s) => Math.max(0, Math.min(s, next.length - 1)));
  }

  const readPhotoFile = useCallback(
    async (f: File | null | undefined, how?: string) => {
      if (!f) return;
      if (!f.type.startsWith("image/")) {
        setPhotoErr("사진 파일만 쓸 수 있어요.");
        return;
      }
      setPhotoErr(null);
      setBusy("사진 준비 중…");
      try {
        addPhoto(await fileToDataUrl(f, 1024));
        if (how) {
          setNote(how);
          setTimeout(() => setNote(null), 2500);
        }
      } catch {
        setPhotoErr("사진을 읽지 못했어요. 다른 사진으로 해 보세요.");
      } finally {
        setBusy(null);
      }
    },
    [addPhoto],
  );

  // Ctrl+V / ⌘+V 로 붙여넣기 (화면 ①에서만)
  useEffect(() => {
    if (step !== 1) return;
    const onPaste = (e: ClipboardEvent) => {
      const f = imageFromPaste(e.clipboardData);
      if (!f) return;
      e.preventDefault();
      void readPhotoFile(f, "📋 붙여 넣은 사진을 넣었어요");
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [step, readPhotoFile]);

  async function pasteFromButton() {
    const r = await readClipboardImage();
    if (r.file) await readPhotoFile(r.file, "📋 붙여 넣은 사진을 넣었어요");
    else if (r.message) setPhotoErr(r.message);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    void (async () => {
      for (const f of files.slice(0, MAX_PHOTOS - photosRef.current.length || 1)) await readPhotoFile(f);
    })();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    void readPhotoFile(e.dataTransfer.files?.[0]);
  }

  const obsDone = obs.leafShape && obs.leafVein && obs.stem;
  const aiBlocked = conn.ready && !conn.ai;

  async function askAI() {
    if (!photos.length) return;
    setErr(null);
    setChoices(null);
    setBusy(photos.length > 1 ? `AI가 사진 ${photos.length}장을 함께 살펴보는 중…` : "AI가 사진을 살펴보는 중…");
    try {
      const res = await api("/api/identify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images: photos, taxon: "plant" }),
      });
      if (!res.ok) throw await toApiError(res);
      const j = await res.json();
      setCands(j.candidates ?? []);
      setUncertain(Boolean(j.uncertain) || !(j.candidates ?? []).length);
      setIsMock(Boolean(j.mock));
      saveDraft({ photos, photo: photos[0], place, observation: obs, aiCandidates: j.candidates ?? [], aiUncertain: Boolean(j.uncertain) });
      setStep(2);
    } catch (e) {
      setErr(toErr(e, "AI 호출에 실패했어요"));
    } finally {
      setBusy(null);
    }
  }

  /** 후보(또는 이미 아는 이름)로 국립수목원 도감 검색 → 확인 화면 */
  async function confirm(c: CandidateLite) {
    setErr(null);
    setChoices(null);
    setBusy("국립수목원 도감에서 찾는 중…");
    setPicked(c);
    try {
      let items = await search(c.koreanName);
      // 0건이면 학명(속명 종소명)으로 한 번 더.
      // 속명만으로는 찾지 않는다 — 같은 무리의 다른 식물로 잘못 이어질 수 있어서. (같은 무리 식물은 /unlisted 에서 '다른 식물'로 보여 줌)
      const bi = sciBinomial(c.scientificName);
      if (items.length === 0 && bi) items = await search(bi);
      saveDraft({ ...loadDraft(), photos, photo: photos[0], place, observation: obs, chosen: c });
      if (items.length === 0) {
        goUnlisted(c);
        return;
      }
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

  /** 국립수목원 도감에 없는 식물 → AI 정보 + 미등록 안내 화면 */
  function goUnlisted(c: CandidateLite) {
    router.push(`/unlisted?name=${encodeURIComponent(c.koreanName)}&sci=${encodeURIComponent(c.scientificName ?? "")}`);
  }

  async function search(q: string): Promise<Summary[]> {
    const res = await api(`/api/plants/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw await toApiError(res);
    const j = await res.json();
    return j.items ?? [];
  }

  function morePhotos() {
    setPhotoErr(null);
    setStep(1);
    setErr(null);
    setChoices(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restart() {
    clearDraft();
    storePhotos([]);
    setSel(0);
    setCands([]);
    setChoices(null);
    setManual("");
    setErr(null);
    setStep(1);
  }

  const setupBanner = conn.ready && !conn.mock && (!conn.data || !conn.ai) && (
    <div className="card setup">
      <h2>👋 처음 오셨나요?</h2>
      <p className="small" style={{ margin: "0 0 10px" }}>
        {!conn.data && !conn.ai
          ? "사진으로 식물을 알아보려면 키 두 개(공공데이터포털 + AI)를 한 번 넣어야 해요. AI는 제미나이(무료 가능)·클로드·GPT 중에 골라요."
          : !conn.ai
            ? "사진을 보고 어떤 식물인지 알려 주는 AI 키가 아직 없어요. 제미나이·클로드·GPT 중 하나를 넣어 주세요."
            : "국립수목원 공식 정보를 불러올 공공데이터포털 키가 아직 없어요."}{" "}
        <strong>선생님께 받은 QR이 있으면 휴대폰 카메라로 찍기만 하면 돼요.</strong>
      </p>
      <Link href="/settings" className="btn btn-primary">⚙️ 키 넣으러 가기</Link>
    </div>
  );

  const main = photos[Math.min(sel, photos.length - 1)];

  /* ───────── 화면 ① ───────── */
  if (step === 1) {
    return (
      <>
        {setupBanner}
        {SITE.notice && <div className="card notice-card" role="note">📢 {SITE.notice}</div>}
        <Steps current={1} />
        <div className="card">
          <h2>① 어떤 식물일까? 사진을 넣어요</h2>
          <div
            className={`photo-box ${dragging ? "drag" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {main ? (
              <img src={main} alt="넣은 식물 사진" />
            ) : (
              <span className="photo-hint">
                {touch ? "잎과 식물 전체가 잘 보이게 찍어요" : <>사진을 찍거나, 여기로 끌어다 놓거나,<br /><strong>{keyLabel}</strong>로 캡처한 사진을 붙여 넣어요</>}
              </span>
            )}
          </div>

          {photos.length > 0 && (
            <div className="thumbs" aria-label="넣은 사진">
              {photos.map((p, i) => (
                <div key={i} className={`thumb ${i === sel ? "on" : ""}`}>
                  <img src={p} alt={`사진 ${i + 1}`} onClick={() => setSel(i)} />
                  <button type="button" className="x" aria-label={`사진 ${i + 1} 빼기`} onClick={() => removePhoto(i)}>×</button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && <div className="thumb add">+{MAX_PHOTOS - photos.length}장 더</div>}
            </div>
          )}

          <div className="row" style={{ marginTop: 10 }}>
            {touch ? (
              <>
                <label className="btn btn-primary file-btn" style={{ flex: 1 }}>
                  📷 {photos.length ? "한 장 더 찍기" : "사진 찍기"}
                  <input type="file" accept="image/*" capture="environment" onChange={onFile} />
                </label>
                <label className="btn file-btn" style={{ flex: 1 }}>
                  🖼️ 앨범에서
                  <input type="file" accept="image/*" multiple onChange={onFile} />
                </label>
              </>
            ) : (
              <>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setCamOpen(true)}>📷 {photos.length ? "웹캠으로 한 장 더" : "웹캠으로 찍기"}</button>
                <label className="btn file-btn" style={{ flex: 1 }}>
                  🖼️ 사진 파일 고르기
                  <input type="file" accept="image/*" multiple onChange={onFile} />
                </label>
              </>
            )}
          </div>
          <button className="btn btn-paste" style={{ marginTop: 8 }} onClick={pasteFromButton}>
            📋 복사한 사진 붙여넣기 {!touch && <span className="kbd">{keyLabel}</span>}
          </button>
          {note && <div className="alert ok" style={{ marginTop: 8, marginBottom: 0 }}>{note}</div>}
          {photoErr && <div className="alert err" role="alert" style={{ marginTop: 8, marginBottom: 0 }}>{photoErr}</div>}
          <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>
            💡 <strong>잎·꽃·열매를 가까이 찍은 사진</strong>을 더 넣으면 AI가 더 정확하게 알아봐요 (최대 {MAX_PHOTOS}장). 사진은 AI 식별에만 쓰고 서버에 저장하지 않아요.
          </p>
        </div>
        {camOpen && <CameraCapture onCapture={(url) => { addPhoto(url); setCamOpen(false); }} onClose={() => setCamOpen(false)} />}

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
          <p className="muted small" style={{ margin: "-4px 0 0" }}>낱말이 어려우면 그림을 보고 골라요. {touch ? "'❓ 그림으로 알아보기'를 누르면 크게 볼 수 있어요." : "마우스를 올리면 설명이 나와요."}</p>
          <TermChips group="leafShape" options={LEAF_SHAPES} value={obs.leafShape} onPick={(v) => setObs({ ...obs, leafShape: v })} />
          <TermChips group="leafVein" options={LEAF_VEINS} value={obs.leafVein} onPick={(v) => setObs({ ...obs, leafVein: v })} />
          <TermChips group="stem" options={STEMS} value={obs.stem} onPick={(v) => setObs({ ...obs, stem: v })} />
        </div>

        {err && <ErrorAlert {...err} />}
        {aiBlocked && (
          <ErrorAlert message="사진으로 어떤 식물인지 알아보려면 AI 키(제미나이·클로드·GPT 중 하나)가 필요해요. 설정에서 넣어 주세요." needsSettings />
        )}
        <button className="btn btn-ai" disabled={!photos.length || !obsDone || Boolean(busy) || aiBlocked} onClick={askAI}>
          {busy ?? `🤖 AI${conn.ready && conn.ai && !conn.mock ? `(${AI_NAME[conn.provider]})` : ""}에게 어떤 식물인지 물어보기`}
        </button>
        {(!photos.length || !obsDone) && (
          <p className="muted small" style={{ textAlign: "center", marginTop: 8 }}>
            {!photos.length ? "먼저 사진을 넣어 주세요" : "관찰 3가지를 모두 고르면 AI에게 물어볼 수 있어요"}
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
          <h2 style={{ margin: 0 }}>② AI의 추정</h2>
          <span className="badge ai">AI 추정 · 확정 아님</span>
        </div>
        {photos.length > 0 && (
          <div className="thumbs" style={{ marginTop: 10 }}>
            {photos.map((p, i) => <div key={i} className="thumb"><img src={p} alt={`사진 ${i + 1}`} /></div>)}
          </div>
        )}
        <p className="muted small" style={{ marginTop: 8 }}>
          내가 관찰한 것: {obs.leafShape} · {obs.leafVein} · {obs.stem} · {place}
        </p>
        {isMock && <div className="alert warn">연습 모드예요. 실제 AI가 아니라 연습용 답을 보여주고 있어요.</div>}
        {uncertain && (
          <div className="alert warn" style={{ marginBottom: 0 }}>
            AI도 확실하지 않대요. 이렇게 사진을 더 넣으면 도움이 돼요:
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              <li>잎 한 장을 화면 가득 가까이</li>
              <li>꽃이나 열매가 있으면 그 부분도</li>
              <li>밝은 곳에서, 흔들리지 않게</li>
            </ul>
          </div>
        )}
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

      {choices && (
        <div className="card">
          <h2>도감에 비슷한 이름이 여러 개예요. 어느 것일까요?</h2>
          {choices.map((s) => (
            <div className="cand" key={s.pilbkNo}>
              <div className="name">{s.koreanName}</div>
              <div className="sci">{s.scientificName} · {s.family}</div>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => { saveDraft({ ...loadDraft(), chosen: { koreanName: s.koreanName, scientificName: s.scientificName } }); router.push(`/plant/${encodeURIComponent(s.pilbkNo)}`); }}>이것이에요</button>
            </div>
          ))}
          {picked && (
            <button className="btn btn-ghost btn-sm" onClick={() => goUnlisted(picked)}>&lsquo;{picked.koreanName}&rsquo;이(가) 이 중에 없어요 → AI에게 알아보기</button>
          )}
        </div>
      )}

      {busy && <div className="alert ok">{busy}</div>}
      {err && <ErrorAlert {...err} />}

      <div className="card">
        <h2>후보 중에 맞는 게 없나요?</h2>
        <div className="row">
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={Boolean(busy)} onClick={morePhotos}>
            📷 사진 더 넣고 다시 묻기 {photos.length < MAX_PHOTOS ? `(${MAX_PHOTOS - photos.length}장 더)` : ""}
          </button>
          <button className="btn" style={{ flex: 1 }} disabled={Boolean(busy)} onClick={askAI}>🔄 AI에게 다시 묻기</button>
        </div>
        <details className="guide" style={{ marginTop: 12 }}>
          <summary>이미 이름을 알고 있어요</summary>
          <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (manual.trim()) void confirm({ koreanName: manual.trim(), scientificName: "" }); }}>
            <input className="input" style={{ flex: 1 }} placeholder="예: 은행나무" value={manual} onChange={(e) => setManual(e.target.value)} />
            <button className="btn btn-sm" disabled={!manual.trim() || Boolean(busy)}>도감에서 찾기</button>
          </form>
        </details>
      </div>

      <button className="btn btn-ghost" onClick={restart}>처음부터 새 식물 찾기</button>
    </>
  );
}
