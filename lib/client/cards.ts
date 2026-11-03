/**
 * 나의 도감 카드 (localStorage "cards")
 * 사진은 긴 변 640px, 관찰 그림은 800px JPEG 로 줄여 저장한다 (브라우저 저장소 한도 고려, 보통 15~25장).
 */
import type { CandidateLite, Observation } from "./draft";
import { activityFor, type CurriculumLink, type GradeBand } from "@/lib/curriculum";

/** 카드에 남기는 교육과정 연결 (원문을 함께 저장해 나중에 자료가 바뀌어도 카드가 그대로 읽힌다) */
export type CardCurriculum = {
  code: string;
  subject: string;
  unit: string;
  officialText: string;
  kidText?: string;
  activity: string;
  answer: string;
};

/** 국립수목원 도감에 없는 식물 카드: 공식 원문 대신 AI가 알려 준 정보를 '공식 아님'으로 남긴다 */
export type CardUnlisted = {
  by: string;                                  // 알려 준 AI 이름 (예: 제미나이)
  whyNotListed: string;
  sections: { title: string; text: string }[];
};

export type Card = {
  id: string;
  createdAt: string;
  photo?: string;
  place?: string;
  myObservation?: Observation;
  aiCandidates?: CandidateLite[];
  confirmed: { pilbkNo: string; koreanName: string; scientificName: string; family?: string }; // 도감에 없는 식물이면 pilbkNo 는 ""
  official: Record<string, string>;            // 도감에 없는 식물이면 {}
  unlisted?: CardUnlisted;
  kidSummary?: string;
  answers: { q: string; a: string }[];
  newLearning: string;
  verified: "일치" | "불일치" | "모름";
  gradeBand?: GradeBand;
  curriculum?: CardCurriculum[];
  drawings?: Drawing[];
};

/** 학생이 그리거나 종이 그림을 찍어 올린 관찰 그림 */
export type Drawing = { image: string; note: string; kind: "drawn" | "photo" };
export const MAX_DRAWINGS = 2;

/** 화면의 교과서 연결 → 카드에 남길 모양 (활동 문장은 그때 보여 준 것 그대로) */
export function toCardCurriculum(links: CurriculumLink[], answers: Record<string, string>, unlisted = false): CardCurriculum[] {
  return links.map(({ standard: s }) => ({
    code: s.code,
    subject: s.subject,
    unit: s.unit,
    officialText: s.officialText,
    kidText: s.kidText,
    activity: activityFor(s, unlisted),
    answer: answers[s.code] ?? "",
  }));
}

const C = "cards";

export function loadCards(): Card[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(C) ?? "[]") as Card[];
  } catch {
    return [];
  }
}

export function saveCard(card: Card): { ok: boolean; message?: string } {
  const cards = [card, ...loadCards().filter((c) => c.id !== card.id)];
  try {
    localStorage.setItem(C, JSON.stringify(cards));
    return { ok: true };
  } catch {
    // 저장소가 가득 찼을 때: 사진 없이 → 그림도 없이 차례로 다시 시도
    try {
      localStorage.setItem(C, JSON.stringify([{ ...card, photo: undefined }, ...cards.slice(1)]));
      return { ok: true, message: "저장 공간이 부족해 사진 없이 저장했어요. 오래된 카드를 지우면 공간이 생겨요." };
    } catch {}
    try {
      localStorage.setItem(C, JSON.stringify([{ ...card, photo: undefined, drawings: undefined }, ...cards.slice(1)]));
      return { ok: true, message: "저장 공간이 부족해 사진과 그림 없이 저장했어요. 오래된 카드를 지우면 공간이 생겨요." };
    } catch {
      return { ok: false, message: "저장 공간이 가득 찼어요. 오래된 카드를 지운 뒤 다시 시도하세요." };
    }
  }
}

export function deleteCard(id: string) {
  try {
    localStorage.setItem(C, JSON.stringify(loadCards().filter((c) => c.id !== id)));
  } catch {}
}

export function newCardId() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${Math.random().toString(36).slice(2, 6)}`;
}
