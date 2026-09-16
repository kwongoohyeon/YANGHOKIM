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

// 실제 companies 덤프 대조는 **조건부**다 — 운영 DB 쿼리는 이 태스크 범위 밖(금지)이라
// 브리프 원문의 run-sql.js 직접 조회 대신, 미리 떠 둔 덤프 파일이 있을 때만 읽는다.
// 파일: 배열(JSON) · id·region·industry·revenue_*·employee_count·founded_year·founded_month·
//       export_usd·social_enterprise·innovation_field·biz_match_override 컬럼 한정.
// 없으면 "미실행"으로 표시하고 통과 개수에 넣지 않는다 — 조용히 통과시키지 않는다.
const DUMP_PATH = path.join(ROOT, ".superpowers/sdd/2026-08-30-공고매칭-1A/companies-dump.json");
function loadCompaniesDump() {
  if (!fs.existsSync(DUMP_PATH)) return null;
  return JSON.parse(fs.readFileSync(DUMP_PATH, "utf8"));
}

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
  "annEvalCompany", "annRunMatch", "ANN_ENGINE_VERSION",
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

// ── C1: 공고 지역을 해석 못 하면 unknown — fail 로 새서 전원 제외되면 안 된다 ──
// (최종 리뷰 Critical C1 재현 입력 그대로)
eq("C1 sido 빈값",        S("서울_강남", [{ sido: "", sigungu: "강남구" }]),   "unknown");
eq("C1 문자열 항목(일치)", S("서울_강남", ["서울특별시 강남구"]),               "pass");
eq("C1 문자열 항목(불일치)", S("경기_수원", ["서울특별시 강남구"]),             "fail");
eq("C1 전국",              S("서울_강남", [{ sido: "전국" }]),                  "unknown");
eq("C1 수도권",            S("서울_강남", [{ sido: "수도권" }]),                "unknown");
eq("C1 별칭표 밖 표기",    S("서울_강남", [{ sido: "서울 특별시" }]),           "unknown");

// ── C2: 자치구 있는 시 — "시" 없이 구만 오면 우리 시 단위 데이터로는 확정 불가 ──
eq("C2 고양·덕양구",       S("경기_고양", [{ sido: "경기", sigungu: "덕양구" }]), "unknown");
eq("C2 성남·분당구",       S("경기_성남", [{ sido: "경기", sigungu: "분당구" }]), "unknown");
// ⚠️ 광역시 자치구는 우리 값도 이미 구 단위라 그대로 정상 비교(fail)돼야 한다 — 회귀 방지
eq("C2 광역시 자치구는 그대로 fail", S("서울_강남", [{ sido: "서울특별시", sigungu: "종로구" }]), "fail");

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

// ── I1: exclude 부분일치 오탐 — "문자열 안에 들어 있기만" 한 건 fail 이 아니다 ──
// (최종 리뷰 Important I1 재현 입력 그대로)
eq("I1 음식료품≠음식",   I("음식료품 도매업", { include: [], exclude: ["음식"] }),         "unknown");
eq("I1 숙박예약≠숙박",   I("숙박예약 플랫폼 개발업", { include: [], exclude: ["숙박"] }),   "unknown");
// ⚠️ 진짜 업종명(단어 자체 또는 "키워드+업/점" 수준)은 그대로 fail — 회귀 방지
eq("I1 진짜 업종명은 그대로 fail", I("유흥주점업", { include: [], exclude: ["유흥"] }),      "fail");

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
// ⚠️ 최종 리뷰 I2(Ruling 5)로 기대값 변경: 이 no 는 업종 키워드·매출 기반 자동판정이라
//    "확실히 아님"의 근거가 못 된다 — biz_match_override 로 온 값이 아니면 unknown 이어야 한다.
eq("소상공인 아님(자동판정→unknown)", C(큰곳, "소상공인"),  "unknown");
eq("소기업 해당",      C(소상, "소기업"),    "pass");
eq("근로자수 없으면 불가", C({ industry: "음식점업", revenue_2024: 300000000 }, "소상공인"), "unknown");
eq("업종 없으면 불가", C({ revenue_2024: 300000000, employee_count: 3 }, "소기업"),          "unknown");
eq("중소기업은 통과",  C(소상, "중소기업"),  "pass");

// ── I2: "참고용 배지" no 가 확정 제외로 승격되면 안 된다 ────────────────────
// (최종 리뷰 Important I2 재현 입력 그대로 — 산업교육 컨설팅업은 "교육" 키워드가
//  생활서비스 10억 티어에 걸려 no 가 나오지만, 실제로는 전문서비스 30억 기준일 수 있다)
const 오분류업체 = { industry: "산업교육 컨설팅업", revenue_2024: 1500000000, employee_count: 10 };
eq("I2 업종키워드 no는 unknown(소기업)", C(오분류업체, "소기업"), "unknown");
// ⚠️ 수동 보정(biz_match_override)에서 온 no 는 그대로 확정 fail — 회귀 방지
const 수동중기업 = { industry: "산업교육 컨설팅업", revenue_2024: 1500000000, biz_match_override: { grade: "중소기업" } };
eq("I2 수동보정 no는 그대로 fail(소기업)", C(수동중기업, "소기업"), "fail");

