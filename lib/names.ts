/**
 * 식물 이름 비교 도우미 (화면·서버가 함께 쓴다)
 * - 국명은 띄어쓰기만 다른 경우가 많다 (서양 민들레 / 서양민들레)
 * - 학명은 '속명 종소명'까지만 비교한다. 명명자(L., Thunb.)와 변종·품종 표기는 뺀다.
 *   잡종 표시(×, x)는 '속명 × 종소명'으로 남긴다.
 */

/** 국명 비교용: 공백을 모두 지운다 */
export const squashName = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, "");

/** 학명에서 '속명 종소명' 만 꺼낸다. 속명이 아니면 빈 문자열 */
export function sciBinomial(s: string | undefined | null): string {
  const t = (s ?? "").trim().split(/\s+/).filter(Boolean);
  if (!t[0] || !/^[A-Z][a-z-]+$/.test(t[0])) return "";
  if ((t[1] === "×" || t[1] === "x") && t[2]) return `${t[0]} × ${t[2]}`;
  return t[1] && /^[a-z][a-z-]+$/.test(t[1]) ? `${t[0]} ${t[1]}` : "";
}

/** 학명의 속명 (예: Ginkgo). 없으면 빈 문자열 */
export function sciGenus(s: string | undefined | null): string {
  const g = (s ?? "").trim().split(/\s+/)[0] ?? "";
  return /^[A-Z][a-z-]+$/.test(g) ? g : "";
}

/** 두 학명이 같은 종인지 (대소문자 무시, 속명 종소명만) */
export function sameSpecies(a: string | undefined | null, b: string | undefined | null): boolean {
  const x = sciBinomial(a).toLowerCase();
  return Boolean(x) && x === sciBinomial(b).toLowerCase();
}

/** 라틴 글자로 쓴 이름이면 학명으로 본다 */
export const looksScientific = (s: string) => /^[A-Za-z]/.test(s.trim());
