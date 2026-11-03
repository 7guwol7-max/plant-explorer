import UnlistedPlant from "@/app/components/UnlistedPlant";
import { SITE } from "@/lib/site";

export const metadata = { title: `국립수목원 도감에 없는 식물 · ${SITE.name}` };

/** /unlisted?name=페튜니아&sci=Petunia… — 국립수목원 식물도감에서 찾지 못한 식물 (③ 확인 + ④ 기록) */
export default async function UnlistedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v ?? "").trim();
  return <UnlistedPlant name={one(sp.name).slice(0, 40)} sci={one(sp.sci).slice(0, 80)} />;
}
