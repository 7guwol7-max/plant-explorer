/**
 * 관찰 낱말 도움말 (잎 모양·잎맥·줄기)
 * 학생이 낱말 뜻을 몰라도 고를 수 있게 그림(app/components/TermIcon.tsx)과 쉬운 설명을 붙인다.
 * 키는 lib/client/draft.ts 의 선택지 글자와 같다.
 */
export type TermInfo = { desc: string; examples?: string };

export const TERMS: Record<string, TermInfo> = {
  // 잎 모양
  "넓적한 잎": { desc: "잎이 넓고 둥그스름해요. 손바닥을 펴서 대 보면 꽤 넓어요.", examples: "벚나무, 목련, 느티나무" },
  "길쭉한 잎": { desc: "잎이 가늘고 길쭉해요. 길이가 폭보다 훨씬 길어요.", examples: "버드나무, 강아지풀, 벼" },
  "바늘 잎": { desc: "바늘처럼 가늘고 끝이 뾰족해요. 만지면 따끔할 수 있어요.", examples: "소나무, 잣나무, 전나무" },
  "부채 모양": { desc: "부채를 펼친 것처럼 아래는 좁고 위로 갈수록 넓게 퍼져요.", examples: "은행나무" },
  "손바닥 모양": { desc: "손가락을 쫙 편 것처럼 여러 갈래로 갈라져 있어요.", examples: "단풍나무, 팔손이" },
  "깃털처럼 갈라짐": { desc: "가운데 줄기 양쪽으로 작은 잎들이 새의 깃털처럼 줄지어 붙어 있어요.", examples: "아까시나무, 고사리" },
  // 잎맥
  그물맥: { desc: "잎맥이 가지를 치며 그물처럼 서로 이어져 있어요.", examples: "단풍나무, 봉선화, 콩" },
  나란히맥: { desc: "잎맥이 잎의 아래에서 위로 나란히 뻗어 있어요.", examples: "벼, 옥수수, 강아지풀" },
  부챗살맥: { desc: "잎맥이 잎자루 쪽 한 곳에서 부챗살처럼 퍼져 나가요.", examples: "은행나무" },
  // 줄기
  "굵은 나무줄기": { desc: "단단하고 굵어요. 겉껍질이 거칠고, 여러 해 동안 자라며 점점 굵어져요.", examples: "소나무, 벚나무, 은행나무" },
  "가는 풀줄기": { desc: "가늘고 부드러워요. 초록색인 경우가 많고 손으로 구부러져요.", examples: "봉선화, 강아지풀, 해바라기(어릴 때)" },
  덩굴: { desc: "혼자 곧게 서지 못하고 다른 물체를 감거나 붙잡고 올라가요.", examples: "나팔꽃, 담쟁이덩굴, 칡" },
  // 공통
  모름: { desc: "잘 모르겠으면 골라도 괜찮아요. AI와 공식 정보를 보며 함께 알아봐요." },
};

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