// ── annEvalCompany / annRunMatch ────────────────────────────────────────────
const COND = {
  version: 1,
  regions:    { include: [{ sido: "서울특별시", sigungu: "강남구" }] },
  industries: { include: ["제조"], exclude: ["유흥"] },
  scale:      "소기업",
  revenue:    { min: null, max: 12000000000, basis: "연매출" },
  age:        { min_months: 12, max_months: null },
  employees:  null,
  excludes_text: ["국세·지방세 체납"],
};
const 유력업체 = { id: "c1", name: "가제조", region: "서울_강남", industry: "제조업",
                   revenue_2024: 3000000000, founded_year: 2019, founded_month: 4, assignee: "관호" };
const 애매업체 = { id: "c2", name: "나상사", region: "서울_강남", industry: "도소매업",
                   revenue_2024: 3000000000, founded_year: 2019, founded_month: 4, assignee: "관호" };
const 제외업체 = { id: "c3", name: "다식당", region: "경기_시흥", industry: "음식점업",
                   revenue_2024: 300000000, founded_year: 2019, founded_month: 4, assignee: "관호" };

const e1 = mod.annEvalCompany(유력업체, COND, 202608);
eq("유력 판정",       e1.verdict, "유력");
eq("유력은 검사 6개", e1.checks.length, 6);
const e2 = mod.annEvalCompany(애매업체, COND, 202608);
eq("애매 판정",       e2.verdict, "애매");
eq("애매 사유는 업종", e2.checks.filter(c => c.state === "unknown").map(c => c.key), ["industry"]);
const e3 = mod.annEvalCompany(제외업체, COND, 202608);
eq("제외 판정",       e3.verdict, "제외");
// ⚠️ 코드로 못 재는 제외조건은 판정을 바꾸지 않고 notes 로만 남긴다
eq("제외조건은 메모로", e1.notes.some(n => n.indexOf("국세") >= 0), true);
eq("업종 제외어 미확인 메모", e1.notes.some(n => n.indexOf("유흥") >= 0), true);

// ── I2(계속): annEvalCompany 레벨 — 자동판정 no 는 제외가 아니라 애매 + 근거 메모 ──
const COND_SCALE_ONLY = { version: 1, scale: "소기업" };
const 오분류업체2 = { id: "c9", name: "라컨설팅", region: "", industry: "산업교육 컨설팅업", revenue_2024: 1500000000 };
const e4 = mod.annEvalCompany(오분류업체2, COND_SCALE_ONLY, 202608);
eq("I2 자동추정 no는 제외 아닌 애매", e4.verdict, "애매");
eq("I2 확정불가 근거 메모", e4.notes.some(n => n.indexOf("규모기준이 업종 키워드 추정") >= 0), true);

const run = mod.annRunMatch([유력업체, 애매업체, 제외업체, { id: "x", name: "지운곳", deleted_at: "2026-01-01" }], COND, "관호");
eq("삭제 기업 제외",  run.rows.length, 3);
eq("집계",            run.summary.counts, { 유력: 1, 애매: 1, 제외: 1 });
// ⚠️ I3: 이전엔 떼어낸 값과 자기 자신을 비교하는 항상-참 단언이었다. 실제 계약(버전=1)을 확인한다.
eq("엔진 버전",       run.summary.engine, 1);
eq("정렬: 유력 먼저", run.rows.map(r => r.verdict), ["유력", "애매", "제외"]);
// ⚠️ 제외 행은 떨어진 조건 1개만 담는다 — 404개 × 6조건을 jsonb 에 넣지 않는다
eq("제외 행은 1개만", run.rows[2].checks.length, 1);
eq("제외 행은 fail만", run.rows[2].checks[0].state, "fail");

// ── 실제 DB 로 회귀 확인 (조건부 — 덤프 파일이 있을 때만) ──────────────────
// "전 조건이 비어 있는 공고"는 살아있는 기업 전부가 유력이어야 한다.
// 엔진이 조용히 업체를 흘리는지 보는 안전망이다.
// ⚠️ 운영 DB 쿼리는 이 태스크 범위 밖이라, 덤프 파일이 없으면 미실행으로 표시하고
//    통과 개수에 넣지 않는다(조용히 통과시키지 않는다).
const dump = loadCompaniesDump();
if (dump) {
  const all = mod.annRunMatch(dump, { version: 1 }, "test");
  eq("빈 조건이면 전원 유력", all.summary.counts.애매 + all.summary.counts.제외, 0);
  eq("빈 조건이면 전원 포함", all.rows.length, dump.length);
  console.log(`   (실제 DB 살아있는 기업 ${dump.length}개로 확인)`);
} else {
  console.log("⏭ 실덤프 대조: 덤프 없음 — 미실행");
}

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass}/${pass + fail} 통과`);
process.exit(fail === 0 ? 0 : 1);
