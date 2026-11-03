import Link from "next/link";
import { notFound } from "next/navigation";
import { SETTINGS } from "@/lib/settings";
import { SITE } from "@/lib/site";

/**
 * /p/이름 — app-settings.json 의 pages 로 만드는 안내 화면 (우리 학교 소개, 사용법, 관찰 장소 지도 등)
 * 코드 없이 설정 파일에 { title, intro, cards, button } 만 적으면 화면이 생긴다.
 */
export function generateStaticParams() {
  return Object.keys(SETTINGS.pages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = SETTINGS.pages[slug];
  return { title: page ? `${page.title} · ${SITE.name}` : SITE.name };
}

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = SETTINGS.pages[slug];
  if (!page) notFound();
  return (
    <>
      <div className="card">
        <h2 style={{ margin: 0 }}>{page.title}</h2>
        {page.intro && <p className="small" style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{page.intro}</p>}
      </div>
      {page.cards.map((c, i) => (
        <div className="card info-card" key={i}>
          {c.title && <h3>{c.title}</h3>}
          {c.text && <p style={{ whiteSpace: "pre-wrap" }}>{c.text}</p>}
          {c.sub && <p className="muted small sub">{c.sub}</p>}
        </div>
      ))}
      {page.button && (
        <Link href={page.button.href} className="btn btn-primary">{page.button.label}</Link>
      )}
    </>
  );
}
