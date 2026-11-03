"use client";
import { useState } from "react";
import Link from "next/link";
import { FIELD_SHORT, SOURCE_NAME } from "@/lib/fields";
import { GRADE_BANDS, GRADE_LABEL, activityFor, activitySteps, type CurriculumLink, type GradeBand } from "@/lib/curriculum";
import type { Role } from "@/lib/client/prefs";
import MissionProgress from "./MissionProgress";

const SHOW_FIRST = 3;

/**
 * 📚 교과서와 연결하기
 * - 연결은 data/curriculum.json 규칙으로 계산한다 (AI 아님) → 같은 식물·같은 관찰이면 언제나 같은 결과
 * - 학생 보기: "우리 교과서에 이런 내용이 나와요" + 학생 말로 쓴 문장(kidText)
 * - 선생님 보기: 성취기준 코드 + 교육과정 원문 그대로 + 해설·출처
 * - 🎯 해 볼 활동: 눈에 잘 띄는 초록 상자. 문장을 번호 붙은 단계로 나누고, 적으면 '적었어요'로 바뀐다
 *   학생 보기에서는 '왜 이어질까요?'를 접어 두어 활동이 먼저 눈에 들어오게 한다
 * - unlisted: 국립수목원 도감에 없는 식물이면 공식 정보 없이 할 수 있는 활동 문장을 쓴다
 */
export default function CurriculumLinks({
  links,
  grade,
  role,
  onGrade,
  answers,
  onAnswer,
  unlisted = false,
}: {
  links: CurriculumLink[];
  grade: GradeBand;
  role: Role;
  onGrade: (g: GradeBand) => void;
  answers: Record<string, string>;
  onAnswer: (code: string, v: string) => void;
  unlisted?: boolean;
}) {
  const [more, setMore] = useState(false);
  const shown = more ? links : links.slice(0, SHOW_FIRST);
  const teacher = role === "teacher";
  const doneCount = links.filter((l) => (answers[l.standard.code] ?? "").trim()).length;

  return (
    <div className="card curri-card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>📚 교과서와 연결하기</h2>
        <span className="badge curri">{teacher ? "2022 개정 교육과정 · 선생님 보기" : `${GRADE_LABEL[grade]} 교과서`}</span>
      </div>
      <p className="muted small" style={{ margin: "6px 0 8px" }}>
        {teacher
          ? `이 식물 탐구와 이어지는 ${GRADE_LABEL[grade]} 성취기준이에요. 원문은 교육과정 그대로예요.`
          : `오늘 찾은 식물은 ${GRADE_LABEL[grade]} 교과서에서 배우는 내용과 이렇게 이어져요.`}
      </p>
      <div className="chips" style={{ marginBottom: 12 }}>
        {GRADE_BANDS.map((g) => (
          <button key={g} className={`chip ${grade === g ? "on" : ""}`} onClick={() => onGrade(g)}>{GRADE_LABEL[g]}</button>
        ))}
      </div>

      {links.length > 0 && <MissionProgress total={links.length} done={doneCount} />}

      {links.length === 0 && <p className="muted">이 학년에 연결할 내용을 찾지 못했어요.</p>}

      {shown.map(({ standard: s, reasons }, idx) => {
        const answer = answers[s.code] ?? "";
        const done = Boolean(answer.trim());
        const steps = activitySteps(activityFor(s, unlisted));
        return (
          <div className="curri" key={s.code}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="curri-unit">{s.subject} · {s.unit}</span>
              {teacher && <code className="inline">{s.code}</code>}
            </div>

            {teacher ? (
              <>
                <blockquote className="official-text">{s.officialText}</blockquote>
                <p className="small muted" style={{ margin: "0 0 8px" }}>학생 화면에는: “{s.kidText}”</p>
              </>
            ) : (
              <div className="kid-text">
                <span className="kid-label">📖 우리 교과서에 이런 내용이 나와요</span>
                <p>{s.kidText}</p>
              </div>
            )}

            <section className={`mission ${done ? "done" : ""}`} aria-label={`해 볼 활동 ${idx + 1}`}>
              <div className="mission-head">
                <span className="mission-title">🎯 해 볼 활동</span>
                <span className="mission-tag">{done ? "✅ 적었어요" : teacher ? "앱 제안 활동" : "해 봐요!"}</span>
              </div>
              <ol className="mission-steps">
                {steps.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
              <textarea
                className="input mission-input"
                rows={3}
                value={answer}
                onChange={(e) => onAnswer(s.code, e.target.value)}
                placeholder="✏️ 해 보고 알게 된 것을 여기에 적어요"
                aria-label="해 볼 활동에 적기"
              />
              {s.code === "[4과03-01]" && <Link href="/my?view=sort" className="btn btn-sm mission-link">🗂️ 나의 도감에서 분류해 보기 →</Link>}
            </section>

            <details className="why small" open={teacher}>
              <summary>🔗 {teacher ? "이어지는 까닭" : "왜 이 식물과 이어질까요?"}</summary>
              <ul>
                {reasons.map((r, i) => (
                  <li key={i}>
                    {r.text}
                    {r.evidence && (
                      <div className="evidence">
                        “{r.evidence.sentence}”
                        <span className="muted"> — {SOURCE_NAME} ‘{FIELD_SHORT[r.evidence.field] ?? r.evidence.field}’</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </details>

            {teacher && (
              <details className="teacher-note">
                <summary>성취기준 해설 · 출처</summary>
                {s.commentary && <p><strong>성취기준 해설</strong><br />{s.commentary}</p>}
                {s.considerations.length > 0 && (
                  <div><strong>적용 시 고려 사항</strong><ul>{s.considerations.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
                )}
                {s.inquiry.length > 0 && <p><strong>탐구 활동</strong> {s.inquiry.join(", ")}</p>}
                {s.note && <p className="warn-text">{s.note}</p>}
                <p className="muted">출처: {s.source.title} {s.source.pages}쪽 · 앱 활용: {s.teacherNote}</p>
              </details>
            )}
          </div>
        );
      })}

      {links.length > SHOW_FIRST && (
        <button className="btn btn-ghost btn-sm" onClick={() => setMore((v) => !v)}>
          {more ? "접기" : `활동 ${links.length - SHOW_FIRST}개 더 보기`}
        </button>
      )}
      {teacher && (
        <div className="source">성취기준 문장은 교육과정 원문 그대로예요. 활동은 앱이 제안하는 것이에요. <Link href="/curriculum" className="link">전체 연결표 보기</Link></div>
      )}
    </div>
  );
}
