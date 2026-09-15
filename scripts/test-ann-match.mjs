// 공고 매칭 엔진 검증 (2026-08-30)
// ⚠️ App.js 소스에서 표식 사이를 **떼어내 그대로 실행**한다 — 손으로 옮겨 적으면 코드 검증이 아니다.
//    (test-nocard.mjs · test-debtor-change.mjs 와 같은 방식)
// ⚠️ 읽기 전용이다. 아무것도 쓰지 않는다.
// 사용법: node scripts/test-ann-match.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(ROOT, "src/App.js"), "utf8");

function slice(startMark, endMark) {
  const a = src.indexOf(startMark);
  const b = src.indexOf(endMark);
  if (a < 0) { console.error("❌ App.js 에서 " + startMark + " 를 못 찾았습니다"); process.exit(1); }
  if (b < a) { console.error("❌ App.js 에서 " + endMark + " 를 못 찾았습니다"); process.exit(1); }
  return src.slice(a + startMark.length, b);
}

const bizSrc = slice("// ── BIZ-SCALE-START ──", "// ── BIZ-SCALE-END ──");
const annSrc = slice("// ── ANN-ENGINE-START ──", "// ── ANN-ENGINE-END ──");
console.log(`── 떼어낸 소스: 규모판정 ${bizSrc.trim().split("\n").length}줄 · 매칭엔진 ${annSrc.trim().split("\n").length}줄 ──`);

const EXPORTS = [
  "normRegion", "annTrimGu", "annDeeperThanCity", "annRegionState",
  "annIndustryTokens", "annIndustryState",
  "annScaleState", "annRevenueState", "annAgeState", "annEmployeeState",
];
const mod = new Function(bizSrc + "\n" + annSrc + "\nreturn {" + EXPORTS.join(",") + "};")();

let pass = 0, fail = 0;
function eq(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass += 1; }
  else { fail += 1; console.error(`❌ ${label}\n   got  ${g}\n   want ${w}`); }
}

// ── normRegion ──────────────────────────────────────────────────────────────
const R = mod.normRegion;
eq("CRM 언더바",        R("서울_강남"),                       { sido: "서울", sigungu: "강남" });
eq("CRM 공백",          R("경기 시흥"),                       { sido: "경기", sigungu: "시흥" });
eq("공고 정식표기",     R("서울특별시 강남구"),               { sido: "서울", sigungu: "강남" });
eq("공고 도명",         R("경기도 시흥시"),                   { sido: "경기", sigungu: "시흥" });
eq("시도만",            R("경기"),                            { sido: "경기", sigungu: "" });
eq("도로명주소",        R("서울특별시 강남구 테헤란로 123"),  { sido: "서울", sigungu: "강남" });
eq("붙여쓴 표기",       R("서울특별시강남구"),                { sido: "서울", sigungu: "강남" });
eq("중구(한 글자 남음)", R("서울_중구"),                      { sido: "서울", sigungu: "중" });
eq("강원특별자치도",    R("강원특별자치도 원주시"),           { sido: "강원", sigungu: "원주" });
eq("전북특별자치도",    R("전북특별자치도 전주시"),           { sido: "전북", sigungu: "전주" });
eq("충남",              R("충남_논산"),                       { sido: "충남", sigungu: "논산" });
eq("빈 값",             R(""),                                { sido: "", sigungu: "" });
eq("못 읽는 값",        R("미정"),                            { sido: "", sigungu: "" });
// ⚠️ 광주 — 시도와 쌍으로 봐야만 갈린다
eq("광주광역시",        R("광주광역시 광산구"),               { sido: "광주", sigungu: "광산" });
eq("경기도 광주시",     R("경기_광주"),                       { sido: "경기", sigungu: "광주" });

// ── annTrimGu ───────────────────────────────────────────────────────────────
eq("접미사 제거 구",  mod.annTrimGu("강남구"), "강남");
eq("접미사 제거 시",  mod.annTrimGu("시흥시"), "시흥");
eq("한 글자는 유지",  mod.annTrimGu("구"),     "구");
eq("접미사 없음",     mod.annTrimGu("강남"),   "강남");

