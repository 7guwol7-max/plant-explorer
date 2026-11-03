/**
 * 우리 학교 앱 설정 — 저장소 맨 위의 app-settings.json 한 파일
 * ─────────────────────────────────────────────
 * 선생님은 이 파일 하나만 바꾸면 돼요. (클로드에게 이 파일을 첨부하고 바꿀 내용을 말하면
 * 파일 전체를 고쳐 줘요 → GitHub 에서 통째로 붙여 넣고 저장 → 1~2분 뒤 앱에 반영)
 *
 * - app: 앱 이름·짧은 이름·작은 글씨·그림 문자
 * - defaultGrade: 처음 학년 ("1-2" | "3-4" | "5-6")
 * - notice: 첫 화면 맨 위 안내 (빈 글자면 안 보임)
 * - menu: 맨 아래 메뉴 [{ href, icon, label }] — 새 화면은 href 를 "/p/이름" 으로
 * - places: '어디에서 찾았나요?' 장소 칩
 * - pages: 새 화면 { "이름": { title, intro, cards: [{ title, text, sub }], button: { label, href } } } → 주소 /p/이름
 * - terms: 그림 도움말 설명 바꾸기 { "넓적한 잎": { desc, examples } }
 * - curriculum: 성취기준 더하기·활동 바꾸기 (lib/curriculum.ts 의 mergeStandards 가 기본 자료와 합침)
 * - dataApi: 공공데이터포털 API 연결 정보 (요청 주소·요청 변수·응답 항목 이름). 비어 있으면 '아직 연결 안 됨'
 *   키는 여기에 쓰지 않는다 — 각자 앱 '설정' 화면에 넣는다
 *
 * 모양이 틀린 칸은 기본값으로 바꿔 앱이 멈추지 않게 한다. (JSON 문법이 틀리면 배포가 실패하고 앱은 직전 모습 그대로)
 */
import raw from "@/app-settings.json";

export type MenuItem = { href: string; icon: string; label: string };
export type PageCard = { title: string; text: string; sub: string };
export type InfoPage = { title: string; intro: string; cards: PageCard[]; button: { label: string; href: string } | null };
export type TermOverride = { desc?: string; examples?: string };
/** 공공데이터포털 API 연결 정보 (활용가이드의 요청 주소·요청 변수·응답 항목) */
export type DataApi = {
  service: string;
  search: { url: string; keywordParam: string; params: Record<string, string> };
  detail: { url: string; idParam: string };
  fields: { id: string; koreanName: string; scientificName: string; family: string; familyScientific: string; genus: string; englishName: string };
};

/** 키(serviceKey)가 다른 곳으로 새 나가지 않게, 공공데이터포털 주소만 받는다 */
export const DATA_API_PREFIX = "https://apis.data.go.kr/";
const PARAM = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;
const DEFAULT_FIELDS: DataApi["fields"] = {
  id: "plantPilbkNo",
  koreanName: "plantGnrlNm",
  scientificName: "plantSpecsScnm",
  family: "familyKorNm",
  familyScientific: "familyNm",
  genus: "genusKorNm",
  englishName: "engNm",
};

export function normalizeDataApi(input: unknown): DataApi | null {
  const d = obj(input);
  const s = obj(d.search);
  const t = obj(d.detail);
  const url = (v: unknown) => {
    const u = text(v);
    return u.startsWith(DATA_API_PREFIX) && !/[\s?#]/.test(u) ? u : "";
  };
  const searchUrl = url(s.url);
  const detailUrl = url(t.url);
  const keywordParam = text(s.keywordParam);
  const idParam = text(t.idParam);
  if (!searchUrl || !detailUrl || !PARAM.test(keywordParam) || !PARAM.test(idParam)) return null;
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(s.params))) {
    if (PARAM.test(k) && k.toLowerCase() !== "servicekey" && (typeof v === "string" || typeof v === "number")) params[k] = String(v);
  }
  const f = obj(d.fields);
  const fields = { ...DEFAULT_FIELDS };
  for (const k of Object.keys(DEFAULT_FIELDS) as (keyof DataApi["fields"])[]) {
    if (PARAM.test(text(f[k]))) fields[k] = text(f[k]);
  }
  return { service: text(d.service, "공공데이터포털 API"), search: { url: searchUrl, keywordParam, params }, detail: { url: detailUrl, idParam }, fields };
}

