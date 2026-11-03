import { SITE } from "@/lib/site";

/**
 * 발견 → 추정 → 확인 화면 사이에 잠시 들고 다니는 작업 중 자료 (sessionStorage)
 */
export type Observation = { leafShape: string; leafVein: string; stem: string };
export type CandidateLite = { koreanName: string; scientificName: string; confidence?: string; evidence?: string };

export type Draft = {
  photo?: string;           // 대표 사진 = photos[0] (확인 화면·도감 카드용)
  photos?: string[];        // AI에게 보내는 사진 최대 3장 (data URL, 긴 변 1024)
  place?: string;
  observation?: Observation;
  aiCandidates?: CandidateLite[];
  aiUncertain?: boolean;
  chosen?: CandidateLite;   // 학생이 고른 후보 또는 직접 입력
};

const D = "draft";

export function loadDraft(): Draft {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(D) ?? "{}") as Draft;
  } catch {
    return {};
  }
}

export function saveDraft(d: Draft) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(D, JSON.stringify(d));
  } catch {
    /* 사진이 커서 저장 실패할 때는 대표 사진만, 그래도 안 되면 사진 없이 */
    try {
      sessionStorage.setItem(D, JSON.stringify({ ...d, photos: d.photo ? [d.photo] : undefined }));
    } catch {
      try {
        sessionStorage.setItem(D, JSON.stringify({ ...d, photo: undefined, photos: undefined }));
      } catch {}
    }
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(D);
  } catch {}
}

export const MAX_PHOTOS = 3;

/** 장소 칩은 lib/site.ts 에서 고친다 */
export const PLACES: string[] = SITE.places;
export const LEAF_SHAPES = ["넓적한 잎", "길쭉한 잎", "바늘 잎", "부채 모양", "손바닥 모양", "깃털처럼 갈라짐", "모름"];
export const LEAF_VEINS = ["그물맥", "나란히맥", "부챗살맥", "모름"];
export const STEMS = ["굵은 나무줄기", "가는 풀줄기", "덩굴", "모름"];
