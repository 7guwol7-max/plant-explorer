/**
 * AI에게 시키는 일 (공급자와 상관없이 같은 프롬프트·스키마)
 * - identify: 사진(최대 3장) → 식물 후보
 * - explain : 국립수목원 공식 정보 → 학년 눈높이 풀이 (소개·주제별·항목별·낱말 풀이·질문)
 * - unlisted: 국립수목원 도감에 없는 식물 → AI가 아는 정보 + 도감에 실렸을 수 있는 다른 이름
 * - checkAi : 연결 확인
 * MOCK=1 이면 외부 호출 없이 고정 응답
 */
import { isMock } from "../keys";
import type { Standard, GradeBand } from "../../curriculum";
import { GRADE_LABEL } from "../../curriculum";
import { OFFICIAL_FIELDS } from "../../fields";
import type { InlineImage } from "../images";
import { generateJSON, type AiTarget } from "./index";
import type { JsonSchema } from "./types";

const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const str: JsonSchema = { type: "string" };
const strArr: JsonSchema = { type: "array", items: str };

/* ───────── 사진 식별 ───────── */
export type Candidate = { koreanName: string; scientificName: string; confidence: "높음" | "중간" | "낮음"; evidence: string };
export type IdentifyResult = { candidates: Candidate[]; uncertain: boolean; mock?: boolean; model?: string };

export const IDENTIFY_SCHEMA = obj({
  candidates: {
    type: "array",
    items: obj({
      koreanName: str,
      scientificName: str,
      confidence: { type: "string", enum: ["높음", "중간", "낮음"] },
      evidence: str,
    }),
  },
  uncertain: { type: "boolean" },
});

export function identifyPrompt(count: number): string {
  const many = count > 1 ? `\n사진 ${count}장은 모두 같은 식물을 여러 방향에서 찍은 것입니다(전체 모습, 잎, 꽃이나 열매 등). 모든 사진을 함께 보고 판단하세요.` : "";
  return `당신은 초등학생의 과학 탐구를 돕는 식물 식별 도우미입니다.
사진 속 식물을 보고 한국에서 볼 수 있는 식물 후보를 최대 3개 제시하세요.${many}
- koreanName: 국립수목원 국가표준 국명(예: 은행나무, 소나무, 서양민들레)
- scientificName: 학명(속명 종소명, 명명자 제외)
- confidence: 높음/중간/낮음
- evidence: 사진에서 실제로 보이는 근거를 초등학생이 확인할 수 있는 말로 (잎 모양, 잎맥, 줄기, 꽃, 열매 등)
사진이 흐리거나 식물이 아니거나 판단이 어려우면 uncertain을 true로 하고 후보는 "낮음"으로만 표시하세요. 추측으로 확신하지 마세요.`;
}

export async function identify(images: InlineImage[], target: AiTarget): Promise<IdentifyResult> {
  if (isMock()) {
    return {
      mock: true,
      uncertain: false,
      candidates: [
        { koreanName: "은행나무", scientificName: "Ginkgo biloba", confidence: "높음", evidence: "[모의] 부채 모양 잎, 가운데가 갈라진 잎 가장자리" },
        { koreanName: "단풍나무", scientificName: "Acer palmatum", confidence: "낮음", evidence: "[모의] 손바닥 모양으로 갈라진 잎일 가능성" },
        // 연습 모드에서 '국립수목원 도감에 없는 식물' 흐름을 해 볼 수 있게 넣은 후보
        { koreanName: "페튜니아", scientificName: "Petunia × atkinsiana", confidence: "낮음", evidence: "[모의] 나팔 모양 꽃 · 연습용: 국립수목원 도감에 없는 원예 식물" },
      ],
    };
  }
  const { json, model } = await generateJSON(target, { prompt: identifyPrompt(images.length), images, schema: IDENTIFY_SCHEMA, effort: "low" });
  return { ...(json as IdentifyResult), model };
}

