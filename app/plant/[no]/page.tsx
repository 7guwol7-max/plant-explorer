import PlantDetail from "@/app/components/PlantDetail";

/** /plant/[도감번호] — 확인(③) + 기록(④) 화면 */
export default async function PlantPage({ params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  return <PlantDetail no={decodeURIComponent(no)} />;
}
