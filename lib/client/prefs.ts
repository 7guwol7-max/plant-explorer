/**
 * 이 기기의 학년·보기 방식 설정 (localStorage "grade", "role")
 * - 학년: 교육과정 연결과 AI 풀이의 어휘 수준
 * - 보기 방식: 학생(기본) = 교과서 내용을 학생 말로 / 선생님 = 성취기준 원문·해설
 */
import { useEffect, useState } from "react";
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

export type Role = "student" | "teacher";
const R = "role";

export function loadRole(): Role {
  if (typeof window === "undefined") return "student";
  try {
    return localStorage.getItem(R) === "teacher" ? "teacher" : "student";
  } catch {
    return "student";
  }
}

export function saveRole(r: Role) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(R, r);
  } catch {}
  window.dispatchEvent(new Event(PREFS_EVENT));
}

/** 화면에서 쓰는 보기 방식 (바뀌면 바로 다시 그린다) */
export function useRole(): Role {
  const [role, setRole] = useState<Role>("student");
  useEffect(() => {
    const read = () => setRole(loadRole());
    read();
    window.addEventListener(PREFS_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(PREFS_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return role;
}
