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

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass}/${pass + fail} 통과`);
process.exit(fail === 0 ? 0 : 1);
