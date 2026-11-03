/**
 * 교육과정 연결 (순수 함수 — 화면과 서버가 함께 쓴다)
 * ─────────────────────────────────────────────
 * data/curriculum.json 의 성취기준마다 "언제 연결할지(match)"가 적혀 있다.
 * 학년군 + 국립수목원 공식 정보 + 학생의 장소·관찰을 넣으면
 * 연결되는 성취기준과 그 까닭(근거 문장)을 우선순위대로 돌려준다.
 * 같은 입력이면 언제나 같은 결과가 나온다 (AI를 쓰지 않음).
 */
import raw from "@/data/curriculum.json";
import { SETTINGS } from "./settings";
import { OFFICIAL_FIELDS, FIELD_SHORT } from "./fields";

export type GradeBand = "1-2" | "3-4" | "5-6";
export const GRADE_BANDS: GradeBand[] = ["1-2", "3-4", "5-6"];
export const GRADE_LABEL: Record<GradeBand, string> = { "1-2": "1~2학년", "3-4": "3~4학년", "5-6": "5~6학년" };
/** 처음 학년 — app-settings.json 의 defaultGrade */
export const DEFAULT_GRADE: GradeBand = SETTINGS.defaultGrade;

export const isGradeBand = (v: unknown): v is GradeBand =>
  typeof v === "string" && (GRADE_BANDS as string[]).includes(v);

export type Match = {
  always?: boolean;
  fields?: string[];   // 공식 정보에 이 항목이 비어 있지 않으면
  keywords?: string[]; // 공식 정보 어딘가에 이 낱말이 나오면
  places?: string[];   // 학생이 고른 '찾은 장소'가 이 중 하나면
  stems?: string[];    // 학생이 고른 '줄기' 관찰이 이 중 하나면
};

export type Standard = {
  code: string;
  subject: string;
  gradeBand: GradeBand;
  domain: string;
  unit: string;
  officialText: string;          // 교육과정 원문 (수정 금지) — 선생님 보기
  kidText: string;               // 학생 보기: 같은 내용을 학생 말로 (앱이 쓴 문장)
  commentary: string | null;     // 성취기준 해설 원문
  considerations: string[];      // 성취기준 적용 시 고려 사항 원문
  inquiry: string[];             // 별책 탐구 활동 이름
  source: { title: string; pages: string };
  note?: string;
  activity: string;              // 앱이 제안하는 학생 활동
  activityUnlisted?: string;     // 국립수목원 도감에 없는 식물일 때 쓰는 활동 ('공식 정보'를 찾으라고 하지 않는다)
  teacherNote: string;           // 앱이 이 성취기준을 어떻게 돕는지
  aiAvoid: string[];             // AI 설명에서 다루지 않을 내용 (해설 근거)
  match: Match;
  priority: number;              // 작을수록 먼저
};

export type CurriculumData = { basis: string; notice: string; standards: Standard[] };

/* ───────── 선생님이 더하거나 고친 성취기준 (app-settings.json 의 curriculum) ───────── */
const isStr = (v: unknown): v is string => typeof v === "string";
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr) : []);
const matchOf = (v: unknown): Match => {
  const m = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: Match = {};
  if (m.always === true) out.always = true;
  for (const k of ["fields", "keywords", "places", "stems"] as const) {
    const list = strList(m[k]);
    if (list.length) out[k] = list;
  }
  return out;
};

/**
 * 추가 파일의 항목 하나를 앱이 쓰는 모양으로 다듬는다.
 * - 같은 코드가 기본 자료에 있으면(prev) 적어 준 칸만 바꾼다 → 활동·학생 문장만 우리 반에 맞게 바꿀 수 있다
 * - 새 성취기준이면 code·gradeBand·officialText 가 꼭 있어야 하고, 빠진 칸은 기본값으로 채운다
 * - 모양이 틀린 항목은 앱이 멈추지 않도록 건너뛴다 (null)
 */
