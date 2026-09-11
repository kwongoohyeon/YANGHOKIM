// 🔐 이만나미 계정 권한 정리 검증 (2026-09-11)
// 실행: node scripts/test-imannami-access.mjs
//
// 왜 이렇게 하나: 명단을 여기에 옮겨 적으면 사본 검증이 된다.
//   · 판정 함수·명단을 **src/App.js 소스에서 떼어내 실제로 실행**한다.
//   · App.js `CHAT_TEAMS` ↔ SQL `chat_can_access()` 가 **한 쌍**이라, 파일 두 개와
//     **라이브 DB 함수 정의**까지 세 곳을 서로 대조한다. 한쪽만 고치면 여기서 깨진다.
//   · 이름이 `profiles.name` 과 한 글자라도 다르면 **에러 없이 조용히 실패**하므로 DB 로 대조한다.
//
// ⚠️ 명단이 바뀌면 아래 EXPECT_* 도 같이 고칠 것 — 그게 이 테스트의 목적이다.

import fs from "node:fs";
import { execFileSync } from "node:child_process";

const ME = "이만나미";
const GONE = ["현애", "인선", "미현"];          // 퇴사·명단 제외자
const EXPECT_INDIVIDUAL = ["양호", "동일", "관호", "지혜", "정원", "이만나미"];
const EXPECT_CORPORATE  = ["양호", "동일", "유진", "정원"];
const SQL_FILE = "이만나미_권한정리_채팅RLS_명단반영.sql";

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? " — " + detail : ""}`); }
};

const src = fs.readFileSync("src/App.js", "utf8");
const grab = (re, label) => {
  const m = src.match(re);
  if (!m) { console.error(`❌ ${label} 를 src/App.js 에서 못 찾았다.`); process.exit(1); }
  return m[0];
};
const pick = (re, label) => {
  const m = src.match(re);
  if (!m) { console.error(`❌ ${label} 를 src/App.js 에서 못 찾았다.`); process.exit(1); }
  // eslint-disable-next-line no-new-func
  return new Function("return (" + m[1] + ");")();
};

// ── ① 판정 로직을 소스째 떼어내 실행한다 (손으로 옮겨 적지 않는다)
const bundle = [
  grab(/const CHAT_TEAMS = \{[\s\S]*?\n\};/, "CHAT_TEAMS"),
  grab(/function canAccessChannel\(channel, name\) \{[\s\S]*?\n\}/, "canAccessChannel"),
  grab(/const SETTLEMENT_ADMINS = \[[^\]]*\];/, "SETTLEMENT_ADMINS"),
  grab(/function normalizeStaffName\(rawName\) \{[\s\S]*?\n\}/, "normalizeStaffName"),
  grab(/function settlementAssignees\(raw\) \{[\s\S]*?\n\}/, "settlementAssignees"),
  grab(/function canViewSettlement\(row, myName\) \{[\s\S]*?\n\}/, "canViewSettlement"),
].join("\n\n");

// eslint-disable-next-line no-new-func
const M = new Function(bundle + `
  return { CHAT_TEAMS, canAccessChannel, SETTLEMENT_ADMINS, canViewSettlement, settlementAssignees };
