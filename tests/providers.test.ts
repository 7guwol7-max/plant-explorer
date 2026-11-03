import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectProvider, normalizeAiKey } from "@/lib/ai";
import { generateClaude } from "@/lib/server/ai/claude";
import { generateOpenAI, OPENAI_MODELS } from "@/lib/server/ai/openai";
import { resetModelMemory } from "@/lib/server/ai/chain";
import { AiError } from "@/lib/server/ai/errors";
import { EXPLAIN_SCHEMA, IDENTIFY_SCHEMA, UNLISTED_SCHEMA, GRADE_STYLE, explainPrompt } from "@/lib/server/ai/tasks";
import { getKeys } from "@/lib/server/keys";
import type { JsonSchema } from "@/lib/server/ai/types";

const SCHEMA: JsonSchema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false };
const IMG = { mimeType: "image/jpeg", data: "QUJD" };

type Seen = { url: string; headers: Headers; body: Record<string, unknown> };
function fakeFetch(reply: (seen: Seen, n: number) => { status: number; body: unknown; headers?: Record<string, string> }) {
  const seen: Seen[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const s: Seen = { url: String(url instanceof Request ? url.url : url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body ?? "{}")) };
      seen.push(s);
      const r = reply(s, seen.length);
      return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json", "retry-after-ms": "0", ...(r.headers ?? {}) } });
    }),
  );
  return seen;
}

beforeEach(() => {
  resetModelMemory();
  delete process.env.OPENAI_MODEL;
  delete process.env.CLAUDE_MODEL;
});
afterEach(() => vi.unstubAllGlobals());

describe("키 모양으로 AI 회사 알아보기", () => {
  it("클로드·GPT·제미나이", () => {
    expect(detectProvider("sk-ant-api03-xxxx")).toBe("claude");
    expect(detectProvider("sk-proj-xxxx")).toBe("openai");
    expect(detectProvider("sk-xxxx")).toBe("openai");
    expect(detectProvider("AQ.Ab8RN6")).toBe("gemini");
    expect(detectProvider("AIzaSy")).toBe("gemini");
    expect(detectProvider("모름")).toBeUndefined();
  });
  it("공백·따옴표 정리", () => {
    expect(normalizeAiKey('  "sk-ant-abc"\n')).toBe("sk-ant-abc");
  });
});

describe("서버가 요청 헤더에서 AI 키 읽기", () => {
  const req = (h: Record<string, string>) => new Request("http://x/api", { headers: h });
  it("x-ai-provider + x-ai-key", () => {
    expect(getKeys(req({ "x-ai-provider": "claude", "x-ai-key": "sk-ant-1" })).ai).toEqual({ provider: "claude", key: "sk-ant-1" });
  });
  it("예전 형식 x-gemini-key 도 받는다", () => {
    expect(getKeys(req({ "x-gemini-key": "AQ.1" })).ai).toEqual({ provider: "gemini", key: "AQ.1" });
  });
  it("모르는 공급자 이름이면 제미나이로", () => {
    expect(getKeys(req({ "x-ai-provider": "llama", "x-ai-key": "k" })).ai.provider).toBe("gemini");
  });
});

describe("클로드 (공식 SDK)", () => {
  const ok = (json: unknown, extra: Record<string, unknown> = {}) => ({
    status: 200,
    body: {
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-opus-5-5",
      content: [{ type: "text", text: JSON.stringify(json) }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 5 },
      ...extra,
    },
  });

  it("요청 모양: 모델·키·거절 대비(fallbacks)·JSON 스키마·사진", async () => {
    const seen = fakeFetch(() => ok({ ok: true }));
    const r = await generateClaude({ key: "sk-ant-test", prompt: "안녕", images: [IMG], schema: SCHEMA, effort: "low" });
    expect(r).toEqual({ json: { ok: true }, model: "claude-opus-5-5" });
    const s = seen[0];
    expect(s.url).toMatch(/\/v1\/messages/);
    // SDK 1.x 는 키를 Authorization: Bearer 로 보낸다
    expect(s.headers.get("authorization")).toBe("Bearer sk-ant-test");
    expect(s.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(s.body.model).toBe("claude-opus-5-5");
    expect(s.body.fallbacks).toBe("default");
    expect(s.body.output_config).toEqual({ effort: "low", format: { type: "json_schema", schema: SCHEMA } });
    expect("temperature" in s.body).toBe(false);
    const content = (s.body.messages as { content: { type: string }[] }[])[0].content;
    expect(content.map((c) => c.type)).toEqual(["image", "text"]);
  });

  it("CLAUDE_MODEL 로 모델을 바꿀 수 있다", async () => {
    process.env.CLAUDE_MODEL = "claude-haiku-5-5";
    const seen = fakeFetch(() => ok({ ok: true }));
    await generateClaude({ key: "k", prompt: "x", schema: SCHEMA });
    expect(seen[0].body.model).toBe("claude-haiku-5-5");
  });

  it("거절(refusal)은 refusal 오류", async () => {
    fakeFetch(() => ok({}, { stop_reason: "refusal", content: [] }));
    await expect(generateClaude({ key: "k", prompt: "x", schema: SCHEMA })).rejects.toMatchObject({ kind: "refusal", provider: "claude" });
  });

  it("401 은 키 문제", async () => {
    fakeFetch(() => ({ status: 401, body: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } } }));
    await expect(generateClaude({ key: "bad", prompt: "x", schema: SCHEMA })).rejects.toMatchObject({ kind: "key" });
  });

  it("크레딧 부족(400)은 결제 문제", async () => {
    fakeFetch(() => ({ status: 400, body: { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } } }));
    await expect(generateClaude({ key: "k", prompt: "x", schema: SCHEMA })).rejects.toMatchObject({ kind: "billing" });
  });

  it("한도(429)는 quota, 과부하(529)는 busy", async () => {
    fakeFetch(() => ({ status: 429, body: { type: "error", error: { type: "rate_limit_error", message: "rate" } } }));
    await expect(generateClaude({ key: "k", prompt: "x", schema: SCHEMA })).rejects.toMatchObject({ kind: "quota" });
    vi.unstubAllGlobals();
    fakeFetch(() => ({ status: 529, body: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } } }));
    await expect(generateClaude({ key: "k", prompt: "x", schema: SCHEMA })).rejects.toMatchObject({ kind: "busy" });
  });
});

