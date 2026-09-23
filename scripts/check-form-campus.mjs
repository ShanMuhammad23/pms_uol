import { db } from "../lib/db.ts";

const r = await db.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'form_templates' AND column_name = 'campus_id'`);
console.log("column:", r.rows);

const q = await db.query(`
  SELECT ft.id, ft.title, camp.name AS campus_name
  FROM form_templates ft
  LEFT JOIN campuses camp ON camp.id = ft.campus_id
  LIMIT 5`);
console.log(q.rows);

const camps = await db.query(`SELECT id, name FROM campuses ORDER BY name`);
console.log("campuses:", camps.rows);
process.exit(0);