export function normalizeExtra(e: unknown, prev?: Standard): Standard | null {
  if (!e || typeof e !== "object") return null;
  const x = e as Record<string, unknown>;
  if (!isStr(x.code) || !/^\[.+\]$/.test(x.code.trim())) return null;
  const code = x.code.trim();
  const pick = (k: string, fallback: string) => (isStr(x[k]) && (x[k] as string).trim() ? (x[k] as string).trim() : fallback);
  const pickList = (k: string, fallback: string[]) => (Array.isArray(x[k]) ? strList(x[k]) : fallback);

  if (prev) {
    return {
      ...prev,
      kidText: pick("kidText", prev.kidText),
      activity: pick("activity", prev.activity),
      activityUnlisted: pick("activityUnlisted", prev.activityUnlisted ?? ""),
      teacherNote: pick("teacherNote", prev.teacherNote),
      aiAvoid: pickList("aiAvoid", prev.aiAvoid),
      match: x.match ? matchOf(x.match) : prev.match,
      priority: typeof x.priority === "number" ? x.priority : prev.priority,
    };
  }

  if (!isGradeBand(x.gradeBand) || !pick("officialText", "")) return null;
  const officialText = pick("officialText", "");
  const subject = pick("subject", "");
  const domain = pick("domain", "");
  const src = (x.source && typeof x.source === "object" ? x.source : {}) as Record<string, unknown>;
  const match = matchOf(x.match);
  return {
    code,
    subject,
    gradeBand: x.gradeBand,
    domain,
    unit: pick("unit", domain || subject),
    officialText,
    kidText: pick("kidText", officialText),
    commentary: isStr(x.commentary) && x.commentary.trim() ? x.commentary.trim() : null,
    considerations: strList(x.considerations),
    inquiry: strList(x.inquiry),
    source: { title: isStr(src.title) ? src.title : "", pages: isStr(src.pages) ? src.pages : "" },
    note: isStr(x.note) ? x.note : undefined,
    activity: pick("activity", "오늘 관찰한 식물과 이 내용을 이어서, 알게 된 것을 한 가지 적어 보세요."),
    activityUnlisted: pick("activityUnlisted", "") || undefined,
    teacherNote: pick("teacherNote", ""),
    aiAvoid: strList(x.aiAvoid),
    match: Object.keys(match).length ? match : { always: true }, // 조건을 안 적으면 그 학년 모든 식물에 연결
    priority: typeof x.priority === "number" ? x.priority : 5,
  };
}

/** 기본 자료 + 추가 파일 (같은 코드는 추가 파일이 이긴다) */
export function mergeStandards(base: Standard[], extra: unknown): Standard[] {
  const byCode = new Map(base.map((s) => [s.code, s] as const));
  for (const e of Array.isArray(extra) ? extra : []) {
    const code = e && typeof e === "object" && isStr((e as { code?: unknown }).code) ? (e as { code: string }).code.trim() : "";
    const s = normalizeExtra(e, byCode.get(code));
    if (s) byCode.set(s.code, s);
  }
  return [...byCode.values()];
}

const base = raw as CurriculumData;
export const CURRICULUM: CurriculumData = { ...base, standards: mergeStandards(base.standards, SETTINGS.curriculum) };

export function getStandard(code: string): Standard | undefined {
  return CURRICULUM.standards.find((s) => s.code === code);
}

export function standardsFor(grade: GradeBand): Standard[] {
  return CURRICULUM.standards.filter((s) => s.gradeBand === grade).sort((a, b) => a.priority - b.priority);
}

/** 상황에 맞는 활동 문장 (도감에 없는 식물이면 공식 정보 없이 할 수 있는 활동) */
export const activityFor = (s: Standard, unlisted = false) => (unlisted && s.activityUnlisted) || s.activity;

/**
 * 활동 문장을 '한 번에 하나씩' 해 볼 단계로 나눈다 (문장 끝 . ? ! 기준)
 * - 괄호 안의 물음표·마침표에서는 나누지 않는다
 * - 괄호로만 된 조각(예: …)은 앞 단계에 붙인다
 * (옛 iOS 사파리에서도 돌도록 정규식 뒤돌아보기를 쓰지 않는다)
 */
export function activitySteps(text: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    cur += ch;
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth = Math.max(0, depth - 1);
      if (depth === 0 && cur.trim().startsWith("(")) {
        parts.push(cur.trim());
        cur = "";
      }
    } else if (depth === 0 && /[.?!]/.test(ch) && (i + 1 === text.length || /\s/.test(text[i + 1]))) {
      parts.push(cur.trim());
      cur = "";
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  const out: string[] = [];
  for (const p of parts) {
    if (p.startsWith("(") && out.length) out[out.length - 1] += ` ${p}`;
    else out.push(p);
  }
  return out;
}

/* ───────── 연결 계산 ───────── */
export type LinkReason = {
  kind: "always" | "field" | "keyword" | "place" | "stem";
  text: string;
  evidence?: { field: string; sentence: string }; // 국립수목원 원문 한 문장 (그대로)
};

export type CurriculumLink = { standard: Standard; reasons: LinkReason[] };

export type LinkInput = {
  gradeBand: GradeBand;
  official?: Record<string, unknown> | null;
  place?: string;
  observation?: { leafShape?: string; leafVein?: string; stem?: string } | null;
};

