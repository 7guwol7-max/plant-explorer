/**
 * 관찰 낱말 도움말 (잎 모양·잎맥·줄기)
 * 학생이 낱말 뜻을 몰라도 고를 수 있게 그림(app/components/TermIcon.tsx)과 쉬운 설명을 붙인다.
 * 키는 lib/client/draft.ts 의 선택지 글자와 같다.
 */
import { TERM_TEXT, type TermText } from "./termText";

export type TermInfo = TermText;

/** 낱말 → 설명. 글은 lib/termText.ts 에서 고친다 */
export const TERMS: Record<string, TermInfo> = TERM_TEXT;

export const TERM_GROUP_TITLE: Record<"leafShape" | "leafVein" | "stem", string> = {
  leafShape: "잎 모양",
  leafVein: "잎맥",
  stem: "줄기",
};

export const TERM_GROUP_HINT: Record<"leafShape" | "leafVein" | "stem", string> = {
  leafShape: "잎 한 장을 손바닥에 올려놓고 전체 모양을 살펴봐요.",
  leafVein: "잎을 빛에 비춰 보면 잎맥(잎에 있는 가는 줄)이 잘 보여요.",
  stem: "줄기를 살짝 만져 보고, 굵기와 단단한 정도를 살펴봐요.",
};
