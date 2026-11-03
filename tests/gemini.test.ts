import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MODELS,
  GeminiError,
  classifyGeminiError,
  generate,
  geminiErrorResponse,
  modelCandidates,
  resetModelMemory,
  suggestedModel,
} from "@/lib/server/gemini";

const RETIRED_MSG =
  "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features";

type Reply = { status: number; body: unknown };
const ok = (json: unknown): Reply => ({ status: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] } });
const err = (status: number, message: string): Reply => ({ status, body: { error: { code: status, message } } });

/** 모델 이름별로 정해 둔 답을 돌려주는 가짜 fetch. 호출 순서를 기록한다. */
function fakeGoogle(replies: Record<string, Reply | ((body: { generationConfig: Record<string, unknown> }) => Reply)>) {
  const calls: { model: string; thinking: boolean }[] = [];
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const model = decodeURIComponent(/models\/([^:]+):generateContent/.exec(String(url))![1]);
    const body = JSON.parse(String(init?.body));
    calls.push({ model, thinking: Boolean(body.generationConfig.thinkingConfig) });
    const r = replies[model];
    const reply = typeof r === "function" ? r(body) : r ?? err(404, `models/${model} is not found`);
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

const SCHEMA = { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } } };

beforeEach(() => {
  resetModelMemory();
  delete process.env.GEMINI_MODEL;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("제미나이 오류 분류", () => {
  it("키 문제", () => {
    expect(classifyGeminiError(400, "API key not valid. Please pass a valid API key.")).toBe("key");
    expect(classifyGeminiError(401, "ACCESS_TOKEN_TYPE_UNSUPPORTED")).toBe("key");
    expect(classifyGeminiError(403, "PERMISSION_DENIED")).toBe("key");
  });
  it("은퇴·혼잡·한도", () => {
    expect(classifyGeminiError(404, RETIRED_MSG)).toBe("retired");
    expect(classifyGeminiError(503, "high demand")).toBe("busy");
    expect(classifyGeminiError(0, "timeout")).toBe("busy");
    expect(classifyGeminiError(429, "quota")).toBe("quota");
  });
  it("생각 설정을 모르는 모델", () => {
    expect(classifyGeminiError(400, "Unknown name \"thinkingLevel\" at 'generation_config.thinking_config'")).toBe("thinking");
  });
  it("구글이 알려 준 대체 모델 이름을 꺼낸다", () => {
    expect(suggestedModel(RETIRED_MSG)).toBe("gemini-3.8-flash");
    expect(suggestedModel("not found")).toBeUndefined();
  });
});

describe("모델 고르기", () => {
  it("기본 목록에 은퇴한 gemini-2.5-flash 가 없다", () => {
    expect(DEFAULT_MODELS).not.toContain("gemini-2.5-flash");
  });

  it("GEMINI_MODEL 을 먼저, 쉼표로 여러 개", () => {
    process.env.GEMINI_MODEL = "my-a, my-b";
    expect(modelCandidates().slice(0, 2)).toEqual(["my-a", "my-b"]);
  });

  it("은퇴(404)면 다음 모델로 넘어가 성공하고, 성공한 모델을 다음에 먼저 쓴다", async () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    const calls = fakeGoogle({
      "gemini-2.5-flash": err(404, RETIRED_MSG),
      "gemini-3.8-flash": ok({ ok: true }),
    });
    const r = await generate("AQ.test", [{ text: "x" }], SCHEMA);
    expect(r.model).toBe("gemini-3.8-flash"); // 구글 안내문의 대체 모델을 바로 시도
    expect(r.json).toEqual({ ok: true });
    expect(calls.map((c) => c.model)).toEqual(["gemini-2.5-flash", "gemini-3.8-flash"]);
    // 은퇴한 모델은 건너뛰고, 성공한 모델이 먼저
    expect(modelCandidates()[0]).toBe("gemini-3.8-flash");
    expect(modelCandidates()).not.toContain("gemini-2.5-flash");
  });

  it("혼잡(503)이면 다음 모델로", async () => {
    const [first, second] = DEFAULT_MODELS;
    const calls = fakeGoogle({ [first]: err(503, "high demand"), [second]: ok({ ok: true }) });
    const r = await generate("key", [{ text: "x" }], SCHEMA);
    expect(r.model).toBe(second);
    expect(calls.map((c) => c.model)).toEqual([first, second]);
  });

  it("키 문제면 다른 모델을 시도하지 않고 바로 멈춘다", async () => {
    const calls = fakeGoogle({ [DEFAULT_MODELS[0]]: err(400, "API key not valid. Please pass a valid API key.") });
    await expect(generate("bad", [{ text: "x" }], SCHEMA)).rejects.toMatchObject({ kind: "key" });
    expect(calls.length).toBe(1);
  });

  it("생각 설정을 거절하면 같은 모델에 설정 없이 다시 보낸다", async () => {
    const m = DEFAULT_MODELS[0];
    const calls = fakeGoogle({
      [m]: (body) => (body.generationConfig.thinkingConfig ? err(400, "Unknown name thinkingLevel in thinking_config") : ok({ ok: true })),
    });
    const r = await generate("key", [{ text: "x" }], SCHEMA);
    expect(r.model).toBe(m);
    expect(calls).toEqual([{ model: m, thinking: true }, { model: m, thinking: false }]);
  });

  it("모두 바쁘면 '바쁨'으로 알려 주고 시도한 모델을 적는다", async () => {
    fakeGoogle(Object.fromEntries(DEFAULT_MODELS.map((m) => [m, err(503, "high demand")])));
    const e = await generate("key", [{ text: "x" }], SCHEMA).catch((x) => x);
    expect(e).toBeInstanceOf(GeminiError);
    expect(e.kind).toBe("busy");
    expect(e.message).toContain(DEFAULT_MODELS[0]);
  });

  it("한도 초과가 섞여 있으면 한도 안내를 먼저 보여 준다", async () => {
    fakeGoogle(Object.fromEntries(DEFAULT_MODELS.map((m, i) => [m, i === 1 ? err(429, "quota") : err(404, "gone")])));
    const e = await generate("key", [{ text: "x" }], SCHEMA).catch((x) => x);
    expect(e.kind).toBe("quota");
  });
});

describe("오류 응답", () => {
  it("키 문제는 401 BAD_GEMINI_KEY (화면이 설정 안내를 띄움)", async () => {
    const res = geminiErrorResponse(new GeminiError(400, "API key not valid", "key"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("BAD_GEMINI_KEY");
  });
  it("그 밖은 502 GEMINI_ERROR 와 쉬운 안내문", async () => {
    const res = geminiErrorResponse(new GeminiError(503, "high demand", "busy"));
    expect(res.status).toBe(502);
    expect((await res.json()).message).toContain("바빠요");
  });
});
