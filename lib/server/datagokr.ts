/**
 * 산림청 국립수목원_식물자원 조회 서비스 (공공데이터포털)
 * 어느 주소를 어떤 요청 변수로 부를지는 app-settings.json 의 dataApi 에 적는다 (연수: 프롬프트로 연결하기)
 *   목록 검색: https://apis.data.go.kr/1400119/PlantResource/plantPilbkSearch  (serviceKey, pageNo, numOfRows, reqSearchWrd)
 *   상세 정보: https://apis.data.go.kr/1400119/PlantResource/plantPilbkInfo    (serviceKey, reqPlantPilbkNo)
 * dataApi 가 비어 있으면 NOT_CONNECTED 오류로 '아직 연결 안 됨'을 알린다. 연습 모드(MOCK=1)는 samples/ 를 쓴다.
 * 응답은 XML 전용 → 여기서 JSON으로 변환한다.
 * 응답 구조: response > header(resultCode, resultMsg) > body > items > item[]  (상세는 body > item)
 */
import { XMLParser } from "fast-xml-parser";
import fs from "node:fs";
import path from "node:path";
import { isMock } from "./keys";
import { SOURCE_NAME } from "../fields";
import { SETTINGS, type DataApi } from "../settings";

/** 연결 정보 (테스트에서 바꿔 끼울 수 있게 함수로) */
let dataApi: DataApi | null = SETTINGS.dataApi;
export function setDataApiForTest(d: DataApi | null) {
  dataApi = d;
}
function requireDataApi(): DataApi {
  if (!dataApi) throw new DataGoKrError("NOT_CONNECTED", DATA_CODE_MSG.NOT_CONNECTED);
  return dataApi;
}
const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });

export class DataGoKrError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "DataGoKrError";
  }
}

/**
 * 공공데이터포털 결과코드 → 사용자 안내문
 * (키를 처음 넣는 사람이 가장 많이 막히는 곳이라 '어디서 무엇을 확인할지'까지 적는다)
 */
export const DATA_CODE_MSG: Record<string, string> = {
  "20": "이 키로 '국립수목원_식물자원 조회 서비스'를 쓸 권한이 없어요. 다른 API로 받은 키여도 이 서비스는 따로 활용신청을 해야 해요. 공공데이터포털 마이페이지에서 신청·승인 상태를 확인하세요.",
  "22": "오늘 호출 한도(개발계정 하루 1,000건)를 넘었어요. 내일 다시 시도하거나 다른 키를 쓰세요.",
  "30": "등록되지 않은 키예요. 마이페이지의 '일반 인증키'를 빠짐없이 복사했는지 확인하세요. 방금 신청했다면 키가 반영될 때까지 시간이 걸릴 수 있어요.",
  "31": "키 사용 기간이 끝났어요. 공공데이터포털 마이페이지에서 활용 기간을 연장하세요.",
  "32": "등록되지 않은 IP에서 호출했어요. 공공데이터포털 마이페이지의 활용신청 정보에서 IP 제한을 확인하세요.",
  AUTH: "공공데이터포털이 키를 받아 주지 않았어요. 키를 다시 복사해 넣거나, 활용신청이 승인됐는지 확인하세요.",
  "10": "요청 형식 오류예요. (서버 코드 점검 필요)",
  "11": "필수 요청 값이 빠졌어요. (서버 코드 점검 필요)",
  "12": "서비스 주소를 찾지 못했어요. (서버 코드 점검 필요)",
  "05": "국립수목원 서버가 응답하지 않아요. 잠시 후 다시 시도하세요.",
  NETWORK: "국립수목원 서버에 연결하지 못했어요. 인터넷 연결을 확인하세요.",
  PARSE: "국립수목원 응답을 해석하지 못했어요. 잠시 후 다시 시도하세요.",
  NOT_CONNECTED: "국립수목원 API가 아직 이 앱에 연결되지 않았어요. 선생님 모드의 '✏️ 프롬프트로 앱 고치기'에서 app-settings.json 의 dataApi(요청 주소·요청 변수)를 채우면 연결돼요.",
};

/** 사용자가 키 설정을 고쳐야 해결되는 오류 */
export const KEY_ERROR_CODES = new Set(["20", "30", "31", "32", "AUTH"]);

export const friendlyDataMessage = (e: DataGoKrError) => DATA_CODE_MSG[e.code] ?? e.message;