/* ───────── 학년 눈높이 풀이 ───────── */
export type ExplainResult = {
  kidSummary: string;
  sections: { title: string; text: string }[];
  fieldsEasy: { field: string; easy: string }[];
  glossary: { term: string; meaning: string }[];
  observeQuestions: string[];
  compareHint: string;
  wonder: string;
  mock?: boolean;
  model?: string;
};

const FIELD_KEYS = OFFICIAL_FIELDS.map(([k]) => k as string);

export const EXPLAIN_SCHEMA = obj({
  kidSummary: str,
  sections: { type: "array", items: obj({ title: str, text: str }) },
  fieldsEasy: { type: "array", items: obj({ field: { type: "string", enum: FIELD_KEYS }, easy: str }) },
  glossary: { type: "array", items: obj({ term: str, meaning: str }) },
  observeQuestions: strArr,
  compareHint: str,
  wonder: str,
});

/** 학년별 글쓰기 기준 */
export const GRADE_STYLE: Record<GradeBand, string> = {
  "1-2": "초등 1~2학년이 혼자 읽을 수 있게 써요. 한 문장은 짧게(20자 안팎), 일상에서 쓰는 쉬운 낱말만 쓰고, 어려운 낱말은 쉬운 말로 바꿔요. 크기나 모양은 '손바닥만 해요', '부채처럼 생겼어요'처럼 친숙한 것에 빗대요.",
  "3-4": "초등 3~4학년 과학 교과서 수준으로 써요. 잎·줄기·뿌리·꽃·열매·잎맥 같은 교과서 낱말은 써도 되지만, 한자어 식물 용어(예: 피침형, 거치, 엽병, 교목, 우상복엽)는 쉬운 말로 바꾸거나 괄호 안에 풀이를 붙여요. 한 문장에 내용 하나씩.",
  "5-6": "초등 5~6학년 수준으로 써요. 뿌리·줄기·잎·꽃·열매 같은 기관 이름과 광합성, 증산 작용 같은 교과서 낱말을 쓸 수 있어요. 원문의 전문 용어는 그대로 쓰되 처음 나올 때 괄호 안에 쉬운 풀이를 붙여요. 까닭(왜 그런지)이 원문에 있으면 함께 풀어 줘요.",
};

/** 연결된 성취기준과 해설에 따라 '다루지 않는 내용'을 프롬프트에 붙인다 */
export function curriculumBlock(standards: Standard[]): string {
  if (!standards.length) return "";
  const lines = standards.map((s) => `- ${s.code} ${s.officialText}`).join("\n");
  const avoid = [...new Set(standards.flatMap((s) => s.aiAvoid))];
  return `- 관찰 질문과 더 궁금한 점은 아래 교육과정 성취기준의 탐구로 이어지게 만들 것 (성취기준 코드나 '성취기준'이라는 말은 쓰지 말 것):
${lines}
${avoid.length ? `- 이 학년에서 다루지 않는 내용이므로 쓰지 말 것: ${avoid.join(", ")}\n` : ""}`;
}

