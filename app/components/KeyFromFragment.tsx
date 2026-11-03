"use client";
import { useEffect } from "react";
import { saveKeys } from "@/lib/client/keys";
import { saveGrade } from "@/lib/client/prefs";
import { isGradeBand } from "@/lib/curriculum";

/**
 * 교사용 "학급 설정 QR" 처리
 * 주소가 /#k=<base64(JSON)> 로 열리면 키(와 학년)를 이 기기에 저장하고 주소에서 지운다.
 * 프래그먼트(# 뒤)는 브라우저가 서버로 보내지 않으므로 서버 기록에 남지 않는다.
 */
export default function KeyFromFragment() {
  useEffect(() => {
    const m = /^#k=([A-Za-z0-9+/=_-]+)$/.exec(window.location.hash || "");
    if (!m) return;
    try {
      const json = decodeURIComponent(atob(m[1].replace(/-/g, "+").replace(/_/g, "/")));
      const keys = JSON.parse(json) as { dataKey?: string; geminiKey?: string; grade?: string };
      saveKeys({ dataKey: keys.dataKey ?? "", geminiKey: keys.geminiKey ?? "" }, true);
      if (isGradeBand(keys.grade)) saveGrade(keys.grade);
      history.replaceState(null, "", window.location.pathname + window.location.search);
      alert("선생님이 보낸 설정이 이 기기에 저장되었어요. 이제 식물을 찾아볼까요?");
    } catch {
      /* 잘못된 링크는 무시 */
    }
  }, []);
  return null;
}
