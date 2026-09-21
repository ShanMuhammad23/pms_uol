import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("BEGIN");

  const res = await client.query(
    `UPDATE appraisal_answers m2
     SET    remarks = NULL
     FROM   appraisals a
     JOIN   users emp         ON emp.id = a.employee_id
     JOIN   appraisal_answers m1
            ON  m1.appraisal_id = a.id
            AND m1.filled_by_id = emp.head_id
            AND NULLIF(BTRIM(m1.remarks),'') IS NOT NULL
     WHERE  m2.appraisal_id = a.id
     AND    m2.filled_by_id = emp.manager_2_id
     AND    m2.question_id IS NOT DISTINCT FROM m1.question_id
     AND    m2.open_section_id IS NOT DISTINCT FROM m1.open_section_id
     AND    m2.remarks = m1.remarks`,
  );

  console.log(`Updated ${res.rowCount} M2 answer rows (remarks → NULL)`);
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release();
  await pool.end();
}
