/**
 * 국립수목원 도감에 '정말' 없는지 한 번 더 확인하기
 * 화면은 학생이 고른 이름 → 학명(속명 종소명) 순서로 이미 찾아보았다.
 * 여기서는 AI가 알려 준 바른 국명·다른 이름으로 다시 찾아본다.
 * - listedAs : 같은 식물이 다른 이름으로 실려 있으면 그 항목 (화면이 공식 정보로 안내)
 * - relatives: 실려 있지 않으면, 같은 속(무리)에 속한 도감 식물 몇 개 (비교용, 다른 식물임을 밝혀 보여 줌)
 * AI가 지어낸 이름으로 엉뚱한 식물에 연결되지 않도록,
 * 국명이 같아도 AI가 알려 준 속명과 도감 속명이 다르면 같은 식물로 보지 않는다.
 */
import type { PlantSummary } from "./datagokr";
import { looksScientific, sameSpecies, sciBinomial, sciGenus, squashName } from "../names";

export type LookupInput = {
  asked: { koreanName: string; scientificName: string }; // 화면이 이미 찾아본 이름
  ai: { koreanName: string; scientificName: string; otherNames: string[] };
};
export type LookupResult = { listedAs: PlantSummary | null; relatives: PlantSummary[]; searched: string[] };

export const MAX_LOOKUPS = 3;
export const MAX_RELATIVES = 5;

export async function lookupOtherNames(input: LookupInput, search: (q: string) => Promise<PlantSummary[]>): Promise<LookupResult> {
  const { asked, ai } = input;
  const genus = sciGenus(ai.scientificName) || sciGenus(asked.scientificName);

  // 같은 식물로 볼 이름들
  const koNames = new Set([ai.koreanName, ...ai.otherNames.filter((n) => !looksScientific(n))].map(squashName).filter(Boolean));
  const sciNames = [ai.scientificName, asked.scientificName, ...ai.otherNames.filter(looksScientific)].filter((n) => sciBinomial(n));

  const isSame = (it: PlantSummary) => {
    if (sciNames.some((n) => sameSpecies(n, it.scientificName))) return true;
    if (!koNames.has(squashName(it.koreanName))) return false;
    const g = sciGenus(it.scientificName);
    return !genus || !g || g.toLowerCase() === genus.toLowerCase();
  };

  // 새로 찾아볼 검색어 (화면이 이미 찾은 이름은 빼고, 최대 3번)
  const done = new Set([squashName(asked.koreanName), sciBinomial(asked.scientificName).toLowerCase()].filter(Boolean));
  const queries: string[] = [];
  for (const raw of [ai.koreanName, ...ai.otherNames, ai.scientificName]) {
    const q = looksScientific(raw) ? sciBinomial(raw) : raw.trim();
    const k = looksScientific(raw) ? q.toLowerCase() : squashName(q);
    if (!q || done.has(k)) continue;
    done.add(k);
    queries.push(q);
    if (queries.length >= MAX_LOOKUPS) break;
  }

  const safe = async (q: string) => {
    try {
      return await search(q);
    } catch {
      return []; // 다시 찾기가 실패해도 AI 정보는 보여 준다
    }
  };

  for (const q of queries) {
    const hit = (await safe(q)).find(isSame);
    if (hit) return { listedAs: hit, relatives: [], searched: queries };
  }

  let relatives: PlantSummary[] = [];
  if (genus) {
    relatives = (await safe(genus))
      .filter((it) => sciGenus(it.scientificName).toLowerCase() === genus.toLowerCase())
      .slice(0, MAX_RELATIVES);
    // 속명으로 찾았더니 같은 종이 나오면(예: 학명 표기 차이) 그것이 실린 항목이다
    const same = relatives.find(isSame);
    if (same) return { listedAs: same, relatives: [], searched: queries };
  }
  // searched 는 '이 식물의 이름'으로 찾아본 것만 (속명 찾기는 같은 무리 식물을 보여 주려는 것이라 빼고 알린다)
  return { listedAs: null, relatives, searched: queries };
}