export function explainPrompt(official: Record<string, string>, grade: GradeBand, standards: Standard[]): string {
  const meaning = OFFICIAL_FIELDS.filter(([k]) => official[k]).map(([k, , s]) => `${k}=${s}`).join(", ");
  return `당신은 초등학생에게 식물을 설명하는 과학 선생님입니다. 아래는 국립수목원 식물도감의 공식 정보(JSON)입니다.
이 원문에 있는 사실만 사용해 초등 ${GRADE_LABEL[grade]} 학생 눈높이로 풀어 주세요.
글쓰기 수준: ${GRADE_STYLE[grade]}
공통 규칙:
- 원문에 없는 사실(색, 크기, 쓰임, 사는 곳, 숫자 등)은 절대 지어내지 말 것. 확실하지 않으면 쓰지 말 것.
- 학생에게 말하듯 '~해요'체로 쓸 것.
항목별 작성법:
- kidSummary: 이 식물을 처음 만나는 학생에게 들려주는 소개 4~6문장.
- sections: 원문에 근거가 있는 주제만, 제목은 "생김새", "사는 곳", "특별한 점", "우리 생활과 함께", "지키는 방법" 중에서 골라 각 2~4문장.
- fieldsEasy: 공식 정보의 각 항목(${meaning})마다, 그 항목 원문을 학년 눈높이로 바꿔 쓴 글. 원문에 있는 항목만 쓰고, 원문 내용을 빠뜨리지 말고 문장마다 쉽게 풀 것.
- glossary: 원문에 나온 어려운 낱말 3~8개와 학년에 맞는 뜻풀이(예: 교목 → 키가 크고 줄기가 굵은 나무). 원문에 없는 낱말은 넣지 말 것.
- observeQuestions: 학생이 지금 눈앞의 실제 식물을 보고 확인할 수 있는 관찰 질문 3개 (잎, 줄기, 꽃, 열매, 자라는 환경 중심).
- compareHint: 원문의 '유사종' 정보가 있으면 그것과 구별하는 관찰 포인트 1~2문장, 없으면 "비슷한 식물과 잎 모양·잎맥·줄기를 비교해 보세요."
- wonder: 이 식물에 대해 관찰·실험·조사로 더 알아볼 수 있는 탐구 질문 1개.
${curriculumBlock(standards)}공식 정보:
${JSON.stringify(official, null, 0)}`;
}

export async function explain(official: Record<string, string>, grade: GradeBand, target: AiTarget, standards: Standard[] = []): Promise<ExplainResult> {
  if (isMock()) {
    return {
      mock: true,
      kidSummary: "[모의] 이 식물은 잎이 부채처럼 생긴 나무예요. 가을이 되면 잎이 노랗게 물들어요. 암나무와 수나무가 따로 있어요. 햇빛이 잘 드는 곳에서 잘 자라요.",
      sections: [
        { title: "생김새", text: "[모의] 잎은 부채 모양이고 가운데가 살짝 갈라져 있어요. 잎맥은 부챗살처럼 퍼져요." },
        { title: "사는 곳", text: "[모의] 햇빛이 잘 드는 곳을 좋아해요. 길가에 가로수로 많이 심어요." },
        { title: "특별한 점", text: "[모의] 암나무에만 열매가 달려요." },
      ],
      fieldsEasy: Object.keys(official)
        .filter((k) => FIELD_KEYS.includes(k))
        .map((k) => ({ field: k, easy: `[모의] '${official[k].slice(0, 20)}…'를 ${GRADE_LABEL[grade]} 눈높이로 풀어 쓴 글이에요.` })),
      glossary: [
        { term: "가로수", meaning: "[모의] 길을 따라 줄지어 심은 나무" },
        { term: "잎맥", meaning: "[모의] 잎에 있는 가는 줄. 물과 양분이 지나가는 길" },
      ],
      observeQuestions: [
        "잎의 가장자리가 어떻게 생겼나요? 매끈한가요, 갈라져 있나요?",
        "잎맥이 어떤 모양으로 뻗어 있나요?",
        "이 식물이 자라는 곳은 햇빛이 잘 드나요?",
      ],
      compareHint: "[모의] 비슷하게 생긴 식물과 잎 모양, 잎맥, 줄기를 비교해 보세요.",
      wonder: "[모의] 햇빛이 잘 드는 곳과 그늘진 곳의 은행나무 잎은 크기가 다를까요?",
    };
  }
  const { json, model } = await generateJSON(target, { prompt: explainPrompt(official, grade, standards), schema: EXPLAIN_SCHEMA, effort: "low" });
  const r = json as ExplainResult;
  // 원문에 없는 항목의 풀이는 버린다 (지어내기 방지)
  r.fieldsEasy = (r.fieldsEasy ?? []).filter((f) => official[f.field]);
  return { ...r, model };
}