// ── annDeeperThanCity ───────────────────────────────────────────────────────
eq("시 아래 구",   mod.annDeeperThanCity("고양시 덕양구"), true);
eq("시 단위",      mod.annDeeperThanCity("시흥시"),        false);
eq("구 단위",      mod.annDeeperThanCity("강남구"),        false);
eq("군 아래 면",   mod.annDeeperThanCity("양평군 서종면"), true);

// ── annRegionState ──────────────────────────────────────────────────────────
const S = mod.annRegionState;
eq("전국(빈 배열)",   S("서울_강남", []),                                     "pass");
eq("전국(null)",      S("서울_강남", null),                                   "pass");
eq("시군구 일치",     S("서울_강남", [{ sido: "서울특별시", sigungu: "강남구" }]), "pass");
eq("시도만 요구",     S("서울_강남", [{ sido: "서울특별시", sigungu: "" }]),      "pass");
eq("시도부터 다름",   S("서울_강남", [{ sido: "경기도", sigungu: "시흥시" }]),    "fail");
eq("시도같고 시군구 다름", S("서울_강남", [{ sido: "서울특별시", sigungu: "중구" }]), "fail");
eq("우리는 시도만",   S("경기",      [{ sido: "경기도", sigungu: "시흥시" }]),    "unknown");
eq("우리 지역 못 읽음", S("미정",    [{ sido: "서울특별시", sigungu: "강남구" }]), "unknown");
eq("여러 곳 중 하나 적중", S("경기_시흥", [{ sido: "서울특별시", sigungu: "" }, { sido: "경기도", sigungu: "시흥시" }]), "pass");
// ⚠️ 공고가 우리보다 깊은 단위를 요구하면 확정하지 않는다 — 일산 업체가 섞인다
eq("시 아래 구 한정",  S("경기_고양", [{ sido: "경기도", sigungu: "고양시 덕양구" }]), "unknown");
// ⚠️ 광주 오탐 — 시도가 다르면 시군구가 같아도 불일치
eq("광주 오탐 방지",   S("경기_광주", [{ sido: "광주광역시", sigungu: "" }]),      "fail");

// ── annIndustryTokens ───────────────────────────────────────────────────────
eq("단일 업종",   mod.annIndustryTokens("제조업"),                    ["제조업"]);
eq("콤마 다중",   mod.annIndustryTokens("도소매업, 제조업, 건설업"),  ["도소매업", "제조업", "건설업"]);
eq("슬래시 다중", mod.annIndustryTokens("도소매/통신기기 소매업"),    ["도소매", "통신기기 소매업"]);
eq("빈 값",       mod.annIndustryTokens(""),                          []);

// ── annIndustryState ────────────────────────────────────────────────────────
const I = mod.annIndustryState;
eq("업종 조건 없음", I("음식점업", { include: [], exclude: [] }),                  "pass");
eq("조건 자체 null", I("음식점업", null),                                          "pass");
eq("include 적중",   I("제조업", { include: ["제조"], exclude: [] }),              "pass");
eq("다중값 중 적중", I("도소매업, 제조업", { include: ["제조"], exclude: [] }),    "pass");
eq("exclude 적중",   I("유흥주점업", { include: ["서비스"], exclude: ["유흥"] }),  "fail");
// ⚠️ exclude 가 include 보다 세다 — 둘 다 걸리면 fail
eq("둘 다 걸림",     I("제조업, 유흥주점업", { include: ["제조"], exclude: ["유흥"] }), "fail");
// ⚠️ "걸린 게 없다"는 "아니다"가 아니라 "모른다" — fail 이 아니다(설계 §7-2)
eq("아무것도 안 걸림", I("음식점업", { include: ["제조"], exclude: [] }),          "unknown");
eq("우리 업종 비어있음", I("", { include: ["제조"], exclude: [] }),                "unknown");
// ⚠️ exclude 만 있는 공고 — "제외 대상이 아님"을 확정하지 않는다
eq("exclude 만 있고 안 걸림", I("도소매업", { include: [], exclude: ["유흥"] }),   "unknown");

