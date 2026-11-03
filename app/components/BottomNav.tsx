"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE } from "@/lib/site";

/** 화면 맨 아래 메뉴 — 메뉴 이름·그림·순서는 lib/site.ts 의 menu 에서 고친다 */
export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="bottom-nav">
      <div className="inner">
        {SITE.menu.map((it) => (
          <Link key={it.href} href={it.href} className={path === it.href ? "active" : ""}>
            <span className="ico">{it.icon}</span>
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