describe("GPT (OpenAI REST)", () => {
  const ok = (json: unknown) => ({ status: 200, body: { choices: [{ message: { content: JSON.stringify(json), refusal: null } }] } });
  const err = (status: number, message: string, code?: string) => ({ status, body: { error: { message, code, type: code } } });

  it("요청 모양: Bearer 키·strict JSON 스키마·사진 data URL", async () => {
    const seen = fakeFetch(() => ok({ ok: true }));
    const r = await generateOpenAI({ key: "sk-test", prompt: "안녕", images: [IMG], schema: SCHEMA });
    expect(r.model).toBe(OPENAI_MODELS[0]);
    expect(seen[0].url).toBe("https://api.openai.com/v1/chat/completions");
    expect(seen[0].headers.get("authorization")).toBe("Bearer sk-test");
    expect(seen[0].body.response_format).toEqual({ type: "json_schema", json_schema: { name: "result", strict: true, schema: SCHEMA } });
    const content = (seen[0].body.messages as { content: { type: string; image_url?: { url: string } }[] }[])[0].content;
    expect(content[0].image_url?.url).toBe("data:image/jpeg;base64,QUJD");
  });

  it("없는 모델(404)이면 다음 모델로", async () => {
    const seen = fakeFetch((s) => (s.body.model === OPENAI_MODELS[0] ? err(404, "The model does not exist", "model_not_found") : ok({ ok: true })));
    const r = await generateOpenAI({ key: "k", prompt: "x", schema: SCHEMA });
    expect(r.model).toBe(OPENAI_MODELS[1]);
    expect(seen.map((s) => s.body.model)).toEqual([OPENAI_MODELS[0], OPENAI_MODELS[1]]);
  });

  it("reasoning_effort 를 모르는 모델이면 빼고 다시", async () => {
    const seen = fakeFetch((s) => ("reasoning_effort" in s.body ? err(400, "Unrecognized request argument supplied: reasoning_effort") : ok({ ok: true })));
    await generateOpenAI({ key: "k", prompt: "x", schema: SCHEMA });
    expect(seen.map((s) => "reasoning_effort" in s.body)).toEqual([true, false]);
  });

  it("크레딧 없음(insufficient_quota)은 다른 모델을 시도하지 않고 결제 문제로", async () => {
    const seen = fakeFetch(() => err(429, "You exceeded your current quota", "insufficient_quota"));
    await expect(generateOpenAI({ key: "k", prompt: "x", schema: SCHEMA })).rejects.toMatchObject({ kind: "billing", provider: "openai" });
    expect(seen.length).toBe(1);
  });

  it("401 은 키 문제로 바로 멈춤", async () => {
    const seen = fakeFetch(() => err(401, "Incorrect API key provided", "invalid_api_key"));
    const e = await generateOpenAI({ key: "bad", prompt: "x", schema: SCHEMA }).catch((x) => x);
    expect(e).toBeInstanceOf(AiError);
    expect(e.kind).toBe("key");
    expect(seen.length).toBe(1);
  });
});

describe("AI 응답 스키마", () => {
  /** OpenAI strict·클로드 구조화 출력 조건: 모든 object 에 additionalProperties:false, required = 모든 속성 */
  function checkStrict(s: JsonSchema, path = "$") {
    if (s.type === "object") {
      expect(s.additionalProperties, path).toBe(false);
      expect([...(s.required ?? [])].sort(), path).toEqual(Object.keys(s.properties ?? {}).sort());
      for (const [k, v] of Object.entries(s.properties ?? {})) checkStrict(v, `${path}.${k}`);
    }
    if (s.items) checkStrict(s.items, `${path}[]`);
  }
  it("식별·설명·도감에 없는 식물 스키마가 strict 조건을 지킨다", () => {
    checkStrict(IDENTIFY_SCHEMA);
    checkStrict(EXPLAIN_SCHEMA);
    checkStrict(UNLISTED_SCHEMA);
  });
});

describe("학년 눈높이 풀이 프롬프트", () => {
  const official = { koreanName: "은행나무", shpe: "잎은 부채 모양이다.", grwEvrntDesc: "양지에서 잘 자란다." };
  it("학년별 글쓰기 기준과 원문 항목이 들어간다", () => {
    for (const g of ["1-2", "3-4", "5-6"] as const) {
      const p = explainPrompt(official, g, []);
      expect(p).toContain(GRADE_STYLE[g]);
      expect(p).toContain("shpe=형태");
      expect(p).toContain("grwEvrntDesc=생육환경");
      expect(p).not.toContain("useMthdDesc=");
      expect(p).toContain("지어내지 말 것");
    }
  });
  it("1~2학년과 5~6학년 기준이 다르다", () => {
    expect(GRADE_STYLE["1-2"]).not.toBe(GRADE_STYLE["5-6"]);
    expect(GRADE_STYLE["1-2"]).toContain("짧게");
    expect(GRADE_STYLE["5-6"]).toContain("광합성");
  });
});
