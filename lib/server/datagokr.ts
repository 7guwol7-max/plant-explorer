/**
 * 산림청 국립수목원_식물자원 조회 서비스 (공공데이터포털)
 * 기본 주소: https://apis.data.go.kr/1400119/PlantResource
 *   GET /plantPilbkSearch  식물도감 목록 검색  (serviceKey, pageNo, numOfRows, reqSearchWrd)
 *   GET /plantPilbkInfo    식물도감 상세정보 조회 (serviceKey, reqPlantPilbkNo)
 * 응답은 XML 전용 → 여기서 JSON으로 변환한다.
 * 응답 구조: response > header(resultCode, resultMsg) > body > items > item[]  (상세는 body > item)
 */
import { XMLParser } from "fast-xml-parser";
import fs from "node:fs";
import path from "node:path";
import { isMock } from "./keys";

const BASE = "https://apis.data.go.kr/1400119/PlantResource";
const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });

export class DataGoKrError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "DataGoKrError";
  }
}

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

function parseXml(text: string): Parsed {
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

async function callXml(op: string, params: Record<string, string>, key: string): Promise<Parsed> {
  const url = new URL(`${BASE}/${op}`);
  // 디코딩 키를 넣고 여기서 한 번만 인코딩한다 (이중 인코딩 방지)
  url.search = new URLSearchParams({ serviceKey: key, ...params }).toString();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  let text: string;
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    text = await res.text();
  } catch {
    throw new DataGoKrError("NETWORK", "국립수목원 서버에 연결하지 못했어요");
  } finally {
    clearTimeout(timer);
  }
  return parseXml(text);
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

export const SOURCE = "국립수목원 국가생물종지식정보시스템";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSummary(it: any): PlantSummary {
  return {
    pilbkNo: str(it.plantPilbkNo),
    koreanName: str(it.plantGnrlNm),
    scientificName: str(it.plantSpecsScnm),
    family: str(it.familyKorNm),
    familyNm: str(it.familyNm),
    genus: str(it.genusKorNm),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDetail(it: any): PlantDetail {
  return {
    ...mapSummary(it),
    engNm: str(it.engNm),
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

export async function searchPlants(q: string, key: string): Promise<SearchResult> {
  const ck = `search:${q}`;
  const hit = fromCache<SearchResult>(ck);
  if (hit) return hit;

  let result: SearchResult;
  if (isMock()) {
    result = mockSearch(q);
  } else {
    const { code, body } = await callXml(
      "plantPilbkSearch",
      { pageNo: "1", numOfRows: "10", reqSearchWrd: q },
      key,
    );
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
    const { code, body } = await callXml("plantPilbkInfo", { reqPlantPilbkNo: no }, key);
    result = code === "03" || !body.item ? null : mapDetail(body.item);
  }
  toCache(ck, result);
  return result;
}

/** 라우트 공통 오류 응답 */
export function dataErrorResponse(e: unknown) {
  if (e instanceof DataGoKrError) {
    return Response.json({ error: "API_ERROR", code: e.code, message: e.message }, { status: 502 });
  }
  const msg = e instanceof Error ? e.message : "알 수 없는 오류";
  return Response.json({ error: "SERVER_ERROR", message: msg }, { status: 500 });
}