// ── annRevenueState ─────────────────────────────────────────────────────────
const V = mod.annRevenueState;
const co30 = { revenue_2023: 2800000000, revenue_2024: 3000000000, revenue_2025: 3200000000, industry: "제조업" };
eq("매출 조건 없음",   V(co30, null),                                                    "pass");
eq("상한 이내",        V(co30, { min: null, max: 12000000000, basis: "연매출" }),        "pass");
eq("상한 초과",        V(co30, { min: null, max: 1000000000, basis: "연매출" }),         "fail");
eq("하한 미달",        V(co30, { min: 10000000000, max: null, basis: "연매출" }),        "fail");
eq("3년평균 기준",     V(co30, { min: null, max: 3100000000, basis: "3년평균" }),        "pass");
eq("매출 없음",        V({ industry: "제조업" }, { min: null, max: 1000000000, basis: "연매출" }), "unknown");

// ── annAgeState (오늘 = 2026-08 고정) ───────────────────────────────────────
const A = mod.annAgeState, YM = 202608;
eq("업력 조건 없음",   A({ founded_year: 2020, founded_month: 3 }, null, YM),                       "pass");
eq("1년 이상 충족",    A({ founded_year: 2020, founded_month: 3 }, { min_months: 12 }, YM),         "pass");
eq("1년 미만 미달",    A({ founded_year: 2026, founded_month: 5 }, { min_months: 12 }, YM),         "fail");
eq("설립연도 없음",    A({}, { min_months: 12 }, YM),                                               "unknown");
// ⚠️ 설립월이 없으면 최대 11개월 오차 → 기준선을 걸치면 unknown, 안 걸치면 확정한다
eq("월없음·확실히 충족", A({ founded_year: 2020 }, { min_months: 12 }, YM),                          "pass");
eq("월없음·확실히 미달", A({ founded_year: 2026 }, { min_months: 12 }, YM),                          "fail");
eq("월없음·경계 걸침",   A({ founded_year: 2025 }, { min_months: 12 }, YM),                          "unknown");
eq("업력 상한 초과",     A({ founded_year: 2010, founded_month: 1 }, { max_months: 84 }, YM),        "fail");

// ── annEmployeeState ────────────────────────────────────────────────────────
const E = mod.annEmployeeState;
eq("근로자 조건 없음", E({ employee_count: 3 }, null),                  "pass");
eq("상한 이내",        E({ employee_count: 3 }, { max: 5 }),            "pass");
eq("상한 초과",        E({ employee_count: 9 }, { max: 5 }),            "fail");
eq("하한 미달",        E({ employee_count: 3 }, { min: 5 }),            "fail");
eq("미입력",           E({}, { max: 5 }),                               "unknown");

// ── annScaleState (기존 judgeSmallBiz·judgeSososang 을 그대로 쓴다) ─────────
const C = mod.annScaleState;
const 소상 = { industry: "음식점업", revenue_2024: 300000000, employee_count: 3 };
const 큰곳 = { industry: "음식점업", revenue_2024: 5000000000, employee_count: 40 };
eq("규모 조건 없음",   C(소상, null),        "pass");
eq("소상공인 해당",    C(소상, "소상공인"),  "pass");
eq("소상공인 아님",    C(큰곳, "소상공인"),  "fail");
eq("소기업 해당",      C(소상, "소기업"),    "pass");
eq("근로자수 없으면 불가", C({ industry: "음식점업", revenue_2024: 300000000 }, "소상공인"), "unknown");
eq("업종 없으면 불가", C({ revenue_2024: 300000000, employee_count: 3 }, "소기업"),          "unknown");
eq("중소기업은 통과",  C(소상, "중소기업"),  "pass");

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass}/${pass + fail} 통과`);
process.exit(fail === 0 ? 0 : 1);
