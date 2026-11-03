import { describe, expect, it, beforeAll } from "vitest";
import { CURRICULUM, GRADE_BANDS, findSentence, linkCurriculum, describeMatch, getStandard, isGradeBand, activitySteps, activityFor } from "@/lib/curriculum";
import { toCardCurriculum } from "@/lib/client/cards";
import { OFFICIAL_FIELDS } from "@/lib/fields";
import { curriculumBlock } from "@/lib/server/ai/tasks";

const codes = (ls: { standard: { code: string } }[]) => ls.map((l) => l.standard.code);

describe("교육과정 자료(data/curriculum.json)", () => {
  it("코드가 겹치지 않는다", () => {
    const all = CURRICULUM.standards.map((s) => s.code);
    expect(new Set(all).size).toBe(all.length);
  });

  it("모든 성취기준이 필수 항목을 갖추고 있다", () => {
    const fieldKeys = OFFICIAL_FIELDS.map(([k]) => k as string);
    for (const s of CURRICULUM.standards) {
      expect(s.code, s.code).toMatch(/^\[\d[가-힣]+\d{2}-\d{2}\]$/);
      expect(isGradeBand(s.gradeBand), s.code).toBe(true);
      expect(s.officialText.length, s.code).toBeGreaterThan(10);
      expect(s.activity.length, s.code).toBeGreaterThan(10);
      // 학생용 문장: 있어야 하고, 코드·원문 말투(~할 수 있다.)를 쓰지 않는다
      expect(s.kidText.length, s.code).toBeGreaterThan(10);
      expect(s.kidText, s.code).not.toMatch(/\[|\]|할 수 있다\.|한다\.$/);
      expect(s.kidText, s.code).not.toBe(s.officialText);
      expect(s.source.title, s.code).toMatch(/^\[별책\d+\]/);
      expect(describeMatch(s.match).length, `${s.code} 연결 조건 없음`).toBeGreaterThan(0);
      for (const f of s.match.fields ?? []) expect(fieldKeys, `${s.code} 의 ${f}`).toContain(f);
    }
  });

  it("학년군마다 어떤 식물이든 연결되는 성취기준이 하나 이상 있다", () => {
    for (const g of GRADE_BANDS) {
      expect(linkCurriculum({ gradeBand: g }).length, g).toBeGreaterThan(0);
    }
  });

  it("성취기준 코드의 학년이 학년군과 맞다", () => {
    for (const s of CURRICULUM.standards) {
      const n = Number(s.code[1]);
      expect(s.gradeBand.endsWith(String(n)), s.code).toBe(true);
    }
  });
});

describe("교육과정 연결 계산", () => {
  const official = {
    shpe: "잎은 부채 모양이다. 잎맥이 부챗살처럼 뻗는다.",
    grwEvrntDesc: "햇빛이 잘 드는 곳에서 잘 자란다. 공해에 강하다.",
    useMthdDesc: "가로수와 관상용으로 심는다.",
  };

  it("같은 입력이면 언제나 같은 결과 (결정적)", () => {
    const a = linkCurriculum({ gradeBand: "3-4", official, place: "학교 화단" });
    const b = linkCurriculum({ gradeBand: "3-4", official, place: "학교 화단" });
    expect(codes(a)).toEqual(codes(b));
  });

  it("선택한 학년군의 성취기준만 나온다", () => {
    for (const g of GRADE_BANDS) {
      for (const l of linkCurriculum({ gradeBand: g, official, place: "학교 화단" })) {
        expect(l.standard.gradeBand).toBe(g);
      }
    }
  });

  it("3~4학년: 생육환경이 있으면 [4과03-02], 햇빛이 나오면 [4과04-02]가 연결된다", () => {
    const c = codes(linkCurriculum({ gradeBand: "3-4", official }));
    expect(c).toContain("[4과03-01]");
    expect(c).toContain("[4과03-02]");
    expect(c).toContain("[4과04-02]");
  });

  it("근거 문장은 국립수목원 원문을 고치지 않고 그대로 가져온다", () => {
    const l = linkCurriculum({ gradeBand: "3-4", official }).find((x) => x.standard.code === "[4과04-02]")!;
    const ev = l.reasons.find((r) => r.kind === "keyword")!.evidence!;
    expect(ev.field).toBe("grwEvrntDesc");
    expect(official.grwEvrntDesc).toContain(ev.sentence);
    expect(ev.sentence).toBe("햇빛이 잘 드는 곳에서 잘 자란다.");
  });

  it("장소·줄기 관찰로도 연결된다", () => {
    const c = codes(linkCurriculum({ gradeBand: "3-4", place: "학교 뒷산", observation: { stem: "굵은 나무줄기" } }));
    expect(c).toContain("[4과14-01]"); // 바깥 장소
    expect(c).toContain("[4과04-03]"); // 나무줄기 → 한살이
  });

  it("조건에 안 맞으면 연결하지 않는다", () => {
    const c = codes(linkCurriculum({ gradeBand: "3-4", place: "기타" }));
    expect(c).not.toContain("[4과14-01]");
    expect(c).not.toContain("[4과14-03]");
  });

  it("우선순위대로 정렬된다", () => {
    const ls = linkCurriculum({ gradeBand: "3-4", official, place: "학교 화단" });
    const p = ls.map((l) => l.standard.priority);
    expect([...p].sort((a, b) => a - b)).toEqual(p);
  });

  it("까닭은 성취기준마다 최대 3개", () => {
    for (const l of linkCurriculum({ gradeBand: "5-6", official, place: "학교 화단" })) {
      expect(l.reasons.length).toBeLessThanOrEqual(3);
    }
  });

  it("5~6학년: 이용 방안이 있으면 실과 [6실04-07]이 연결된다", () => {
    expect(codes(linkCurriculum({ gradeBand: "5-6", official }))).toContain("[6실04-07]");
  });

  it("조사 받침에 맞게 쓴다", () => {
    const l = linkCurriculum({ gradeBand: "3-4", observation: { stem: "굵은 나무줄기" } }).find((x) => x.standard.code === "[4과04-03]")!;
    expect(l.reasons.some((r) => r.text.includes("'굵은 나무줄기'로"))).toBe(true);
  });
});

