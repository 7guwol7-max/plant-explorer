/**
 * 공공데이터포털 인증키 정리 (브라우저·서버 공용 순수 함수)
 * ─────────────────────────────────────────────
 * 사람마다 키를 다르게 붙여 넣는다. 어떤 모양이든 '디코딩 키' 하나로 맞춘다.
 *  - 일반 인증키(Decoding): 그대로 쓴다
 *  - 일반 인증키(Encoding): %2B 같은 글자가 섞여 있다 → 한 번 풀어 디코딩 키로 바꾼다
 *  - 미리보기 주소 통째로 (…?serviceKey=…&…): serviceKey 값만 꺼낸다
 *  - 앞뒤 공백·줄바꿈·따옴표: 지운다
 * 서버는 디코딩 키를 URLSearchParams 로 딱 한 번 인코딩해 보낸다 (이중 인코딩 방지).
 */
export type DataKeyKind = "empty" | "decoding" | "encoding" | "url";

export type DataKeyInfo = {
  key: string;        // 디코딩 키로 맞춘 값
  kind: DataKeyKind;  // 붙여 넣은 모양
  changed: boolean;   // 붙여 넣은 값과 달라졌는지
};

export function normalizeDataKey(raw: string | null | undefined): DataKeyInfo {
  const input = (raw ?? "").trim();
  let s = input.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
  let kind: DataKeyKind = "decoding";

  const m = /[?&]?serviceKey=([^&\s]+)/i.exec(s);
  if (m) {
    s = m[1];
    kind = "url";
  }

  s = s.replace(/\s+/g, "");
  if (!s) return { key: "", kind: "empty", changed: input !== "" };

  if (/%[0-9A-Fa-f]{2}/.test(s)) {
    try {
      s = decodeURIComponent(s);
      if (kind !== "url") kind = "encoding";
    } catch {
      /* 잘못된 % 표기면 그대로 둔다 */
    }
  }
  return { key: s, kind, changed: s !== input };
}

/** 제미나이 키: 공백·따옴표만 지운다 */
export function normalizeGeminiKey(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").replace(/\s+/g, "");
}