/* ───────── 국립수목원 도감에 없는 식물 ───────── */
export type UnlistedInfo = {
  known: boolean;
  koreanName: string;
  scientificName: string;
  otherNames: string[];
  whyNotListed: string;
  kidSummary: string;
  sections: { title: string; text: string }[];
  glossary: { term: string; meaning: string }[];
  observeQuestions: string[];
  wonder: string;
  mock?: boolean;
  model?: string;
};

export const UNLISTED_SECTIONS = ["생김새", "사는 곳", "특별한 점", "기르는 방법", "조심할 점"];

export const UNLISTED_SCHEMA = obj({
  known: { type: "boolean" },
  koreanName: str,
  scientificName: str,
  otherNames: strArr,
  whyNotListed: str,
  kidSummary: str,
  sections: { type: "array", items: obj({ title: { type: "string", enum: UNLISTED_SECTIONS }, text: str }) },
  glossary: { type: "array", items: obj({ term: str, meaning: str }) },
  observeQuestions: strArr,
  wonder: str,
});

export function unlistedPrompt(name: string, sci: string, grade: GradeBand, standards: Standard[]): string {
  return `당신은 초등학생에게 식물을 설명하는 과학 선생님입니다.
학생이 찾은 식물 '${name}'${sci ? `(학명: ${sci})` : ""}은(는) 국립수목원 식물도감에서 검색되지 않았습니다. 그래서 공식 원문이 없습니다.
식물학적으로 널리 확인된 사실만 사용해 초등 ${GRADE_LABEL[grade]} 학생 눈높이로 알려 주세요.
글쓰기 수준: ${GRADE_STYLE[grade]}
공통 규칙:
- 확실하지 않은 사실(정확한 크기·숫자·꽃 피는 달·원산지 등)은 지어내지 말 것. 모르면 쓰지 말 것.
- 먹을 수 있다거나 약이 된다는 내용은 쓰지 말 것. 독이 있거나 가시·즙이 해로운 식물이면 '조심할 점'에 '만지거나 입에 넣지 말고 선생님께 알려요'처럼 안전 안내만 쓸 것.
- 학생에게 말하듯 '~해요'체로 쓸 것. '국립수목원에 있다/없다'는 판단은 쓰지 말 것(앱이 따로 확인함).
항목별 작성법:
- known: 이 이름(또는 학명)의 식물을 확실히 알면 true. 처음 듣는 이름이거나 실제 식물 이름인지 확실하지 않으면 false로 하고, 나머지 글 항목은 빈 값으로 둘 것.
- koreanName: 우리나라에서 쓰는 이 식물의 바른 이름(국명). scientificName: 학명(속명 종소명, 명명자 제외).
- otherNames: 국립수목원(국가표준식물목록)에 다른 이름으로 실려 있을 수 있는 같은 식물의 국명이나 학명 0~4개(정식 국명, 예전 학명, 띄어쓰기가 다른 이름 등). 다른 식물의 이름은 넣지 말 것.
- whyNotListed: 국립수목원 식물도감에서 찾지 못한 까닭을 짐작해 1~2문장 (예: 꽃집에서 파는 원예 품종이에요, 외국에서 들여와 기르는 식물이에요, 다른 이름으로 실려 있을 수 있어요). '~일 수 있어요'처럼 짐작임을 드러낼 것.
- kidSummary: 이 식물을 처음 만나는 학생에게 들려주는 소개 3~5문장.
- sections: 확실히 아는 주제만, 제목은 "생김새", "사는 곳", "특별한 점", "기르는 방법", "조심할 점" 중에서 골라 각 2~3문장.
- glossary: 위 글에 나온 어려운 낱말 0~6개와 학년에 맞는 뜻풀이.
- observeQuestions: 학생이 지금 눈앞의 실제 식물을 보고 확인할 수 있는 관찰 질문 3개 (잎, 줄기, 꽃, 열매, 자라는 환경 중심).
- wonder: 관찰·실험·조사로 더 알아볼 수 있는 탐구 질문 1개.
${curriculumBlock(standards)}`;
}

