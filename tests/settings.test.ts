import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings, SETTINGS } from "@/lib/settings";
import raw from "@/app-settings.json";

describe("앱 설정 파일 (app-settings.json)", () => {
  it("저장소의 설정 파일이 올바르게 읽힌다", () => {
    expect(SETTINGS.app.name.length).toBeGreaterThan(0);
    expect(SETTINGS.menu.length).toBeGreaterThan(0);
    expect(normalizeSettings(raw)).toEqual(SETTINGS);
  });

  it("비었거나 모양이 틀리면 기본값으로 (앱이 멈추지 않게)", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ menu: "메뉴", places: [], defaultGrade: "4학년" })).toEqual(DEFAULT_SETTINGS);
  });

  it("앱 이름만 바꾸면 나머지는 그대로", () => {
    const s = normalizeSettings({ app: { name: "푸른초 식물 탐사대" } });
    expect(s.app.name).toBe("푸른초 식물 탐사대");
    expect(s.app.shortName).toBe("푸른초 식물 탐사대"); // 짧은 이름이 없으면 이름을 쓴다
    expect(s.menu).toEqual(DEFAULT_SETTINGS.menu);
  });

  it("메뉴: 주소·이름이 없는 칸과 위험한 주소는 빼고 6칸까지", () => {
    const s = normalizeSettings({
      menu: [
        { href: "/", icon: "📷", label: "식물 찾기" },
        { href: "javascript:alert(1)", label: "나쁜 링크" },
        { href: "/p/school", label: "우리 학교" },
        { label: "주소 없음" },
        ...Array.from({ length: 6 }, (_, i) => ({ href: `/p/x${i}`, label: `칸${i}` })),
      ],
    });
    expect(s.menu.map((m) => m.label).slice(0, 2)).toEqual(["식물 찾기", "우리 학교"]);
    expect(s.menu.length).toBe(6);
    expect(s.menu[1].icon).toBe("•"); // 그림이 없으면 점
  });

  it("새 화면(pages): 영어 소문자 이름만, 카드·버튼 정리", () => {
    const s = normalizeSettings({
      pages: {
        school: { title: "우리 학교", cards: [{ title: "정문 화단", text: "팬지" }, {}], button: { label: "가기", href: "/" } },
        "우리학교": { title: "한글 이름은 주소로 못 써요" },
        help: { title: "도움말", button: { label: "나쁜", href: "javascript:x" } },
      },
    });
    expect(Object.keys(s.pages)).toEqual(["school", "help"]);
    expect(s.pages.school.cards).toEqual([{ title: "정문 화단", text: "팬지", sub: "" }]);
    expect(s.pages.school.button).toEqual({ label: "가기", href: "/" });
    expect(s.pages.help.button).toBeNull();
  });

  it("그림 도움말(terms): 빈 글은 무시", () => {
    const s = normalizeSettings({ terms: { "넓적한 잎": { desc: "넓어요." }, 그물맥: { desc: "" } } });
    expect(s.terms).toEqual({ "넓적한 잎": { desc: "넓어요." } });
  });
});

describe("공공데이터포털 API 연결 정보 (dataApi)", () => {
  const good = {
    service: "산림청 국립수목원_식물자원 조회 서비스",
    search: { url: "https://apis.data.go.kr/1400119/PlantResource/plantPilbkSearch", keywordParam: "reqSearchWrd", params: { pageNo: "1", numOfRows: "10", serviceKey: "몰래" } },
    detail: { url: "https://apis.data.go.kr/1400119/PlantResource/plantPilbkInfo", idParam: "reqPlantPilbkNo" },
  };
  it("주소·변수가 맞으면 연결 정보가 된다 (serviceKey 는 설정 파일에 못 넣음)", async () => {
    const { normalizeDataApi } = await import("@/lib/settings");
    const d = normalizeDataApi(good)!;
    expect(d.search.keywordParam).toBe("reqSearchWrd");
    expect(d.search.params).toEqual({ pageNo: "1", numOfRows: "10" });
    expect(d.fields.koreanName).toBe("plantGnrlNm"); // 항목 이름을 안 적으면 국립수목원 기본 이름
  });
  it("공공데이터포털 주소가 아니면 연결하지 않는다 (키가 다른 곳으로 새지 않게)", async () => {
    const { normalizeDataApi } = await import("@/lib/settings");
    expect(normalizeDataApi({ ...good, search: { ...good.search, url: "https://evil.example.com/x" } })).toBeNull();
    expect(normalizeDataApi({ ...good, detail: { url: good.detail.url } })).toBeNull();
    expect(normalizeDataApi(undefined)).toBeNull();
  });
  it("저장소 설정 파일에는 연결 정보가 들어 있다 (완성본)", () => {
    expect(SETTINGS.dataApi?.search.url).toBe("https://apis.data.go.kr/1400119/PlantResource/plantPilbkSearch");
  });
  it("연결 정보가 없으면 '아직 연결 안 됨' 안내 (503)", async () => {
    const m = await import("@/lib/server/datagokr");
    const saved = SETTINGS.dataApi;
    m.setDataApiForTest(null);
    const prev = process.env.MOCK;
    delete process.env.MOCK;
    const e = await m.searchPlants("연결안됨테스트", "key").catch((x) => x);
    expect(e.code).toBe("NOT_CONNECTED");
    const res = m.dataErrorResponse(e);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("NOT_CONNECTED");
    m.setDataApiForTest(saved);
    if (prev !== undefined) process.env.MOCK = prev;
  });
});