/* ───────── 캐시: 검색어·도감번호 기준, 키와 무관 (공개 데이터) ───────── */
type CacheEntry = { at: number; value: unknown };
const g = globalThis as unknown as { __plantCache?: Map<string, CacheEntry> };
const cache = (g.__plantCache ??= new Map<string, CacheEntry>());
const TTL = 24 * 60 * 60 * 1000;

function fromCache<T>(key: string): T | undefined {
  const e = cache.get(key);
  if (e && Date.now() - e.at < TTL) return e.value as T;
  cache.delete(key);
  return undefined;
}
function toCache(key: string, value: unknown) {
  cache.set(key, { at: Date.now(), value });
}

/* ───────── 공용 유틸 ───────── */
const arr = <T,>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const str = (v: unknown) => (v == null ? "" : String(v).trim());

type Parsed = { code: string; body: Record<string, unknown> };

export function parseXml(text: string): Parsed {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = parser.parse(text);

  // 게이트웨이(인증) 오류는 다른 뿌리 요소로 온다
  if (doc?.OpenAPI_ServiceResponse) {
    const h = doc.OpenAPI_ServiceResponse.cmmMsgHeader ?? {};
    throw new DataGoKrError(str(h.returnReasonCode) || "GW", str(h.returnAuthMsg || h.errMsg) || "게이트웨이 오류");
  }
  if (!doc?.response) {
    throw new DataGoKrError("PARSE", "응답 형식을 해석하지 못했어요");
  }
  const header = doc.response.header ?? {};
  const code = str(header.resultCode);
  // 00 정상, 03 데이터 없음 → 둘 다 정상 흐름으로 처리
  if (code !== "00" && code !== "03") {
    throw new DataGoKrError(code || "UNKNOWN", str(header.resultMsg) || "국립수목원 응답 오류");
  }
  return { code, body: doc.response.body ?? {} };
}

async function callXml(endpoint: string, params: Record<string, string>, key: string): Promise<Parsed> {
  const url = new URL(endpoint);
  // 디코딩 키를 넣고 여기서 한 번만 인코딩한다 (이중 인코딩 방지)
  url.search = new URLSearchParams({ serviceKey: key, ...params }).toString();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  let text: string;
  let status: number;
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    status = res.status;
    text = await res.text();
  } catch {
    throw new DataGoKrError("NETWORK", "국립수목원 서버에 연결하지 못했어요");
  } finally {
    clearTimeout(timer);
  }
  return parseXml(guardNonXml(text, status));
}

/**
 * 게이트웨이가 XML 대신 짧은 글(예: "Unauthorized")이나 빈 응답을 줄 때가 있다.
 * HTTP 상태와 글귀로 결과코드를 추정해 같은 안내문으로 보낸다.
 */
export function guardNonXml(text: string, status: number): string {
  if (text.trim().startsWith("<")) return text;
  if (status === 401 || status === 403 || /unauthori[sz]ed|forbidden|not.?registered|invalid.?key/i.test(text)) {
    throw new DataGoKrError("AUTH", text.slice(0, 120) || `HTTP ${status}`);
  }
  if (status === 429) throw new DataGoKrError("22", "호출 한도 초과");
  if (status >= 500) throw new DataGoKrError("05", `HTTP ${status}`);
  throw new DataGoKrError("PARSE", text.slice(0, 120) || `HTTP ${status}`);
}

/* ───────── 자료형 ───────── */
export type PlantSummary = {
  pilbkNo: string;
  koreanName: string;
  scientificName: string;
  family: string;
  familyNm: string;
  genus: string;
};

export type PlantDetail = PlantSummary & {
  engNm: string;
  shpe: string;          // 형태
  spft: string;          // 특징
  grwEvrntDesc: string;  // 생육환경
  dstrb: string;         // 분포
  osDstrb: string;       // 해외분포
  rrngType: string;      // 생육형
  rrngGubun: string;     // 생육상 구분
  smlrPlntDesc: string;  // 유사종
  useMthdDesc: string;   // 이용방안
  prtcPlnDesc: string;   // 보호방안
  orplcNm: string;       // 원산지
  inductionDesc: string; // 도입여부
  source: string;
  mock?: boolean;
};

export const SOURCE = SOURCE_NAME;

