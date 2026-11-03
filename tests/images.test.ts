import { describe, expect, it } from "vitest";
import { MAX_BASE64_EACH, MAX_BASE64_TOTAL, MAX_IMAGES, parseImages } from "@/lib/server/images";

const jpg = (n = 100) => `data:image/jpeg;base64,${"A".repeat(n)}`;

describe("사진 식별 요청의 사진 검사", () => {
  it("여러 장(최대 3장)을 받는다", () => {
    const r = parseImages({ images: [jpg(), jpg(), jpg()] });
    expect(r.ok && r.images.length).toBe(3);
    expect(r.ok && r.images[0]).toEqual({ mimeType: "image/jpeg", data: "A".repeat(100) });
  });

  it("예전 형식(image 한 장)도 받는다", () => {
    const r = parseImages({ image: "data:image/png;base64,QUJD" });
    expect(r.ok && r.images).toEqual([{ mimeType: "image/png", data: "QUJD" }]);
  });

  it(`${MAX_IMAGES}장을 넘으면 거절`, () => {
    const r = parseImages({ images: Array(MAX_IMAGES + 1).fill(jpg()) });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe("TOO_MANY");
  });

  it("사진이 없으면 거절", () => {
    expect(parseImages({}).ok).toBe(false);
    expect(parseImages({ images: [] }).ok).toBe(false);
  });

  it("jpeg/png/webp data URL 이 아니면 거절", () => {
    for (const bad of ["data:image/gif;base64,QUJD", "https://example.com/a.jpg", 123, null]) {
      const r = parseImages({ images: [bad] });
      expect(!r.ok && r.error).toBe("BAD_IMAGE");
    }
  });

  it("한 장이 너무 크거나, 합계가 너무 크면 413", () => {
    const one = parseImages({ images: [jpg(MAX_BASE64_EACH + 4)] });
    expect(!one.ok && one.status).toBe(413);
    const each = Math.floor(MAX_BASE64_TOTAL / 2) + 4; // 두 장 합이 한도를 살짝 넘게
    const sum = parseImages({ images: [jpg(each), jpg(each)] });
    expect(!sum.ok && sum.status).toBe(413);
  });
});
