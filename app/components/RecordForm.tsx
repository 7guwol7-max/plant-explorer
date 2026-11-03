"use client";
import { useState } from "react";
import ObservationDrawings from "./ObservationDrawings";
import { shrinkDataUrl } from "@/lib/client/image";
import type { Drawing } from "@/lib/client/cards";

export const DEFAULT_QUESTIONS = [
  "잎의 모양과 가장자리는 어떻게 생겼나요?",
  "줄기는 나무처럼 단단한가요, 풀처럼 부드러운가요?",
  "이 식물이 자라는 곳은 어떤 환경인가요? (햇빛, 물, 흙)",
];

export type Verified = "일치" | "불일치" | "모름";
export type RecordData = { verified: Verified; answers: { q: string; a: string }[]; newLearning: string; drawings: Drawing[] };

/**
 * ④ 나의 탐구 기록 — 공식 정보 화면과 '도감에 없는 식물' 화면이 함께 쓴다
 * 관찰 그림은 저장 전에 줄여서 넘긴다. 카드를 만들고 저장하는 일은 부모 화면이 한다.
 */
export default function RecordForm({
  matchQuestion,
  questions,
  questionsLabel,
  questionsHint,
  learningPlaceholder,
  photo,
  onSave,
}: {
  matchQuestion: string;
  questions: string[];
  questionsLabel: string;
  questionsHint?: string;
  learningPlaceholder: string;
  photo?: string;
  onSave: (r: RecordData) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [verified, setVerified] = useState<Verified>("모름");
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [newLearning, setNewLearning] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await onSave({
        verified,
        answers: questions.map((q, i) => ({ q, a: answers[i] ?? "" })),
        newLearning,
        drawings: await Promise.all(drawings.map(async (d) => ({ ...d, image: await shrinkDataUrl(d.image, 800, 0.72) }))),
      });
      if (!r.ok) setSaveMsg(r.message ?? "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2>④ 나의 탐구 기록</h2>

      <h3>{matchQuestion}</h3>
      <div className="chips">
        {(["일치", "불일치", "모름"] as const).map((v) => (
          <button key={v} className={`chip ${verified === v ? "on" : ""}`} onClick={() => setVerified(v)}>{v === "일치" ? "✅ 일치해요" : v === "불일치" ? "❌ 달라요" : "❓ 잘 모르겠어요"}</button>
        ))}
      </div>

      <ObservationDrawings drawings={drawings} onChange={setDrawings} photo={photo} />

      <h3>{questionsLabel}</h3>
      {questionsHint && <p className="muted small">{questionsHint}</p>}
      {questions.map((q, i) => (
        <label className="field" key={i}>
          <span>{i + 1}. {q}</span>
          <textarea className="input" rows={2} value={answers[i] ?? ""} onChange={(e) => { const a = [...answers]; a[i] = e.target.value; setAnswers(a); }} placeholder="실제로 관찰한 것을 써요" />
        </label>
      ))}

      <label className="field">
        <span>새롭게 알게 된 점</span>
        <textarea className="input" rows={3} value={newLearning} onChange={(e) => setNewLearning(e.target.value)} placeholder={learningPlaceholder} />
      </label>

      {saveMsg && <div className="alert err">{saveMsg}</div>}
      <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? "저장 중…" : "📒 나의 도감에 저장"}</button>
      <p className="muted small" style={{ textAlign: "center", marginTop: 8 }}>관찰 그림과 교과서 연결 활동에 적은 내용도 함께 저장돼요.</p>
    </div>
  );
}
