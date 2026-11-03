import type { InlineImage } from "../images";

/** 표준 JSON 스키마 (소문자 type). 공급자별 형식으로는 각 모듈이 바꾼다 */
export type JsonSchema = {
  type?: "object" | "array" | "string" | "boolean" | "number" | "integer";
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: string[];
  additionalProperties?: boolean;
};

export type AiRequest = {
  key: string;
  prompt: string;
  images?: InlineImage[];
  schema: JsonSchema;
  /** 생각을 얼마나 깊게 할지 (지원하는 공급자만) */
  effort?: "low" | "medium";
};
