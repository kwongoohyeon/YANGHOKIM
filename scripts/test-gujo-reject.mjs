// 구조혁신&사업전환 부결 — 재신청 흐름 제외 (2026-09-07)
// 실행: node scripts/test-gujo-reject.mjs
//
// 왜 이렇게 하나: 판정 규칙을 여기에 옮겨 적으면 그건 코드 검증이 아니라 사본 검증이다.
// src/App.js 의 ⛳ 마커 구간을 소스째 떼어내 실행하고, 나머지는 소스 정적 검사로 확인한다.
//
// ⚠️ App.js 의 마커 문구(⛳ 재신청-제외 시작/끝)를 바꾸면 이 테스트가 통째로 죽는다.

import fs from "node:fs";

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? " — " + detail : ""}`); }
};

const src = fs.readFileSync("src/App.js", "utf8");
const GUJO = "구조혁신&사업전환";

// ── ① 마커 구간을 떼어내 실행한다
// 마커가 주석 안에 있으므로 `//` 부터 잡아야 떼어낸 조각이 그대로 실행된다.
const mk = src.match(/\/\/ ⛳ 재신청-제외 시작[\s\S]*?⛳ 재신청-제외 끝/);
if (!mk) {
  console.error("❌ '⛳ 재신청-제외 시작/끝' 마커를 App.js 에서 못 찾았다.");
  process.exit(1);
}
// eslint-disable-next-line no-new-func
const { REAPPLY_EXEMPT_GROUPS, isReapplyExempt } = new Function(
  mk[0] + "\n return { REAPPLY_EXEMPT_GROUPS, isReapplyExempt };"
)();
console.log(`■ 소스에서 떼어낸 명단: ${JSON.stringify(REAPPLY_EXEMPT_GROUPS)}\n`);

// 소스에서 배열·객체를 그대로 떼어내는 도우미 (옮겨 적지 않기 위해)
const pick = (re, label) => {
  const m = src.match(re);
  if (!m) { console.error(`❌ ${label} 를 소스에서 못 찾았다.`); process.exit(1); }
  // eslint-disable-next-line no-new-func
  return new Function("return (" + m[1] + ");")();
};

console.log("■ 판정 함수");
ok(`isReapplyExempt("${GUJO}") = true`, isReapplyExempt(GUJO) === true);

// 나머지 기관은 전부 기존 재신청 흐름을 그대로 탄다
const AGENCIES = pick(/const AGENCIES\s*=\s*(\[[^\]]*\]);/, "AGENCIES");
const others = AGENCIES.filter((a) => a !== GUJO);
ok(`나머지 기관 ${others.length}곳은 전부 false`,
  others.every((a) => isReapplyExempt(a) === false),
  others.filter((a) => isReapplyExempt(a)).join(","));

// 모르는 값에서 조용히 흐름이 끊기면 안 된다 (기본은 "기존대로 재신청 흐름")
ok("빈 값·모르는 기관은 false", [null, undefined, "", "없는기관", 0].every((v) => isReapplyExempt(v) === false));

// ── ② 구조혁신 상태 목록에 '부결' 이 생겼는가
console.log("\n■ 상태값");
const GUJO_OPTS = pick(/var GUJOHYEOK_STATUS_OPTIONS = (\[[\s\S]*?\]);/, "GUJOHYEOK_STATUS_OPTIONS");
const GUJO_COLORS = pick(/var GUJOHYEOK_STATUS_COLORS = (\{[\s\S]*?\n  \});/, "GUJOHYEOK_STATUS_COLORS");
const STATUS_COLORS = pick(/^const STATUS_COLORS_MAP = (\{[\s\S]*?\n\});/m, "STATUS_COLORS_MAP");

ok("구조혁신 상태에 '부결' 포함", GUJO_OPTS.indexOf("부결") >= 0, JSON.stringify(GUJO_OPTS));
ok("'반려' 는 넣지 않았다 (이번 범위 밖)", GUJO_OPTS.indexOf("반려") < 0);
ok("상태값 중복 없음", new Set(GUJO_OPTS).size === GUJO_OPTS.length);
ok("'사업전환 승인' 이 그대로 남아 있다", GUJO_OPTS.indexOf("사업전환 승인") >= 0);
ok("'부결' 색이 정의돼 있다 (없으면 회색 폴백)", !!GUJO_COLORS["부결"]);
ok("'부결' 색이 다른 기관과 같다",
  !!GUJO_COLORS["부결"] && !!STATUS_COLORS["부결"] &&
  GUJO_COLORS["부결"].bg === STATUS_COLORS["부결"].bg &&
  GUJO_COLORS["부결"].text === STATUS_COLORS["부결"].text,
  JSON.stringify(GUJO_COLORS["부결"]));
// 모든 상태값에 색이 있어야 배지가 회색으로 새지 않는다
ok("상태 전부에 색이 있다", GUJO_OPTS.every((s) => !!GUJO_COLORS[s]),
  GUJO_OPTS.filter((s) => !GUJO_COLORS[s]).join(","));

// ── ③ 집계·카드 연동은 손대지 않았는지 (기존 규칙을 고정한다)
console.log("\n■ 기존 규칙 고정");
const REJECTED = pick(/rejected: (\["부결"[^\]]*\])/, "STATUS_GROUPS.rejected");
ok("집계표 rejected 에 '부결' 이 이미 있다 (집계 코드 수정 불필요)", REJECTED.indexOf("부결") >= 0);

const OVERRIDE = pick(/const SYNC_STATUS_OVERRIDE = (\{[\s\S]*?\n\});/, "SYNC_STATUS_OVERRIDE");
ok("부결 → 부결/반려 카드 이동 규칙은 그대로 (승인된 부작용)", OVERRIDE["부결"] === "부결/반려");

// ── ④ 가드가 실제로 걸려 있는가 (정적 검사)
console.log("\n■ 가드 위치");
const openRejectBody = src.match(/var openReject = function\(row\) \{[\s\S]*?\n  \};/);
ok("openReject 안에 가드가 있다", !!openRejectBody && openRejectBody[0].includes("isReapplyExempt"));
ok("가드가 setShowRejectModal 보다 앞에 있다",
  !!openRejectBody &&
  openRejectBody[0].indexOf("isReapplyExempt") < openRejectBody[0].indexOf("setShowRejectModal"));

const reapplyLine = src.split("\n").find((l) => l.includes('checklist.reapply_intent === "예"'));
ok("다음 달 건 자동 생성에도 이중 방어가 있다",
  !!reapplyLine && reapplyLine.includes("isReapplyExempt"), reapplyLine || "(줄을 못 찾음)");

// 호출부 2곳은 건드리지 않았다 (가드를 한 곳에 모은 설계)
const callSites = (src.match(/openReject\(Object\.assign\(/g) || []).length;
ok("openReject 호출부는 2곳 그대로", callSites === 2, `실제 ${callSites}곳`);

console.log(`\n결과: ${pass}/${pass + fail} 통과`);
process.exit(fail ? 1 : 0);
