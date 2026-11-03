import Link from "next/link";
import { SITE } from "@/lib/site";
import { CURRICULUM, GRADE_BANDS, GRADE_LABEL, describeMatch, standardsFor } from "@/lib/curriculum";

export const metadata = { title: `교육과정 연결표 · ${SITE.name}` };

/** 선생님용 교육과정 연결표 — 앱이 어떤 성취기준과, 언제, 어떻게 이어지는지 */
export default function CurriculumPage() {
  return (
    <>
      <div className="card">
        <h2>📚 교육과정 연결표</h2>
        <p className="small" style={{ margin: 0 }}>
          학생이 식물을 찍고 국립수목원 공식 정보를 확인하면, 아래 규칙에 따라 성취기준이 연결돼요. 연결은 AI가 아니라 정해진 규칙으로 계산하므로 같은 식물·같은 관찰이면 늘 같은 결과가 나와요. 국립수목원 도감에 없는 식물은 공식 정보가 없으므로 '찾은 장소'와 '내 관찰'로만 연결하고, 공식 정보 없이 할 수 있는 활동 문장을 보여 줘요.
        </p>
        <p className="muted small" style={{ marginBottom: 0 }}>기준: {CURRICULUM.basis}</p>
        <p className="muted small" style={{ marginBottom: 0 }}>{CURRICULUM.notice}</p>
        <p className="muted small" style={{ marginBottom: 0 }}>규칙·활동 문장은 <code className="inline">data/curriculum.json</code>에서 고칠 수 있어요.</p>
      </div>

      {GRADE_BANDS.map((g) => (
        <section key={g}>
          <h2 className="section-title">{GRADE_LABEL[g]}</h2>
          {standardsFor(g).map((s) => (
            <div className="card curri-card" key={s.code}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="curri-unit">{s.subject} · {s.domain}{s.unit !== s.domain ? ` · ${s.unit}` : ""}</span>
                <code className="inline">{s.code}</code>
              </div>
              <blockquote className="official-text">{s.officialText}</blockquote>
              <p className="small" style={{ margin: "0 0 8px" }}><strong>학생 화면 문장</strong> “{s.kidText}”</p>
              {s.commentary && <p className="small"><strong>성취기준 해설</strong><br />{s.commentary}</p>}
              {s.considerations.length > 0 && (
                <div className="small"><strong>적용 시 고려 사항</strong><ul>{s.considerations.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
              )}
              {s.inquiry.length > 0 && <p className="small"><strong>탐구 활동</strong> {s.inquiry.join(", ")}</p>}
              {s.note && <p className="small warn-text">{s.note}</p>}
              <div className="app-box small">
                <div><strong>언제 연결되나요</strong> {describeMatch(s.match).join(" 또는 ")}</div>
                <div><strong>학생 활동(앱 제안)</strong> {s.activity}</div>
                {s.activityUnlisted && <div><strong>국립수목원 도감에 없는 식물일 때</strong> {s.activityUnlisted}</div>}
                <div><strong>앱 활용</strong> {s.teacherNote}</div>
                {s.aiAvoid.length > 0 && <div><strong>AI 설명에서 다루지 않는 내용</strong> {s.aiAvoid.join(", ")}</div>}
              </div>
              <div className="source">출처: {s.source.title} {s.source.pages}쪽</div>
            </div>
          ))}
        </section>
      ))}

      <div className="card">
        <Link href="/teacher" className="link">← 선생님 화면으로</Link>
      </div>
    </>
  );
}
