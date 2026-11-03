/**
 * 국립수목원 식물도감 상세 항목 이름표 (화면·도감 카드·교육과정 연결이 함께 쓴다)
 * [항목 키, 긴 이름, 짧은 이름] — 화면에 보여 주는 순서대로
 */
export const OFFICIAL_FIELDS = [
  ["shpe", "형태 (생김새)", "형태"],
  ["spft", "특징", "특징"],
  ["grwEvrntDesc", "생육환경 (자라는 곳)", "생육환경"],
  ["rrngType", "생육형", "생육형"],
  ["rrngGubun", "생육상 구분", "생육상 구분"],
  ["dstrb", "분포 (우리나라)", "분포"],
  ["osDstrb", "해외 분포", "해외 분포"],
  ["orplcNm", "원산지", "원산지"],
  ["inductionDesc", "도입 여부", "도입 여부"],
  ["smlrPlntDesc", "유사종 (비슷한 식물)", "유사종"],
  ["useMthdDesc", "이용 방안", "이용 방안"],
  ["prtcPlnDesc", "보호 방안", "보호 방안"],
] as const;

export type OfficialFieldKey = (typeof OFFICIAL_FIELDS)[number][0];

export const FIELD_SHORT: Record<string, string> = Object.fromEntries(
  OFFICIAL_FIELDS.map(([k, , s]) => [k, s]),
);

export const SOURCE_NAME = "국립수목원 국가생물종지식정보시스템";
