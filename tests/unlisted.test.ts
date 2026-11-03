import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sameSpecies, sciBinomial, sciGenus, squashName } from "@/lib/names";
import { lookupOtherNames, MAX_LOOKUPS, MAX_RELATIVES } from "@/lib/server/unlisted";
import { GRADE_STYLE, UNLISTED_SECTIONS, tidyUnlisted, unlistedPrompt, type UnlistedInfo } from "@/lib/server/ai/tasks";
import { getStandard, type Standard } from "@/lib/curriculum";
import type { PlantSummary } from "@/lib/server/datagokr";

const P = (koreanName: string, scientificName: string, pilbkNo = koreanName): PlantSummary => ({ pilbkNo, koreanName, scientificName, family: "" }) as PlantSummary;

describe("식물 이름 비교", () => {
  it("학명은 속명 종소명만 (명명자·변종 표기 빼기)", () => {
    expect(sciBinomial("Ginkgo biloba L.")).toBe("Ginkgo biloba");
    expect(sciBinomial("Acer palmatum var. amoenum (Carrière) H.Ohashi")).toBe("Acer palmatum");
    expect(sciBinomial("Pinus densiflora Siebold & Zucc.")).toBe("Pinus densiflora");
  });
  it("잡종 표시(×, x)는 남긴다", () => {
    expect(sciBinomial("Petunia × atkinsiana")).toBe("Petunia × atkinsiana");
    expect(sciBinomial("Petunia x hybrida")).toBe("Petunia × hybrida");
  });
  it("학명이 아니면 빈 문자열", () => {
    expect(sciBinomial("페튜니아")).toBe("");
    expect(sciBinomial("")).toBe("");
    expect(sciBinomial("Petunia")).toBe("");
    expect(sciGenus("Petunia")).toBe("Petunia");
    expect(sciGenus("페튜니아")).toBe("");
  });
  it("대소문자·명명자가 달라도 같은 종", () => {
    expect(sameSpecies("Taraxacum officinale", "Taraxacum officinale F.H.Wigg.")).toBe(true);
    expect(sameSpecies("Taraxacum officinale", "Taraxacum platycarpum")).toBe(false);
    expect(sameSpecies("", "")).toBe(false);
  });
  it("국명은 띄어쓰기를 무시하고 비교", () => {
    expect(squashName("서양 민들레")).toBe(squashName("서양민들레"));
  });
});

describe("국립수목원 도감 다시 찾기 (AI가 알려 준 다른 이름으로)", () => {
  const ai = (o: Partial<{ koreanName: string; scientificName: string; otherNames: string[] }> = {}) => ({ koreanName: "", scientificName: "", otherNames: [], ...o });

  it("다른 이름으로 실려 있으면 listedAs 로 알려 준다", async () => {
    const calls: string[] = [];
    const r = await lookupOtherNames(
      { asked: { koreanName: "민들레꽃", scientificName: "" }, ai: ai({ koreanName: "서양민들레", scientificName: "Taraxacum officinale", otherNames: ["양민들레"] }) },
      async (q) => {
        calls.push(q);
        return q === "서양민들레" ? [P("서양민들레", "Taraxacum officinale F.H.Wigg.", "1")] : [];
      },
    );
    expect(r.listedAs?.pilbkNo).toBe("1");
    expect(r.relatives).toEqual([]);
    expect(calls).toEqual(["서양민들레"]); // 찾으면 더 찾지 않는다
  });

  it("학명이 같으면 국명이 달라도 같은 식물", async () => {
    const r = await lookupOtherNames(
      { asked: { koreanName: "꽃잔디", scientificName: "" }, ai: ai({ koreanName: "꽃잔디", scientificName: "Phlox subulata", otherNames: ["지면패랭이꽃"] }) },
      async (q) => (q === "지면패랭이꽃" ? [P("지면패랭이꽃", "Phlox subulata L.", "7")] : []),
    );
    expect(r.listedAs?.pilbkNo).toBe("7");
  });

  it("국명이 같아도 속명이 다르면 다른 식물로 본다 (엉뚱한 연결 막기)", async () => {
    const r = await lookupOtherNames(
      { asked: { koreanName: "별꽃", scientificName: "" }, ai: ai({ koreanName: "별꽃", scientificName: "Pentas lanceolata", otherNames: ["펜타스"] }) },
      async (q) => (q === "펜타스" ? [P("펜타스", "Stellaria media")] : []),
    );
    expect(r.listedAs).toBeNull();
  });

  it("화면이 이미 찾아본 이름·학명은 다시 찾지 않고, 많아도 3번까지만", async () => {
    const calls: string[] = [];
    await lookupOtherNames(
      {
        asked: { koreanName: "페튜니아", scientificName: "Petunia × atkinsiana" },
        ai: ai({ koreanName: "페 튜니아", scientificName: "Petunia × atkinsiana", otherNames: ["가", "나", "다", "라"] }),
      },
      async (q) => {
        calls.push(q);
        return [];
      },
    );
    expect(calls.slice(0, MAX_LOOKUPS)).toEqual(["가", "나", "다"]);
    expect(calls).not.toContain("페 튜니아");
    expect(calls).not.toContain("Petunia × atkinsiana");
    expect(calls[MAX_LOOKUPS]).toBe("Petunia"); // 마지막은 같은 무리(속) 찾기
  });

  it("실려 있지 않으면 같은 속 식물만 골라 relatives 로 (최대 5개)", async () => {
    const genusHits = [
      ...Array.from({ length: 7 }, (_, i) => P(`단풍${i}`, `Acer sp${i}`, `A${i}`)),
      P("엉뚱한나무", "Aceriphyllum rossii", "X"),
    ];
    const r = await lookupOtherNames(
      { asked: { koreanName: "홍단풍", scientificName: "Acer palmatum 'Atropurpureum'" }, ai: ai({ koreanName: "홍단풍", scientificName: "Acer palmatum" }) },
      async (q) => (q === "Acer" ? genusHits : []),
    );
    expect(r.listedAs).toBeNull();
    expect(r.relatives.length).toBe(MAX_RELATIVES);
    expect(r.relatives.every((x) => x.scientificName.startsWith("Acer "))).toBe(true);
    expect(r.searched).not.toContain("Acer"); // 속명 찾기는 '찾아본 이름'에 넣지 않는다
  });

  it("다시 찾기가 실패해도 오류를 내지 않는다 (AI 정보는 보여 줘야 하므로)", async () => {
    const r = await lookupOtherNames(
      { asked: { koreanName: "가", scientificName: "" }, ai: ai({ koreanName: "나", scientificName: "Abc def", otherNames: ["다"] }) },
      async () => {
        throw new Error("키 오류");
      },
    );
    expect(r).toMatchObject({ listedAs: null, relatives: [] });
  });
});

