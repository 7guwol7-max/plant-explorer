#!/usr/bin/env node
/**
 * 0단계 — 국립수목원 API 명세 검증 스크립트
 * 사용: node scripts/check-api.mjs
 *  - .env.local 의 DATA_GO_KR_KEY(디코딩 키)로 실제 호출
 *  - 검색어별 totalCount 와 첫 결과를 출력
 *  - 첫 결과의 도감번호로 상세를 조회해 samples/real_*.xml 로 저장 (모의 모드 자료로 재사용 가능)
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const KEY = process.env.DATA_GO_KR_KEY;
if (!KEY) {
  console.error("DATA_GO_KR_KEY 가 없어요. .env.local 에 디코딩 키를 넣으세요.");
  process.exit(1);
}

const PLANT = "https://apis.data.go.kr/1400119/PlantResource";
const INSECT = "https://apis.data.go.kr/1400119/InsectService";
const outDir = path.join(process.cwd(), "samples");
fs.mkdirSync(outDir, { recursive: true });

async function call(base, op, params) {
  const url = new URL(`${base}/${op}`);
  url.search = new URLSearchParams({ serviceKey: KEY, ...params }).toString();
  const res = await fetch(url);
  const text = await res.text();
  return { status: res.status, text };
}
const pick = (xml, tag) => (new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml) || [])[1] ?? "";

async function testSearch(label, base, op, words, noTag, nameTag, infoOp, infoParam) {
  console.log(`\n==== ${label} ====`);
  for (const w of words) {
    const { status, text } = await call(base, op, { pageNo: "1", numOfRows: "10", reqSearchWrd: w });
    const code = pick(text, "resultCode") || pick(text, "returnReasonCode");
    const total = pick(text, "totalCount");
    const first = pick(text, nameTag);
    const firstNo = pick(text, noTag);
    console.log(`[${w}] http ${status} · 결과코드 ${code} · totalCount ${total || "-"} · 첫 결과 ${first || "-"} (${firstNo || "-"})`);
    if (code !== "00") console.log("   ↳ 응답 앞부분:", text.slice(0, 300).replace(/\s+/g, " "));
    fs.writeFileSync(path.join(outDir, `real_${op}_${w}.xml`), text);
    if (firstNo && infoOp) {
      const info = await call(base, infoOp, { [infoParam]: firstNo });
      fs.writeFileSync(path.join(outDir, `real_${infoOp}_${firstNo}.xml`), info.text);
      console.log(`   ↳ 상세 ${infoOp}(${firstNo}) http ${info.status} · 결과코드 ${pick(info.text, "resultCode")} · 저장됨`);
    }
  }
}

await testSearch("식물도감 검색", PLANT, "plantPilbkSearch", ["은행나무", "은행", "Ginkgo", "소나무", "민들레"], "plantPilbkNo", "plantGnrlNm", "plantPilbkInfo", "reqPlantPilbkNo");
await testSearch("곤충도감 검색", INSECT, "insectPilbkSearch", ["배추흰나비", "나비", "꿀벌"], "insctPilbkNo", "insctGnrlNm", "insectPilbkInfo", "reqInsctPilbkNo");

console.log(`\n원문 XML은 ${outDir} 에 real_*.xml 로 저장됐어요.`);
console.log("검색어 매칭 방식(완전일치/부분일치)은 '은행' 과 '은행나무' 의 totalCount 를 비교해 확인하세요.");