describe("해 볼 활동", () => {
  it("모든 활동이 1~3단계로 나뉘고, 나눠도 글자가 빠지지 않는다", () => {
    for (const s of CURRICULUM.standards) {
      for (const text of [s.activity, s.activityUnlisted].filter((t): t is string => Boolean(t))) {
        const steps = activitySteps(text);
        expect(steps.length, s.code).toBeGreaterThanOrEqual(1);
        expect(steps.length, s.code).toBeLessThanOrEqual(3);
        expect(steps.some((t) => t.startsWith("(")), s.code).toBe(false);
        expect(steps.join(" ").replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " ").trim());
      }
    }
  });

  it("괄호 안의 물음표에서는 나누지 않고, (예: …)는 앞 단계에 붙인다", () => {
    const steps = activitySteps(getStandard("[4과03-01]")!.activity);
    expect(steps[0]).toContain("분류 기준을 하나 정해 보세요. (예: 잎맥이 나란한가?)");
    expect(steps.length).toBe(2);
    expect(activitySteps("가요? 나요. 다(라?)마요!")).toEqual(["가요?", "나요.", "다(라?)마요!"]);
  });

  it("'공식 정보'를 찾으라는 활동은 도감에 없는 식물용 문장이 따로 있다", () => {
    for (const s of CURRICULUM.standards) {
      if (s.activity.includes("공식 정보")) {
        expect(s.activityUnlisted, s.code).toBeTruthy();
        expect(s.activityUnlisted, s.code).not.toContain("공식 정보");
      }
      expect(activityFor(s, true)).not.toContain("공식 정보");
      expect(activityFor(s, false)).toBe(s.activity);
    }
  });

  it("도감에 없는 식물 카드에는 그때 보여 준 활동 문장을 저장한다", () => {
    const links = linkCurriculum({ gradeBand: "3-4", place: "학교 화단", observation: { stem: "굵은 나무줄기" } });
    const saved = toCardCurriculum(links, { "[4과04-03]": "여러해살이" }, true);
    const one = saved.find((c) => c.code === "[4과04-03]")!;
    expect(one.activity).toBe(getStandard("[4과04-03]")!.activityUnlisted);
    expect(one.answer).toBe("여러해살이");
    expect(toCardCurriculum(links, {}).find((c) => c.code === "[4과04-03]")!.activity).toBe(getStandard("[4과04-03]")!.activity);
  });
});

describe("문장 자르기", () => {
  it("낱말이 들어 있는 문장 하나만", () => {
    expect(findSentence("첫 문장이다. 햇빛을 좋아한다. 끝.", "햇빛")).toBe("햇빛을 좋아한다.");
  });
  it("마침표가 없으면 전체", () => {
    expect(findSentence("햇빛을 좋아함", "햇빛")).toBe("햇빛을 좋아함");
  });
  it("없으면 빈 문자열", () => {
    expect(findSentence("물을 좋아한다.", "햇빛")).toBe("");
  });
});

