import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("BEGIN");

  const res = await client.query(
    `UPDATE appraisal_answers m
     SET    remarks = NULL
     FROM   appraisals a
     JOIN   users emp        ON emp.id = a.employee_id
     JOIN   appraisal_answers e
            ON  e.appraisal_id = a.id
            AND e.filled_by_id = a.employee_id
            AND NULLIF(BTRIM(e.remarks),'') IS NOT NULL
     WHERE  m.appraisal_id = a.id
     AND    m.filled_by_id = emp.head_id
     AND    m.question_id IS NOT DISTINCT FROM e.question_id
     AND    m.open_section_id IS NOT DISTINCT FROM e.open_section_id
     AND    m.remarks = e.remarks`,
  );

  console.log(`Updated ${res.rowCount} M1 answer rows (remarks → NULL)`);
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release();
  await pool.end();
}
