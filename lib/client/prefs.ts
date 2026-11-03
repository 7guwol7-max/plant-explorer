/**
 * 이 기기의 학년 설정 (localStorage "grade")
 * 교육과정 연결과 AI 쉬운 설명의 어휘 수준이 이 값을 따른다.
 */
import { DEFAULT_GRADE, isGradeBand, type GradeBand } from "@/lib/curriculum";

const G = "grade";
export const PREFS_EVENT = "prefs-changed";

export function loadGrade(): GradeBand {
  if (typeof window === "undefined") return DEFAULT_GRADE;
  try {
    const v = localStorage.getItem(G);
    return isGradeBand(v) ? v : DEFAULT_GRADE;
  } catch {
    return DEFAULT_GRADE;
  }
}

export function saveGrade(g: GradeBand) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(G, g);
  } catch {
    /* 저장소를 쓸 수 없는 환경 */
  }
  window.dispatchEvent(new Event(PREFS_EVENT));
}
