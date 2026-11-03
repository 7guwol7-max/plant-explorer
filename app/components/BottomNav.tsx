"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", ico: "📷", label: "발견" },
  { href: "/search", ico: "🔍", label: "검색" },
  { href: "/my", ico: "📒", label: "나의 도감" },
  { href: "/settings", ico: "⚙️", label: "설정" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="bottom-nav">
      <div className="inner">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={path === it.href ? "active" : ""}>
            <span className="ico">{it.ico}</span>
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
