import pg from "pg";
import { readFileSync } from "fs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Resolve entity -> effective campus (first non-null ancestor campus_id)
const resolved = await pool.query(
  `WITH RECURSIVE chain AS (
     SELECT e.id AS entity_id, e.campus_id, e.parent_entity_id, 0 AS depth
     FROM entities e
     UNION ALL
     SELECT c.entity_id, e.campus_id, e.parent_entity_id, c.depth + 1
     FROM chain c
     JOIN entities e ON e.id = c.parent_entity_id
     WHERE c.campus_id IS NULL AND c.depth < 10
   )
   SELECT entity_id, campus_id FROM chain WHERE campus_id IS NOT NULL`,
);
const campusOf = new Map(resolved.rows.map((r) => [Number(r.entity_id), Number(r.campus_id)]));

const campusOfUser = async () => {
  const users = await pool.query(`SELECT id, entity_id FROM users WHERE is_active = TRUE`);
  const map = new Map();
  for (const u of users.rows) {
    map.set(Number(u.id), u.entity_id != null ? campusOf.get(Number(u.entity_id)) ?? null : null);
  }
  return map;
};
const userCampus = await campusOfUser();

// 1. Performance matrix assignments per campus (active FY)
const pma = await pool.query(
  `SELECT epma.employee_id, epma.matrix_label
   FROM employee_performance_matrix_assignments epma
   JOIN financial_years fy ON fy.id = epma.financial_year_id AND fy.is_active = TRUE`,
);
const perCampus = new Map();
for (const r of pma.rows) {
  const c = userCampus.get(Number(r.employee_id)) ?? "none";
  const key = `${c}|${r.matrix_label}`;
  perCampus.set(key, (perCampus.get(key) ?? 0) + 1);
}
console.log("=== PERF MATRIX ASSIGNMENTS (active FY) by campus|label ===");
console.table([...perCampus.entries()].map(([k, n]) => {
  const [campus, label] = k.split("|");
  return { campus, label, employees: n };
}));

// 2. Employees with an appraisal but NO perf matrix assignment, per campus
const apUsers = await pool.query(
  `SELECT DISTINCT a.employee_id, u.entity_id
   FROM appraisals a JOIN users u ON u.id = a.employee_id`,
);
const assignedSet = new Set(pma.rows.map((r) => Number(r.employee_id)));
const missing = new Map();
for (const r of apUsers.rows) {
  const c = userCampus.get(Number(r.employee_id)) ?? "none";
  const has = assignedSet.has(Number(r.employee_id));
  const key = `${c}|${has ? "assigned" : "NO_ASSIGNMENT"}`;
  missing.set(key, (missing.get(key) ?? 0) + 1);
}
console.log("=== APPRAISED EMPLOYEES: campus | assignment status ===");
console.table([...missing.entries()].map(([k, n]) => {
  const [campus, status] = k.split("|");
  return { campus, status, employees: n };
}));

// 3. bandsByLabel keys (what resolution matches against)
const bands = await pool.query(
  `SELECT DISTINCT pl.matrix_label
   FROM performance_quartiles pq
   JOIN performance_levels pl ON pl.id = pq.performance_level_id
   JOIN financial_years fy ON fy.id = pl.financial_year_id
   WHERE fy.is_active = TRUE ORDER BY pl.matrix_label`,
);
console.log("=== bandsByLabel KEYS (active FY performance_levels.matrix_label) ===");
console.table(bands.rows);

// 4. Score(O) presence per campus — manager1Score/manager2Score on appraisals
const scores = await pool.query(
  `SELECT a.employee_id,
          a.manager1_score, a.manager2_score, a.status::text
   FROM appraisals a`,
);
const perCampusScore = new Map();
for (const s of scores.rows) {
  const c = userCampus.get(Number(s.employee_id)) ?? "none";
  const hasScore = (s.manager2_score ?? s.manager1_score) != null;
  const key = `${c}|${hasScore ? "has_scoreO" : "no_scoreO"}|${s.status}`;
  perCampusScore.set(key, (perCampusScore.get(key) ?? 0) + 1);
}
console.log("=== APPRAISALS: campus | Score(O) | status ===");
console.table([...perCampusScore.entries()].map(([k, n]) => {
  const [campus, score, status] = k.split("|");
  return { campus, score, status, count: n };
}));

await pool.end();
