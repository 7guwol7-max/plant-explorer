/**
 * 나의 도감 카드 (localStorage "cards")
 * 사진은 긴 변 640px JPEG 로 줄여 저장한다 (브라우저 저장소 한도 고려, 보통 20~30장).
 */
import type { CandidateLite, Observation } from "./draft";
import type { GradeBand } from "@/lib/curriculum";

/** 카드에 남기는 교육과정 연결 (원문을 함께 저장해 나중에 자료가 바뀌어도 카드가 그대로 읽힌다) */
export type CardCurriculum = {
  code: string;
  subject: string;
  unit: string;
  officialText: string;
  activity: string;
  answer: string;
};

export type Card = {
  id: string;
  createdAt: string;
  photo?: string;
  place?: string;
  myObservation?: Observation;
  aiCandidates?: CandidateLite[];
  confirmed: { pilbkNo: string; koreanName: string; scientificName: string; family?: string };
  official: Record<string, string>;
  kidSummary?: string;
  answers: { q: string; a: string }[];
  newLearning: string;
  verified: "일치" | "불일치" | "모름";
  gradeBand?: GradeBand;
  curriculum?: CardCurriculum[];
};

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
    // 저장소가 가득 찼을 때: 사진 없이 한 번 더 시도
    try {
      localStorage.setItem(C, JSON.stringify([{ ...card, photo: undefined }, ...cards.slice(1)]));
      return { ok: true, message: "저장 공간이 부족해 사진 없이 저장했어요. 오래된 카드를 지우면 공간이 생겨요." };
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