describe("AI 설명 프롬프트", () => {
  it("성취기준 원문과 '다루지 않는 내용'을 붙인다", () => {
    const s = [getStandard("[4과03-02]")!];
    const block = curriculumBlock(s);
    expect(block).toContain(s[0].officialText);
    expect(block).toContain("적응");
  });
  it("성취기준이 없으면 아무것도 붙이지 않는다", () => {
    expect(curriculumBlock([])).toBe("");
  });
});

describe("연습용 국립수목원 자료와 함께", () => {
  beforeAll(() => {
    process.env.MOCK = "1";
  });

  it("연습 자료 4종 모두 3~4학년에서 2개 이상 연결된다", async () => {
    const { searchPlants, getPlantDetail } = await import("@/lib/server/datagokr");
    const list = await searchPlants("", "");
    expect(list.items.length).toBe(4);
    for (const it of list.items) {
      const d = await getPlantDetail(it.pilbkNo, "");
      expect(d, it.pilbkNo).not.toBeNull();
      const ls = linkCurriculum({ gradeBand: "3-4", official: d });
      expect(ls.length, it.koreanName).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("그림 도움말 낱말", () => {
  it("첫 화면 선택지마다 설명이 있다 (lib/termText.ts 의 이름이 선택지 글자와 같다)", async () => {
    const { LEAF_SHAPES, LEAF_VEINS, STEMS } = await import("@/lib/client/draft");
    const { TERMS } = await import("@/lib/terms");
    for (const o of [...LEAF_SHAPES, ...LEAF_VEINS, ...STEMS]) {
      expect(TERMS[o]?.desc, o).toBeTruthy();
    }
  });
});

describe("선생님이 더한 성취기준 (app-settings.json 의 curriculum)", () => {
  // 기본 자료의 성취기준 하나를 본으로 쓴다
  const base = [getStandard("[4과03-01]")!, getStandard("[4과14-01]")!];

  it("새 성취기준을 더하고, 빠진 칸은 기본값으로 채운다", async () => {
    const { mergeStandards } = await import("@/lib/curriculum");
    const merged = mergeStandards(base, [{ code: "[4과99-01]", gradeBand: "3-4", officialText: "새 성취기준 원문이다." }]);
    const s = merged.find((x) => x.code === "[4과99-01]")!;
    expect(s.considerations).toEqual([]);
    expect(s.aiAvoid).toEqual([]);
    expect(s.match).toEqual({ always: true }); // 조건이 없으면 그 학년 모든 식물에
    expect(s.kidText).toBe("새 성취기준 원문이다.");
    expect(s.activity.length).toBeGreaterThan(10);
  });

  it("같은 코드면 적어 준 칸만 바꾸고 원문은 그대로 둔다", async () => {
    const { mergeStandards } = await import("@/lib/curriculum");
    const merged = mergeStandards(base, [{ code: "[4과14-01]", activity: "우리 학교 연못 둘레에서 찾아 보세요.", officialText: "바뀌면 안 됨" }]);
    const s = merged.find((x) => x.code === "[4과14-01]")!;
    expect(s.activity).toBe("우리 학교 연못 둘레에서 찾아 보세요.");
    expect(s.officialText).toBe(base[1].officialText);
    expect(s.match).toEqual(base[1].match);
    expect(merged.length).toBe(2);
  });

  it("모양이 틀린 항목은 건너뛴다 (앱이 멈추지 않게)", async () => {
    const { mergeStandards } = await import("@/lib/curriculum");
    const bad = [null, "글자", { code: "코드없음" }, { code: "[4과99-02]", gradeBand: "3학년", officialText: "x" }, { code: "[4과99-03]", gradeBand: "3-4" }];
    expect(mergeStandards(base, bad).map((s) => s.code)).toEqual(["[4과03-01]", "[4과14-01]"]);
    expect(mergeStandards(base, { not: "array" }).length).toBe(2);
  });

  it("예시로 넣은 [6실04-09]가 5~6학년 화단 관찰에서 연결된다", () => {
    expect(getStandard("[6실04-09]")?.subject).toBe("실과");
    const c = linkCurriculum({ gradeBand: "5-6", place: "학교 화단" }).map((l) => l.standard.code);
    expect(c).toContain("[6실04-09]");
  });
});