export type Settings = {
  app: { name: string; shortName: string; tagline: string; emoji: string };
  defaultGrade: "1-2" | "3-4" | "5-6";
  notice: string;
  menu: MenuItem[];
  places: string[];
  pages: Record<string, InfoPage>;
  terms: Record<string, TermOverride>;
  curriculum: unknown[];
  dataApi: DataApi | null;
};

export const DEFAULT_SETTINGS: Settings = {
  app: { name: "학교 식물 탐사대", shortName: "식물 탐사대", tagline: "AI 생태 탐사", emoji: "🌿" },
  defaultGrade: "3-4",
  notice: "",
  menu: [
    { href: "/", icon: "📷", label: "발견" },
    { href: "/search", icon: "🔍", label: "검색" },
    { href: "/my", icon: "📒", label: "나의 도감" },
    { href: "/settings", icon: "⚙️", label: "설정" },
  ],
  places: ["학교 운동장", "학교 화단", "학교 뒷산", "교실 화분", "집 근처", "기타"],
  pages: {},
  terms: {},
  curriculum: [],
  dataApi: null,
};

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const text = (v: unknown, fallback = "") => (typeof v === "string" && v.trim() ? v.trim() : fallback);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** 앱 안 주소만 (http 로 시작하는 바깥 주소도 허용하되 javascript: 같은 것은 막는다) */
const safeHref = (v: unknown) => {
  const h = text(v);
  return h.startsWith("/") || /^https?:\/\//.test(h) ? h : "";
};
/** 새 화면 이름: 영어 소문자·숫자·- 만 (주소에 쓰이므로) */
export const PAGE_SLUG = /^[a-z0-9][a-z0-9-]{0,40}$/;

export function normalizeSettings(input: unknown): Settings {
  const s = obj(input);
  const d = DEFAULT_SETTINGS;
  const a = obj(s.app);

  const menu = list(s.menu)
    .map((m) => obj(m))
    .map((m) => ({ href: safeHref(m.href), icon: text(m.icon, "•"), label: text(m.label) }))
    .filter((m) => m.href && m.label)
    .slice(0, 6);

  const places = [...new Set(list(s.places).map((p) => text(p)).filter(Boolean))].slice(0, 12);

  const pages: Record<string, InfoPage> = {};
  for (const [slug, v] of Object.entries(obj(s.pages))) {
    if (!PAGE_SLUG.test(slug)) continue;
    const p = obj(v);
    const b = obj(p.button);
    const btnHref = safeHref(b.href);
    pages[slug] = {
      title: text(p.title, slug),
      intro: text(p.intro),
      cards: list(p.cards)
        .map((c) => obj(c))
        .map((c) => ({ title: text(c.title), text: text(c.text), sub: text(c.sub) }))
        .filter((c) => c.title || c.text)
        .slice(0, 30),
      button: text(b.label) && btnHref ? { label: text(b.label), href: btnHref } : null,
    };
  }

  const terms: Record<string, TermOverride> = {};
  for (const [k, v] of Object.entries(obj(s.terms))) {
    const t = obj(v);
    const o: TermOverride = {};
    if (text(t.desc)) o.desc = text(t.desc);
    if (text(t.examples)) o.examples = text(t.examples);
    if (o.desc || o.examples) terms[k] = o;
  }

  const g = s.defaultGrade;
  return {
    app: {
      name: text(a.name, d.app.name),
      shortName: text(a.shortName, text(a.name, d.app.shortName)),
      tagline: typeof a.tagline === "string" ? a.tagline.trim() : d.app.tagline,
      emoji: text(a.emoji, d.app.emoji),
    },
    defaultGrade: g === "1-2" || g === "3-4" || g === "5-6" ? g : d.defaultGrade,
    notice: text(s.notice),
    menu: menu.length ? menu : d.menu,
    places: places.length ? places : d.places,
    pages,
    terms,
    curriculum: list(s.curriculum),
    dataApi: normalizeDataApi(s.dataApi),
  };
}

export const SETTINGS: Settings = normalizeSettings(raw);

/** GitHub 에서 이 파일을 고치는 주소 (선생님 모드의 '앱 고치기' 버튼) */
export const SETTINGS_FILE = "app-settings.json";
