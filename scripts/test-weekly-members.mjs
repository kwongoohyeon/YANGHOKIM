// 🗓️ 주간 정리 자동 팝업 대상 명단 (2026-09-07)
// 실행: node scripts/test-weekly-members.mjs
//
// 왜 이렇게 하나: 명단을 여기에 옮겨 적으면 사본 검증이 된다.
// src/App.js 의 ⛳ 마커 구간을 소스째 떼어내 실행하고, 이름이 실제 profiles.name 과
// 일치하는지 DB 로 대조한다 — 이름이 틀리면 아무에게도 안 뜨고 에러도 안 난다.
//
// ⚠️ App.js 의 마커 문구(⛳ 주간정리-대상 시작/끝)를 바꾸면 이 테스트가 통째로 죽는다.
// ⚠️ 명단이 바뀌면 EXPECT 도 같이 고칠 것 — 그게 이 테스트의 목적이다.

import fs from "node:fs";
import { execFileSync } from "node:child_process";

const EXPECT = ["관호", "유진", "정원"];

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? " — " + detail : ""}`); }
};

const src = fs.readFileSync("src/App.js", "utf8");

// ── ① 마커 구간을 떼어내 실행한다
// 마커가 주석 안에 있으므로 `//` 부터 잡아야 떼어낸 조각이 그대로 실행된다.
const mk = src.match(/\/\/ ⛳ 주간정리-대상 시작[\s\S]*?⛳ 주간정리-대상 끝/);
if (!mk) {
  console.error("❌ '⛳ 주간정리-대상 시작/끝' 마커를 App.js 에서 못 찾았다.");
  process.exit(1);
}
// eslint-disable-next-line no-new-func
const { WEEKLY_REVIEW_MEMBERS, isWeeklyReviewMember } = new Function(
  mk[0] + "\n return { WEEKLY_REVIEW_MEMBERS, isWeeklyReviewMember };"
)();
console.log(`■ 소스에서 떼어낸 명단: ${JSON.stringify(WEEKLY_REVIEW_MEMBERS)}\n`);

const pick = (re, label) => {
  const m = src.match(re);
  if (!m) { console.error(`❌ ${label} 를 소스에서 못 찾았다.`); process.exit(1); }
  // eslint-disable-next-line no-new-func
  return new Function("return (" + m[1] + ");")();
};

console.log("■ 명단");
ok(`명단 = ${EXPECT.join("·")}`,
  WEEKLY_REVIEW_MEMBERS.join(",") === EXPECT.join(","), JSON.stringify(WEEKLY_REVIEW_MEMBERS));
ok("세 명 전부 true", EXPECT.every((n) => isWeeklyReviewMember(n) === true));

// ASSIGNEES 를 재사용하지 않았는지 — 재사용하면 담당자가 늘 때 팝업이 조용히 같이 켜진다
const ASSIGNEES = pick(/const ASSIGNEES = (\[[^\]]*\]);/, "ASSIGNEES");
const notTargets = ASSIGNEES.filter((n) => EXPECT.indexOf(n) < 0);
ok(`ASSIGNEES 의 나머지 ${notTargets.length}명은 false`,
  notTargets.every((n) => isWeeklyReviewMember(n) === false),
  notTargets.filter((n) => isWeeklyReviewMember(n)).join(","));
ok("명단이 ASSIGNEES 와 다른 배열이다", WEEKLY_REVIEW_MEMBERS.length !== ASSIGNEES.length);

// 관리자라서 빠지는 게 아니다 — 정원은 role='admin' 인데 대상이다
const WN_ADMINS = pick(/const WN_ADMINS = (\[[^\]]*\]);/, "WN_ADMINS");
ok("양호(WN_ADMINS)는 false", WN_ADMINS.every((n) => isWeeklyReviewMember(n) === false));
ok("빈 값·모르는 이름은 false",
  [null, undefined, "", "없는사람", 0].every((v) => isWeeklyReviewMember(v) === false));

// ── ② 가드가 자동 오픈 useEffect 에만 걸려 있는가
console.log("\n■ 가드 위치");
const autoOpen = src.match(/\/\/ 모드 확정 후[\s\S]*?\n  \}, \[loading, profile, todayStr, weeklyMode, weeklyItems, showWeekly\]\);/);
ok("자동 오픈 useEffect 에 가드가 있다", !!autoOpen && autoOpen[0].includes("isWeeklyReviewMember"));

const manual = src.match(/var openWeeklyManually = function\(\) \{[\s\S]*?\n  \};/);
ok("수동 열기 버튼은 그대로 (가드 없음)", !!manual && !manual[0].includes("isWeeklyReviewMember"));

const applyFn = src.match(/var applyReviewActions = async function[\s\S]{0,400}/);
ok("이월·완료 실행부는 그대로 (가드 없음)", !!applyFn && !applyFn[0].includes("isWeeklyReviewMember"));

// ── ③ 이름이 실제 계정과 일치하는가 (틀리면 조용히 아무에게도 안 뜬다)
console.log("\n■ 실제 계정 대조");
const tmp = "scripts/.weekly-probe.sql";
fs.writeFileSync(tmp, "select distinct name from public.profiles where status = 'approved' order by name;");
let rows;
try {
  const out = execFileSync("node", ["scripts/run-sql.js", tmp], { encoding: "utf8" });
  rows = JSON.parse(out.slice(out.indexOf("[", out.indexOf("결과:"))));
} finally { fs.unlinkSync(tmp); }
const approved = rows.map((r) => r.name);

WEEKLY_REVIEW_MEMBERS.forEach((n) => {
  ok(`'${n}' 이 승인된 계정에 있다`, approved.indexOf(n) >= 0, `승인 계정: ${approved.join(",")}`);
});
const excluded = approved.filter((n) => !isWeeklyReviewMember(n));
console.log(`  ℹ️ 자동 팝업 제외: ${excluded.join(", ")} (${excluded.length}명 — 버튼으로는 열 수 있다)`);

console.log(`\n결과: ${pass}/${pass + fail} 통과`);
process.exit(fail ? 1 : 0);
