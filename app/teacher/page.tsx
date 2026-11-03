"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { loadKeys } from "@/lib/client/keys";
import { loadGrade } from "@/lib/client/prefs";
import { GRADE_LABEL, type GradeBand } from "@/lib/curriculum";

/**
 * 교사용 학급 설정 QR
 * 이 기기에 저장된 키와 학년을 주소의 프래그먼트(#k=…)에 담은 링크를 QR로 보여준다.
 * 학생 기기가 QR을 찍어 열면 KeyFromFragment 가 키를 저장하고 주소에서 지운다.
 * 프래그먼트는 서버로 전송되지 않는다. 단, 학생이 주소를 열어 보면 키가 보이므로
 * 제미나이 키는 결제 미연결 프로젝트의 키만 쓰는 것이 안전하다.
 */
export default function TeacherPage() {
  const [link, setLink] = useState<string>("");
  const [qr, setQr] = useState<string>("");
  const [has, setHas] = useState(false);
  const [copied, setCopied] = useState(false);
  const [grade, setGrade] = useState<GradeBand>("3-4");

  useEffect(() => {
    const k = loadKeys();
    const g = loadGrade();
    setGrade(g);
    if (!k.dataKey && !k.geminiKey) return;
    setHas(true);
    const payload = JSON.stringify({ dataKey: k.dataKey ?? "", geminiKey: k.geminiKey ?? "", grade: g });
    const b64 = btoa(encodeURIComponent(payload)).replace(/\+/g, "-").replace(/\//g, "_");
    const url = `${window.location.origin}/#k=${b64}`;
    setLink(url);
    QRCode.toDataURL(url, { width: 480, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <>
      <div className="card">
        <h2>👩‍🏫 학급 설정 QR</h2>
        <p className="small">학생 기기(태블릿·휴대폰)로 이 QR을 찍으면 선생님 키와 학년({GRADE_LABEL[grade]})이 그 기기에 저장돼요. 키를 한 대씩 입력할 필요가 없어요.</p>
        {!has && <div className="alert warn">먼저 <Link href="/settings" className="link">설정 화면</Link>에서 키를 저장하세요.</div>}
        {has && qr && <img className="qr" src={qr} alt="학급 설정 QR" />}
        {has && (
          <div className="stack">
            <button className="btn btn-sm" onClick={copy}>{copied ? "복사됨 ✓" : "링크 복사"}</button>
            <p className="muted small">링크 끝의 <code className="inline">#k=…</code> 부분에 키가 들어 있어요. 학급 안에서만 공유하고, 공개 게시판에 올리지 마세요.</p>
          </div>
        )}
      </div>
      <div className="card">
        <h2>수업 전 점검</h2>
        <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
          <li>학생 기기 한 대로 QR을 찍어 머리글 상태가 "연결됨"이 되는지 확인</li>
          <li>국립수목원 호출 한도: 개발계정 하루 1,000건 — 한 반 25명이 식물 2~3종씩 찾으면 충분, 같은 식물은 서버가 기억해 호출을 아껴요</li>
          <li>공용 컴퓨터에서는 설정에서 "이번만 사용"을 고르거나 수업 후 "키 삭제"</li>
          <li>학생마다 자기 키를 쓰게 하려면 QR 대신 설정 화면의 '키 받는 방법'을 따라 각자 넣으면 돼요</li>
        </ul>
      </div>
      <div className="card">
        <h2>교육과정 연결표</h2>
        <p className="small" style={{ margin: 0 }}>학년별로 어떤 성취기준과 이어지는지, 해설 원문과 함께 볼 수 있어요. <Link href="/curriculum" className="link">교육과정 연결표 →</Link></p>
      </div>
    </>
  );
}