describe("도감에 없는 식물 — AI 프롬프트와 응답 다듬기", () => {
  const std = [getStandard("[4과03-01]")!] as Standard[];
  it("학년 글쓰기 기준·지어내기 금지·안전 규칙이 들어간다", () => {
    for (const g of ["1-2", "3-4", "5-6"] as const) {
      const p = unlistedPrompt("페튜니아", "Petunia × atkinsiana", g, std);
      expect(p).toContain(GRADE_STYLE[g]);
      expect(p).toContain("'페튜니아'");
      expect(p).toContain("지어내지 말 것");
      expect(p).toContain("먹을 수 있다거나 약이 된다는 내용은 쓰지 말 것");
      expect(p).toContain(std[0].officialText);
    }
  });

  const raw = (o: Partial<UnlistedInfo> = {}): UnlistedInfo => ({
    known: true,
    koreanName: "페튜니아",
    scientificName: "Petunia × atkinsiana",
    otherNames: [],
    whyNotListed: "원예 식물일 수 있어요.",
    kidSummary: "소개",
    sections: [{ title: "생김새", text: "나팔 모양" }],
    glossary: [],
    observeQuestions: ["1", "2", "3", "4"],
    wonder: "궁금",
    ...o,
  });

  it("AI가 모르는 식물이면 글을 모두 비운다", () => {
    const r = tidyUnlisted(raw({ known: false }), "모름풀", "");
    expect(r.known).toBe(false);
    expect(r.kidSummary).toBe("");
    expect(r.sections).toEqual([]);
    expect(r.koreanName).toBe("페튜니아");
  });

  it("정해진 제목만, 질문 3개, 다른 이름 4개까지", () => {
    const r = tidyUnlisted(
      raw({ sections: [{ title: "생김새", text: "가" }, { title: "효능", text: "나" }], otherNames: ["a", "a", "b", "c", "d", "e"] }),
      "페튜니아",
      "",
    );
    expect(r.sections.map((s) => s.title)).toEqual(["생김새"]);
    expect(UNLISTED_SECTIONS).not.toContain("효능");
    expect(r.observeQuestions.length).toBe(3);
    expect(r.otherNames).toEqual(["a", "b", "c", "d"]);
  });
});

describe("POST /api/unlisted (연습 모드)", () => {
  beforeEach(() => {
    process.env.MOCK = "1";
  });
  afterEach(() => {
    delete process.env.MOCK;
    vi.restoreAllMocks();
  });
  const post = async (body: unknown) => {
    const { POST } = await import("@/app/api/unlisted/route");
    return POST(new NextRequest("http://x/api/unlisted", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
  };

  it("AI 정보와 함께 '다시 찾아봤지만 없음'을 돌려준다", async () => {
    const res = await post({ koreanName: "페튜니아", scientificName: "Petunia × atkinsiana", gradeBand: "3-4", standards: ["[4과03-01]"] });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j).toMatchObject({ known: true, mock: true, listedAs: null, checked: true });
    expect(j.kidSummary.length).toBeGreaterThan(0);
    expect(Array.isArray(j.relatives)).toBe(true);
  });

  it("이름이 없으면 400", async () => {
    const res = await post({ koreanName: "  " });
    expect(res.status).toBe(400);
  });
});