/** 응답 항목 이름 — 연결 정보(dataApi.fields)에 적은 이름, 없으면 국립수목원 기본 이름 */
const F = () =>
  dataApi?.fields ?? { id: "plantPilbkNo", koreanName: "plantGnrlNm", scientificName: "plantSpecsScnm", family: "familyKorNm", familyScientific: "familyNm", genus: "genusKorNm", englishName: "engNm" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSummary(it: any): PlantSummary {
  const f = F();
  return {
    pilbkNo: str(it[f.id]),
    koreanName: str(it[f.koreanName]),
    scientificName: str(it[f.scientificName]),
    family: str(it[f.family]),
    familyNm: str(it[f.familyScientific]),
    genus: str(it[f.genus]),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDetail(it: any): PlantDetail {
  return {
    ...mapSummary(it),
    engNm: str(it[F().englishName]),
    shpe: str(it.shpe),
    spft: str(it.spft),
    grwEvrntDesc: str(it.grwEvrntDesc),
    dstrb: str(it.dstrb),
    osDstrb: str(it.osDstrb),
    rrngType: str(it.rrngType),
    rrngGubun: str(it.rrngGubun),
    smlrPlntDesc: str(it.smlrPlntDesc),
    useMthdDesc: str(it.useMthdDesc),
    prtcPlnDesc: str(it.prtcPlnDesc),
    orplcNm: str(it.orplcNm),
    inductionDesc: str(it.inductionDesc),
    source: SOURCE,
  };
}

/* ───────── 모의 모드 (samples/ 폴더) ───────── */
function readSample(name: string) {
  return fs.readFileSync(path.join(process.cwd(), "samples", name), "utf8");
}

function mockSearch(q: string) {
  const { body } = parseXml(readSample("plantPilbkSearch.xml"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = arr((body.items as any)?.item).map(mapSummary);
  const lq = q.toLowerCase();
  const items = all.filter(
    (i) => !q || i.koreanName.includes(q) || i.scientificName.toLowerCase().includes(lq),
  );
  return { items, totalCount: items.length, mock: true };
}

function mockDetail(no: string): PlantDetail | null {
  const file = path.join(process.cwd(), "samples", `plantPilbkInfo_${no}.xml`);
  if (!fs.existsSync(file)) return null;
  const { body } = parseXml(fs.readFileSync(file, "utf8"));
  return { ...mapDetail(body.item), mock: true };
}

/* ───────── 공개 함수 ───────── */
export type SearchResult = { items: PlantSummary[]; totalCount: number; mock?: boolean };

/**
 * opts.fresh: 캐시를 건너뛰고 실제로 호출한다.
 * (설정 화면의 '연결 확인'은 키가 맞는지 보는 것이므로, 다른 사람이 채운 캐시로 성공을 알리면 안 된다)
 */
export async function searchPlants(q: string, key: string, opts: { fresh?: boolean } = {}): Promise<SearchResult> {
  const ck = `search:${q}`;
  const hit = opts.fresh ? undefined : fromCache<SearchResult>(ck);
  if (hit) return hit;

  let result: SearchResult;
  if (isMock()) {
    result = mockSearch(q);
  } else {
    const api = requireDataApi();
    const { code, body } = await callXml(api.search.url, { pageNo: "1", numOfRows: "10", ...api.search.params, [api.search.keywordParam]: q }, key);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = code === "03" ? [] : arr((body.items as any)?.item).map(mapSummary);
    const total = Number(body.totalCount ?? items.length);
    result = { items, totalCount: Number.isFinite(total) ? total : items.length };
  }
  toCache(ck, result);
  return result;
}

export async function getPlantDetail(no: string, key: string): Promise<PlantDetail | null> {
  const ck = `detail:${no}`;
  const hit = fromCache<PlantDetail | null>(ck);
  if (hit !== undefined) return hit;

  let result: PlantDetail | null;
  if (isMock()) {
    result = mockDetail(no);
  } else {
    const api = requireDataApi();
    const { code, body } = await callXml(api.detail.url, { [api.detail.idParam]: no }, key);
    result = code === "03" || !body.item ? null : mapDetail(body.item);
  }
  toCache(ck, result);
  return result;
}

/**
 * 라우트 공통 오류 응답
 * 키 문제(BAD_DATA_KEY)는 401 로 보내 화면이 '키 설정 확인' 안내를 함께 띄우게 한다.
 */
export function dataErrorResponse(e: unknown) {
  if (e instanceof DataGoKrError) {
    const bad = KEY_ERROR_CODES.has(e.code);
    const notConnected = e.code === "NOT_CONNECTED";
    return Response.json(
      { error: bad ? "BAD_DATA_KEY" : notConnected ? "NOT_CONNECTED" : "API_ERROR", code: e.code, message: friendlyDataMessage(e) },
      { status: bad ? 401 : notConnected ? 503 : 502 },
    );
  }
  const msg = e instanceof Error ? e.message : "알 수 없는 오류";
  return Response.json({ error: "SERVER_ERROR", message: msg }, { status: 500 });
}
