/**
 * 제미나이 호출 (사진 식별, 쉬운 설명·관찰 질문 생성)
 * - 키는 x-goog-api-key 헤더로 보낸다 (주소에 키를 넣지 않음)
 * - 응답은 JSON 스키마를 강제해 구조화된 결과만 받는다
 * - MOCK=1 이면 외부 호출 없이 고정 응답
 */
import { isMock } from "./keys";

const MODEL = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";

export class GeminiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "GeminiError";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generate(key: string, parts: any[], schema: any) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.2,
        },
      }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new GeminiError(res.status, t.slice(0, 400));
  }
  const j = await res.json();
  const text: string =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError(502, "AI 응답을 해석하지 못했어요");
  }
}

/* ───────── 사진 식별 ───────── */
export type Candidate = {
  koreanName: string;
  scientificName: string;
  confidence: "높음" | "중간" | "낮음";
  evidence: string;
};
export type IdentifyResult = { candidates: Candidate[]; uncertain: boolean; mock?: boolean };

const IDENTIFY_SCHEMA = {
  type: "OBJECT",
  properties: {
    candidates: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          koreanName: { type: "STRING" },
          scientificName: { type: "STRING" },
          confidence: { type: "STRING", enum: ["높음", "중간", "낮음"] },
          evidence: { type: "STRING" },
        },
        required: ["koreanName", "scientificName", "confidence", "evidence"],
      },
    },
    uncertain: { type: "BOOLEAN" },
  },
  required: ["candidates", "uncertain"],
};

export async function identify(
  imageBase64: string,
  mimeType: string,
  taxon: "plant" | "insect",
  key: string,
): Promise<IdentifyResult> {
  if (isMock()) {
    return {
      mock: true,
      uncertain: false,
      candidates: [
        { koreanName: "은행나무", scientificName: "Ginkgo biloba", confidence: "높음", evidence: "[모의] 부채 모양 잎, 가운데가 갈라진 잎 가장자리" },
        { koreanName: "단풍나무", scientificName: "Acer palmatum", confidence: "낮음", evidence: "[모의] 손바닥 모양으로 갈라진 잎일 가능성" },
      ],
    };
  }
  const what = taxon === "insect" ? "곤충" : "식물";
  const prompt = `당신은 초등학생의 과학 탐구를 돕는 ${what} 식별 도우미입니다.
사진 속 ${what}을 보고 한국에서 볼 수 있는 ${what} 후보를 최대 3개 제시하세요.
- koreanName: 국립수목원 국가표준 국명(예: 은행나무, 소나무, 서양민들레)
- scientificName: 학명(속명 종소명, 명명자 제외)
- confidence: 높음/중간/낮음
- evidence: 사진에서 실제로 보이는 근거를 초등학생이 확인할 수 있는 말로 (잎 모양, 잎맥, 줄기, 꽃, 열매 등)
사진이 흐리거나 ${what}이 아니거나 판단이 어려우면 uncertain을 true로 하고 후보는 "낮음"으로만 표시하세요. 추측으로 확신하지 마세요.`;
  return generate(
    key,
    [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }],
    IDENTIFY_SCHEMA,
  );
}

/* ───────── 쉬운 설명 + 관찰 질문 ───────── */
export type ExplainResult = {
  kidSummary: string;
  observeQuestions: string[];
  compareHint: string;
  mock?: boolean;
};

const EXPLAIN_SCHEMA = {
  type: "OBJECT",
  properties: {
    kidSummary: { type: "STRING" },
    observeQuestions: { type: "ARRAY", items: { type: "STRING" } },
    compareHint: { type: "STRING" },
  },
  required: ["kidSummary", "observeQuestions", "compareHint"],
};

export async function explain(
  official: Record<string, string>,
  grade: string,
  key: string,
): Promise<ExplainResult> {
  if (isMock()) {
    return {
      mock: true,
      kidSummary: "[모의] 이 식물은 잎이 부채처럼 생겼어요. 가을이 되면 잎이 노랗게 물들고 떨어져요. 공원이나 길가에서 자주 볼 수 있어요.",
      observeQuestions: [
        "잎의 가장자리가 어떻게 생겼나요? 매끈한가요, 갈라져 있나요?",
        "잎맥이 어떤 모양으로 뻗어 있나요?",
        "이 식물이 자라는 곳은 햇빛이 잘 드나요?",
      ],
      compareHint: "[모의] 비슷하게 생긴 식물과 잎 모양, 잎맥, 줄기를 비교해 보세요.",
    };
  }
  const prompt = `아래는 국립수목원 식물도감의 공식 정보(JSON)입니다. 이 원문에 있는 사실만 사용해 초등 ${grade} 어휘로 다시 써 주세요.
규칙:
- kidSummary: 3~4문장. 원문에 없는 내용은 절대 쓰지 말 것. 모르는 항목은 언급하지 말 것.
- observeQuestions: 학생이 지금 눈앞의 실제 식물을 보고 확인할 수 있는 관찰 질문 3개 (잎, 줄기, 꽃, 열매, 자라는 환경 중심)
- compareHint: 원문의 '유사종' 정보가 있으면 그것과 구별하는 관찰 포인트 1~2문장, 없으면 "비슷한 식물과 잎 모양·잎맥·줄기를 비교해 보세요."
공식 정보:
${JSON.stringify(official, null, 0)}`;
  return generate(key, [{ text: prompt }], EXPLAIN_SCHEMA);
}

/* ───────── 연결 확인 ───────── */
export async function checkGemini(key: string): Promise<boolean> {
  if (isMock()) return true;
  const r = await generate(
    key,
    [{ text: "ok 항목에 true를 넣어 답하세요." }],
    { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } }, required: ["ok"] },
  );
  return Boolean(r?.ok);
}

export function geminiErrorResponse(e: unknown) {
  if (e instanceof GeminiError) {
    const friendly =
      e.status === 400 || e.status === 403
        ? "제미나이 키가 올바르지 않거나 권한이 없어요"
        : e.status === 429
          ? "제미나이 호출 한도를 넘었어요. 잠시 후 다시 시도하세요"
          : e.status === 404
            ? "제미나이 모델 이름을 찾지 못했어요 (GEMINI_MODEL 확인)"
            : e.message;
    return Response.json({ error: "GEMINI_ERROR", status: e.status, message: friendly }, { status: 502 });
  }
  const msg = e instanceof Error ? e.message : "알 수 없는 오류";
  return Response.json({ error: "SERVER_ERROR", message: msg }, { status: 500 });
}
