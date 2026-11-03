"use client";
import { useState } from "react";
import DrawingPad from "./DrawingPad";
import { fileToDataUrl } from "@/lib/client/image";
import { MAX_DRAWINGS, type Drawing } from "@/lib/client/cards";

/**
 * ④ 기록의 '내가 관찰한 특징 그리기'
 * - 그림판에 직접 그리기 (내 사진 위에 표시하며 그릴 수도 있음)
 * - 종이에 그린 그림을 찍어(또는 파일로) 올리기 → 올린 그림 위에 글자·표시를 더할 수도 있음
 * - 그림마다 짧은 설명
 */
export default function ObservationDrawings({
  drawings,
  onChange,
  photo,
}: {
  drawings: Drawing[];
  onChange: (d: Drawing[]) => void;
  photo?: string;
}) {
  const [pad, setPad] = useState<{ index: number | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const full = drawings.length >= MAX_DRAWINGS;

  function saveFromPad(image: string) {
    if (pad?.index != null) {
      onChange(drawings.map((d, i) => (i === pad.index ? { ...d, image } : d)));
    } else {
      onChange([...drawings, { image, note: "", kind: "drawn" }]);
    }
    setPad(null);
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (full) return setErr(`그림은 ${MAX_DRAWINGS}장까지 넣을 수 있어요.`);
    try {
      const image = await fileToDataUrl(f, 1000, 0.75);
      onChange([...drawings, { image, note: "", kind: "photo" }]);
      setErr(null);
    } catch {
      setErr("사진을 읽지 못했어요. 다른 사진으로 해 보세요.");
    }
  }

  return (
    <div className="drawings-section">
      <h3>✏️ 내가 관찰한 특징 그리기</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        잎 모양, 잎맥, 가장자리, 꽃이나 열매처럼 <strong>내 눈으로 본 특징</strong>을 그려요. 종이에 그린 그림을 사진으로 찍어 올려도 돼요. (최대 {MAX_DRAWINGS}장)
      </p>

      {drawings.length > 0 && (
        <div className="drawings">
          {drawings.map((d, i) => (
            <div className="drawing" key={i}>
              <img src={d.image} alt={`관찰 그림 ${i + 1}`} onClick={() => setPad({ index: i })} />
              <textarea
                className="input"
                rows={2}
                value={d.note}
                onChange={(e) => onChange(drawings.map((x, k) => (k === i ? { ...x, note: e.target.value } : x)))}
                placeholder="그림 설명: 무엇을 그렸나요? (예: 잎 가장자리가 톱니처럼 생겼어요)"
              />
              <div className="row">
                <button className="btn btn-sm" type="button" onClick={() => setPad({ index: i })}>✏️ 고치기·표시하기</button>
                <button className="btn btn-sm btn-danger" type="button" onClick={() => onChange(drawings.filter((_, k) => k !== i))}>빼기</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!full && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" style={{ flex: 1 }} type="button" onClick={() => setPad({ index: null })}>🖌️ 그림 그리기</button>
          <label className="btn file-btn" style={{ flex: 1 }}>
            📷 종이 그림 올리기
            <input type="file" accept="image/*" onChange={upload} />
          </label>
        </div>
      )}
      {err && <div className="alert err" style={{ marginTop: 8 }}>{err}</div>}

      {pad && (
        <DrawingPad
          photo={photo}
          initial={pad.index != null ? drawings[pad.index]?.image : undefined}
          onSave={saveFromPad}
          onClose={() => setPad(null)}
        />
      )}
    </div>
  );
}
