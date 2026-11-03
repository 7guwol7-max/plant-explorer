/**
 * 사진 식별 요청의 사진 검사 (순수 함수)
 * - data URL(jpeg/png/webp)만, 최대 3장 (전체 모습·잎·꽃이나 열매)
 * - Vercel 함수의 요청 본문 한도(약 4.5MB) 안에 들도록 합계를 제한한다
 */
export const MAX_IMAGES = 3;
export const MAX_BASE64_EACH = 3_000_000;  // 한 장 약 2.2MB
export const MAX_BASE64_TOTAL = 4_200_000; // 합계 약 3.1MB

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

export type InlineImage = { mimeType: string; data: string };
export type ParsedImages =
  | { ok: true; images: InlineImage[] }
  | { ok: false; status: number; error: string; message: string };

/** { images: [...] } 또는 예전 형식 { image: "..." } 를 받는다 */
export function parseImages(body: { image?: unknown; images?: unknown }): ParsedImages {
  const raw: unknown[] = Array.isArray(body.images) ? body.images : body.image != null ? [body.image] : [];
  if (raw.length === 0) return { ok: false, status: 400, error: "NO_IMAGE", message: "사진이 없어요" };
  if (raw.length > MAX_IMAGES) return { ok: false, status: 400, error: "TOO_MANY", message: `사진은 ${MAX_IMAGES}장까지 보낼 수 있어요` };

  const images: InlineImage[] = [];
  let total = 0;
  for (const r of raw) {
    const m = typeof r === "string" ? DATA_URL.exec(r) : null;
    if (!m) return { ok: false, status: 400, error: "BAD_IMAGE", message: "jpeg/png/webp 사진만 보낼 수 있어요" };
    if (m[2].length > MAX_BASE64_EACH) return { ok: false, status: 413, error: "TOO_LARGE", message: "사진이 너무 커요" };
    total += m[2].length;
    images.push({ mimeType: m[1], data: m[2] });
  }
  if (total > MAX_BASE64_TOTAL) return { ok: false, status: 413, error: "TOO_LARGE", message: "사진을 합친 크기가 너무 커요. 한 장을 빼고 다시 해 보세요" };
  return { ok: true, images };
}
