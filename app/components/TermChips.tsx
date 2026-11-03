"use client";
import { useEffect, useState } from "react";
import TermIcon from "./TermIcon";
import { TERMS, TERM_GROUP_HINT, TERM_GROUP_TITLE } from "@/lib/terms";

/** 설명이 아직 비어 있을 때 (lib/termText.ts 의 desc 가 "" 이거나 낱말이 빠졌을 때) */
const NO_DESC = "아직 설명이 없어요. 그림을 보고 골라요.";

type Group = "leafShape" | "leafVein" | "stem";

/**
 * 관찰 낱말 고르기 + 그림 도움말
 * - 선택지마다 작은 그림이 붙어 있어 낱말을 몰라도 고를 수 있다
 * - 컴퓨터: 마우스를 올리면(또는 키보드로 가면) 큰 그림과 설명이 뜬다
 * - 휴대폰·태블릿: '❓ 그림으로 알아보기' 를 누르면 큰 그림 설명 창이 열리고, 거기서 바로 고를 수 있다
 */
export default function TermChips({
  group,
  options,
  value,
  onPick,
}: {
  group: Group;
  options: string[];
  value: string;
  onPick: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const title = TERM_GROUP_TITLE[group];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="term-head">
        <h3>{title}</h3>
        <button type="button" className="help-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">❓ 그림으로 알아보기</button>
      </div>
      <div className="chips">
        {options.map((o) => {
          const t = TERMS[o];
          return (
            <button key={o} type="button" className={`chip term-chip ${value === o ? "on" : ""}`} onClick={() => onPick(o)} aria-pressed={value === o}>
              <TermIcon name={o} size={22} />
              {o}
              {t && o !== "모름" && (
                <span className="tip" role="tooltip">
                  <TermIcon name={o} size={88} />
                  <strong>{o}</strong>
                  <span>{t.desc || NO_DESC}</span>
                  {t.examples && <em>예: {t.examples}</em>}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {open && (
        <div className="term-overlay" role="dialog" aria-modal="true" aria-label={`${title} 그림으로 알아보기`} onClick={() => setOpen(false)}>
          <div className="term-box" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>🔎 {title}, 그림으로 알아봐요</h2>
              <button className="btn btn-sm btn-ghost" onClick={() => setOpen(false)} aria-label="닫기">✕</button>
            </div>
            <p className="muted small">{TERM_GROUP_HINT[group]}</p>
            <div className="term-grid">
              {options.map((o) => {
                const t = TERMS[o];
                return (
                  <button key={o} type="button" className={`term-card ${value === o ? "on" : ""}`} onClick={() => { onPick(o); setOpen(false); }}>
                    <TermIcon name={o} size={72} />
                    <strong>{o}</strong>
                    <span className="small">{t?.desc || NO_DESC}</span>
                    {t?.examples && <em className="small">예: {t.examples}</em>}
                    <span className="pick">{value === o ? "✓ 골랐어요" : "이걸로 고르기"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