/** AI 응답을 화면에 보내기 전에 다듬는다 (개수·길이 제한, 알 수 없는 식물이면 글을 비운다) */
export function tidyUnlisted(r: UnlistedInfo, name: string, sci: string): UnlistedInfo {
  const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");
  const known = Boolean(r?.known);
  const otherNames = [...new Set((Array.isArray(r?.otherNames) ? r.otherNames : []).map((x) => clip(x, 60)).filter(Boolean))].slice(0, 4);
  const base = { known, koreanName: clip(r?.koreanName, 40) || name, scientificName: clip(r?.scientificName, 80) || sci, otherNames };
  if (!known) return { ...base, whyNotListed: "", kidSummary: "", sections: [], glossary: [], observeQuestions: [], wonder: "" };
  return {
    ...base,
    whyNotListed: clip(r.whyNotListed, 300),
    kidSummary: clip(r.kidSummary, 800),
    sections: (r.sections ?? []).filter((x) => UNLISTED_SECTIONS.includes(x?.title) && clip(x.text, 600)).slice(0, 5),
    glossary: (r.glossary ?? []).filter((g) => clip(g?.term, 30) && clip(g?.meaning, 200)).slice(0, 6),
    observeQuestions: (r.observeQuestions ?? []).map((q) => clip(q, 200)).filter(Boolean).slice(0, 3),
    wonder: clip(r.wonder, 300),
  };
}

export async function aboutUnlisted(name: string, sci: string, grade: GradeBand, target: AiTarget, standards: Standard[] = []): Promise<UnlistedInfo> {
  if (isMock()) {
    return {
      mock: true,
      known: true,
      koreanName: name,
      scientificName: sci,
      otherNames: [],
      whyNotListed: "[모의] 꽃집에서 파는 원예 식물이라 국립수목원 식물도감에는 실려 있지 않을 수 있어요.",
      kidSummary: `[모의] 이 식물은 화단이나 화분에 많이 심는 꽃이에요. 꽃이 나팔처럼 생겼어요. 햇빛을 좋아해요. 이 글은 연습용이에요.`,
      sections: [
        { title: "생김새", text: "[모의] 꽃이 나팔 모양이에요. 잎과 줄기에 가는 털이 있어요." },
        { title: "기르는 방법", text: "[모의] 햇빛이 잘 드는 곳에 두고, 흙이 마르면 물을 줘요." },
      ],
      glossary: [{ term: "원예 식물", meaning: "[모의] 사람이 보기 좋게 가꾸려고 기르는 식물" }],
      observeQuestions: ["꽃은 어떤 모양인가요?", "잎을 만져 보면 어떤 느낌인가요?", "이 식물은 햇빛이 잘 드는 곳에 있나요?"],
      wonder: "[모의] 햇빛이 드는 곳과 그늘에 둔 화분의 꽃 수는 다를까요?",
    };
  }
  const { json, model } = await generateJSON(target, { prompt: unlistedPrompt(name, sci, grade, standards), schema: UNLISTED_SCHEMA, effort: "low" });
  return { ...tidyUnlisted(json as UnlistedInfo, name, sci), model };
}

/* ───────── 연결 확인 ───────── */
export async function checkAi(target: AiTarget): Promise<{ ok: boolean; model?: string }> {
  if (isMock()) return { ok: true };
  const { json, model } = await generateJSON(target, { prompt: "ok 항목에 true를 넣어 답하세요.", schema: obj({ ok: { type: "boolean" } }), effort: "low" });
  return { ok: Boolean((json as { ok?: boolean })?.ok), model };
}