const MAX_REASONS = 3;

/** 낱말 끝 글자에 받침이 있는지 (조사 고르기용) */
function batchim(word: string): number {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  return c >= 0 && c <= 11171 ? c % 28 : -1; // 0: 받침 없음, 8: ㄹ 받침, -1: 한글 아님
}
const iraneun = (w: string) => (batchim(w) > 0 ? "이라는" : "라는");
const euro = (w: string) => (batchim(w) > 0 && batchim(w) !== 8 ? "으로" : "로");

/** 낱말이 들어 있는 문장 하나를 원문 그대로 잘라 온다 (마침표 기준) */
export function findSentence(text: string, keyword: string): string {
  const i = text.indexOf(keyword);
  if (i < 0) return "";
  const before = text.lastIndexOf(".", i - 1);
  const start = before < 0 ? 0 : before + 1;
  const after = text.indexOf(".", i + keyword.length);
  const end = after < 0 ? text.length : after + 1;
  return text.slice(start, end).trim();
}

/** 첫 문장 (항목이 있다는 근거로 보여 줄 때) */
function firstSentence(text: string): string {
  const dot = text.indexOf(".");
  return (dot < 0 ? text : text.slice(0, dot + 1)).trim();
}

const textOf = (official: LinkInput["official"], key: string): string => {
  const v = official?.[key];
  return typeof v === "string" ? v.trim() : "";
};

export function reasonsFor(s: Standard, input: LinkInput): LinkReason[] {
  const m = s.match;
  const out: LinkReason[] = [];

  if (m.always) out.push({ kind: "always", text: "어떤 식물을 관찰해도 이어지는 배움이에요" });

  for (const f of m.fields ?? []) {
    const t = textOf(input.official, f);
    if (t) {
      out.push({
        kind: "field",
        text: `공식 정보에 '${FIELD_SHORT[f] ?? f}' 내용이 있어요`,
        evidence: { field: f, sentence: firstSentence(t) },
      });
    }
  }

  if (m.keywords?.length) {
    // 항목 순서대로 훑어 처음 나온 낱말 하나만 근거로 쓴다
    outer: for (const [f] of OFFICIAL_FIELDS) {
      const t = textOf(input.official, f);
      if (!t) continue;
      for (const kw of m.keywords) {
        if (t.includes(kw)) {
          out.push({
            kind: "keyword",
            text: `공식 정보 '${FIELD_SHORT[f] ?? f}'에 '${kw}'${iraneun(kw)} 말이 나와요`,
            evidence: { field: f, sentence: findSentence(t, kw) },
          });
          break outer;
        }
      }
    }
  }

  if (input.place && m.places?.includes(input.place)) {
    out.push({ kind: "place", text: `'${input.place}'에서 찾았어요` });
  }

  const stem = input.observation?.stem;
  if (stem && m.stems?.includes(stem)) {
    out.push({ kind: "stem", text: `내 관찰에서 줄기를 '${stem}'${euro(stem)} 골랐어요` });
  }

  // 같은 근거 문장이 두 번 나오지 않게
  const seen = new Set<string>();
  return out
    .filter((r) => {
      const k = r.evidence ? `${r.evidence.field}|${r.evidence.sentence}` : `${r.kind}|${r.text}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, MAX_REASONS);
}

export function linkCurriculum(input: LinkInput, standards: Standard[] = CURRICULUM.standards): CurriculumLink[] {
  return standards
    .filter((s) => s.gradeBand === input.gradeBand)
    .map((standard) => ({ standard, reasons: reasonsFor(standard, input) }))
    .filter((l) => l.reasons.length > 0)
    .sort((a, b) => a.standard.priority - b.standard.priority || b.reasons.length - a.reasons.length);
}

/** 교사용 표에 쓰는 '언제 연결되나요' 설명 */
export function describeMatch(m: Match): string[] {
  const out: string[] = [];
  if (m.always) out.push("모든 관찰 카드");
  if (m.fields?.length) out.push(`공식 정보에 ${m.fields.map((f) => `'${FIELD_SHORT[f] ?? f}'`).join(", ")} 항목이 있을 때`);
  if (m.keywords?.length) out.push(`공식 정보에 ${m.keywords.slice(0, 6).map((k) => `'${k}'`).join(", ")}${m.keywords.length > 6 ? " 등" : ""}이 나올 때`);
  if (m.places?.length) out.push(`찾은 장소가 ${m.places.map((p) => `'${p}'`).join(", ")}일 때`);
  if (m.stems?.length) out.push(`줄기 관찰이 ${m.stems.map((p) => `'${p}'`).join(", ")}일 때`);
  return out;
}
