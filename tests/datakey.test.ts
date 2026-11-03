import { describe, expect, it } from "vitest";
import { normalizeDataKey, normalizeGeminiKey } from "@/lib/datakey";
import { DataGoKrError, guardNonXml, parseXml, KEY_ERROR_CODES, dataErrorResponse } from "@/lib/server/datagokr";

// 실제 키가 아닌 시험용 가짜 키 (디코딩 모양: + / = 가 섞여 있음)
const DECODED = "Ab+cD/eF12==";
const ENCODED = "Ab%2BcD%2FeF12%3D%3D";

describe("공공데이터포털 키 정리", () => {
  it("디코딩 키는 그대로 둔다", () => {
    expect(normalizeDataKey(DECODED)).toEqual({ key: DECODED, kind: "decoding", changed: false });
  });

  it("인코딩 키를 넣으면 디코딩 키로 바꾼다", () => {
    const r = normalizeDataKey(ENCODED);
    expect(r.key).toBe(DECODED);
    expect(r.kind).toBe("encoding");
    expect(r.changed).toBe(true);
  });

  it("미리보기 주소를 통째로 넣으면 serviceKey 값만 꺼낸다", () => {
    const url = `https://apis.data.go.kr/1400119/PlantResource/plantPilbkSearch?serviceKey=${ENCODED}&reqSearchWrd=%EC%86%8C%EB%82%98%EB%AC%B4`;
    const r = normalizeDataKey(url);
    expect(r.key).toBe(DECODED);
    expect(r.kind).toBe("url");
  });

  it("앞뒤 공백·줄바꿈·따옴표를 지운다", () => {
    expect(normalizeDataKey(`  "${DECODED}"\n`).key).toBe(DECODED);
    expect(normalizeDataKey("Ab+cD/\neF12==").key).toBe(DECODED);
  });

  it("빈 값은 empty", () => {
    expect(normalizeDataKey("   ").kind).toBe("empty");
    expect(normalizeDataKey(undefined).key).toBe("");
  });

  it("잘못된 % 표기는 그대로 둔다", () => {
    expect(normalizeDataKey("abc%E0%A4%A").key).toBe("abc%E0%A4%A");
  });

  it("서버로 보낼 때 한 번만 인코딩된다 (이중 인코딩 없음)", () => {
    const q = new URLSearchParams({ serviceKey: normalizeDataKey(ENCODED).key }).toString();
    expect(q).toBe(`serviceKey=${ENCODED}`);
  });

  it("제미나이 키는 공백만 지운다", () => {
    expect(normalizeGeminiKey("  AIzaTEST  ")).toBe("AIzaTEST");
  });
});

describe("국립수목원 응답 오류 처리", () => {
  it("게이트웨이 인증 오류(30)를 키 문제로 분류한다", () => {
    const xml = `<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`;
    try {
      parseXml(xml);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DataGoKrError);
      expect((e as DataGoKrError).code).toBe("30");
      expect(KEY_ERROR_CODES.has("30")).toBe(true);
    }
  });

  it("키 문제는 401 BAD_DATA_KEY 로, 친절한 안내문과 함께 보낸다", async () => {
    const res = dataErrorResponse(new DataGoKrError("20", "SERVICE_ACCESS_DENIED_ERROR"));
    expect(res.status).toBe(401);
    const j = await res.json();
    expect(j.error).toBe("BAD_DATA_KEY");
    expect(j.message).toContain("활용신청");
  });

  it("키와 무관한 오류는 502 API_ERROR", async () => {
    const res = dataErrorResponse(new DataGoKrError("05", "timeout"));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("API_ERROR");
  });

  it("XML이 아닌 Unauthorized 응답은 AUTH(키 문제)로 본다", () => {
    expect(() => guardNonXml("Unauthorized", 401)).toThrowError(DataGoKrError);
    try {
      guardNonXml("Unauthorized", 401);
    } catch (e) {
      expect((e as DataGoKrError).code).toBe("AUTH");
    }
  });

  it("XML 응답은 그대로 통과시킨다", () => {
    expect(guardNonXml("<response/>", 200)).toBe("<response/>");
  });

  it("정상(00)·데이터 없음(03)은 오류가 아니다", () => {
    expect(parseXml("<response><header><resultCode>03</resultCode></header><body/></response>").code).toBe("03");
  });
});