`)();

const ASSIGNEES    = pick(/const ASSIGNEES = (\[[^\]]*\]);/, "ASSIGNEES");
const TEAM_MEMBERS = pick(/const TEAM_MEMBERS = (\{[\s\S]*?\n\});/, "TEAM_MEMBERS");

console.log(`■ 소스에서 떼어낸 명단`);
console.log(`   CHAT_TEAMS.individual  = ${JSON.stringify(M.CHAT_TEAMS.individual)}`);
console.log(`   CHAT_TEAMS.corporate   = ${JSON.stringify(M.CHAT_TEAMS.corporate)}`);
console.log(`   ASSIGNEES              = ${JSON.stringify(ASSIGNEES)}`);
console.log(`   TEAM_MEMBERS.individual= ${JSON.stringify(TEAM_MEMBERS.individual)}`);
console.log(`   SETTLEMENT_ADMINS      = ${JSON.stringify(M.SETTLEMENT_ADMINS)}\n`);

// ── ② 명단 자체
console.log("■ 명단 (App.js)");
ok(`CHAT_TEAMS.individual = ${EXPECT_INDIVIDUAL.join("·")}`,
  M.CHAT_TEAMS.individual.join(",") === EXPECT_INDIVIDUAL.join(","), JSON.stringify(M.CHAT_TEAMS.individual));
ok(`CHAT_TEAMS.corporate = ${EXPECT_CORPORATE.join("·")}`,
  M.CHAT_TEAMS.corporate.join(",") === EXPECT_CORPORATE.join(","), JSON.stringify(M.CHAT_TEAMS.corporate));
ok(`ASSIGNEES 에 ${ME} 있다`, ASSIGNEES.indexOf(ME) >= 0);
ok(`TEAM_MEMBERS.individual 에 ${ME} 있다`, TEAM_MEMBERS.individual.indexOf(ME) >= 0);
ok(`TEAM_MEMBERS.all 에 ${ME} 있다 (합집합 계산)`,
  TEAM_MEMBERS.individual.concat(TEAM_MEMBERS.corporate).indexOf(ME) >= 0);
// 결정 2: 전체 열람 명단에는 넣지 않는다 — 본인 담당 건만 본다
ok(`SETTLEMENT_ADMINS 에 ${ME} 없다 (결정: 본인 담당만)`, M.SETTLEMENT_ADMINS.indexOf(ME) < 0);

console.log("\n■ 퇴사·제외자가 어느 명단에도 없다");
GONE.forEach((n) => {
  ok(`'${n}' — CHAT_TEAMS 양쪽에 없다`,
    M.CHAT_TEAMS.individual.indexOf(n) < 0 && M.CHAT_TEAMS.corporate.indexOf(n) < 0);
  ok(`'${n}' — ASSIGNEES 에 없다`, ASSIGNEES.indexOf(n) < 0);
  ok(`'${n}' — TEAM_MEMBERS 양쪽에 없다`,
    TEAM_MEMBERS.individual.indexOf(n) < 0 && TEAM_MEMBERS.corporate.indexOf(n) < 0);
});

// ── ③ 채널 접근 판정 (증상 1·2)
console.log("\n■ 채널 접근 (canAccessChannel)");
ok(`${ME} · 개인팀 = true  ← 증상 1 해소`, M.canAccessChannel("individual", ME) === true);
ok(`${ME} · 전체 = true    ← 증상 2`,      M.canAccessChannel("general", ME) === true);
ok(`${ME} · 법인팀 = false (개인전담이므로 정상)`, M.canAccessChannel("corporate", ME) === false);
ok(`${ME} · DM = true`, M.canAccessChannel("dm:" + [ME, "양호"].sort().join("|"), ME) === true);
ok("남의 DM = false", M.canAccessChannel("dm:양호|정원", ME) === false);
GONE.forEach((n) => {
  ok(`'${n}' 팀 채널 둘 다 false`,
    M.canAccessChannel("individual", n) === false && M.canAccessChannel("corporate", n) === false);
});
ok("빈 값·모르는 이름은 팀 채널 false",
  [null, undefined, "", "없는사람"].every((v) => M.canAccessChannel("individual", v) === false));
ok("기존 사람들의 접근이 그대로다",
  EXPECT_INDIVIDUAL.every((n) => M.canAccessChannel("individual", n) === true) &&
  EXPECT_CORPORATE.every((n) => M.canAccessChannel("corporate", n) === true));

// ── ④ 정산 열람 범위 (증상 3) — 본인 담당 건만
console.log("\n■ 정산 열람 (canViewSettlement) — 본인 담당만");
const row = (assignee) => ({ assignee });
ok(`${ME} 담당 건 → 보인다`,            M.canViewSettlement(row(ME), ME) === true);
ok(`공동담당 "양호, ${ME}" → 보인다`,   M.canViewSettlement(row("양호, " + ME), ME) === true);
ok("남의 단독 건 → 안 보인다",          M.canViewSettlement(row("양호"), ME) === false);
ok("담당자 빈 건 → 안 보인다",          M.canViewSettlement(row(""), ME) === false);
ok("담당자 null 건 → 안 보인다",        M.canViewSettlement(row(null), ME) === false);
ok(`${ME} 는 전체 열람이 아니다 (49건 중 본인 것만)`,
  M.canViewSettlement(row("관호"), ME) === false && M.canViewSettlement(row("유진, 동일"), ME) === false);
ok("기존 4명의 전체 열람은 그대로",
  M.SETTLEMENT_ADMINS.every((n) => M.canViewSettlement(row(""), n) === true));
ok(`${ME} 를 담당자로 고를 수 있다 (드롭다운은 ASSIGNEES)`, ASSIGNEES.indexOf(ME) >= 0);

// ── ⑤ 팀원 관리 메뉴는 role 기준 → member 로 낮추면 사라진다
console.log("\n■ 팀원 관리 메뉴 게이트");
const menuGate = src.match(/profile\.role === "admin" \? \[\{ id: "members"/);
ok('메뉴가 role === "admin" 으로만 걸려 있다 (이름 명단이 아니다)', !!menuGate);

// ── ⑥ App.js ↔ SQL 파일 ↔ 라이브 DB 함수 3중 대조 (한 쌍 보증)
console.log("\n■ App.js ↔ SQL 파일 명단 일치");
const sqlText = fs.readFileSync(SQL_FILE, "utf8");
const sqlArr = (ch) => {
  const m = sqlText.match(new RegExp("p_channel = '" + ch + "'\\s*then p_me = any \\(array\\[([^\\]]*)\\]\\)"));
  if (!m) { console.error(`❌ ${SQL_FILE} 에서 ${ch} 배열을 못 찾았다.`); process.exit(1); }
  return m[1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
};
ok("individual 이 App.js 와 글자 단위로 같다",
  sqlArr("individual").join(",") === M.CHAT_TEAMS.individual.join(","),
  `SQL=${JSON.stringify(sqlArr("individual"))}`);
ok("corporate 이 App.js 와 글자 단위로 같다",
  sqlArr("corporate").join(",") === M.CHAT_TEAMS.corporate.join(","),
  `SQL=${JSON.stringify(sqlArr("corporate"))}`);

// ── ⑦ DB 대조 — 이름·role·라이브 함수 정의
console.log("\n■ DB 대조 (실제 계정 · 라이브 함수)");
const tmp = "scripts/.imannami-probe.sql";
fs.writeFileSync(tmp, `
select json_build_object(
  'approved_names', (select json_agg(distinct name) from public.profiles where status = 'approved'),
  'me',             (select row_to_json(p) from public.profiles p where p.id = '91e42a4b-9787-47f9-b3ca-3e49de6e0197'),
  'live_fn',        (select pg_get_functiondef(p.oid) from pg_proc p
                       join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname = 'chat_can_access')
) as probe;
`);
let probe;
try {
  const out = execFileSync("node", ["scripts/run-sql.js", tmp], { encoding: "utf8" });
  probe = JSON.parse(out.slice(out.indexOf("[", out.indexOf("결과:"))))[0].probe;
} finally { fs.unlinkSync(tmp); }

const approved = probe.approved_names || [];
ok(`'${ME}' 가 승인된 계정에 실재한다 (오타 아님)`, approved.indexOf(ME) >= 0, `승인 계정: ${approved.join(",")}`);
ok(`profiles.name 이 정확히 '${ME}'`, probe.me && probe.me.name === ME, JSON.stringify(probe.me));
ok(`profiles.role = 'member' (admin 에서 낮춤)`, probe.me && probe.me.role === "member", probe.me && probe.me.role);
ok(`profiles.status = 'approved'`, probe.me && probe.me.status === "approved");
ok(`profiles.team = '개인전담'`, probe.me && probe.me.team === "개인전담");

const liveArr = (ch) => {
  const m = (probe.live_fn || "").match(new RegExp("p_channel = '" + ch + "'\\s*then p_me = any \\(array\\[([^\\]]*)\\]\\)"));
  return m ? m[1].split(",").map((s) => s.trim().replace(/^'|'$/g, "")) : null;
};
ok("라이브 DB 함수 individual 이 App.js 와 같다",
  !!liveArr("individual") && liveArr("individual").join(",") === M.CHAT_TEAMS.individual.join(","),
  `live=${JSON.stringify(liveArr("individual"))}`);
ok("라이브 DB 함수 corporate 이 App.js 와 같다",
  !!liveArr("corporate") && liveArr("corporate").join(",") === M.CHAT_TEAMS.corporate.join(","),
  `live=${JSON.stringify(liveArr("corporate"))}`);
ok("라이브 DB 함수에 퇴사자 3명이 없다", !/(현애|인선|미현)/.test(probe.live_fn || "x"));

// ASSIGNEES 에 승인 계정이 아닌 이름이 섞이지 않았는지 (조용한 실패 예방)
const ghosts = ASSIGNEES.filter((n) => approved.indexOf(n) < 0);
ok("ASSIGNEES 전원이 승인된 계정이다", ghosts.length === 0, `계정 없는 이름: ${ghosts.join(",")}`);

console.log(`\n결과: ${pass}/${pass + fail} 통과`);
process.exit(fail ? 1 : 0);
