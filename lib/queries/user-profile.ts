import "server-only";

import { db } from "../db";
import type { UserProfile } from "../types/user-profile";

export type { UserProfile };

export class UserProfileError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UserProfileError";
    this.status = status;
  }
}

function formatEnumLabel(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile> {
  const orgModeResult = await db.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'entity_id'
      ) AS exists
    `,
  );
  const useEntity = orgModeResult.rows[0]?.exists ?? false;
  const orgIdColumn = useEntity ? "u.entity_id" : "u.department_id";
  const orgTable = useEntity ? "entities" : "departments";

  const designationResult = await db.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'designation'
      ) AS exists
    `,
  );
  const hasDesignation = designationResult.rows[0]?.exists ?? false;

  const dojResult = await db.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'date_of_joining'
      ) AS exists
    `,
  );
  const hasDoj = dojResult.rows[0]?.exists ?? false;

  const qualTableResult = await db.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'employee_qualifications'
      ) AS exists
    `,
  );
  const hasQualTable = qualTableResult.rows[0]?.exists ?? false;

  const result = await db.query<{
    employee_id: string;
    email: string;
    first_name: string;
    last_name: string;
    system_role: string;
    emp_category: string;
    emp_sub_category: string;
    designation: string | null;
    date_of_joining: string | null;
    qualification: string | null;
    qualification_year: string | null;
    qualification_subject: string | null;
    qualification_institute: string | null;
    qualification_country: string | null;
    entity_name: string | null;
    parent_entity_name: string | null;
    is_active: boolean;
  }>(
    `
      SELECT
        u.employee_id,
        u.email,
        u.first_name,
        u.last_name,
        u.system_role,
        u.emp_category,
        u.emp_sub_category,
        ${hasDesignation ? "u.designation" : "NULL::text AS designation"},
        ${hasDoj ? "u.date_of_joining::text" : "NULL::text"} AS date_of_joining,
        ${hasQualTable ? "eq.qualification" : "NULL::text"} AS qualification,
        ${hasQualTable ? "eq.year::text" : "NULL::text"} AS qualification_year,
        ${hasQualTable ? "eq.subject" : "NULL::text"} AS qualification_subject,
        ${hasQualTable ? "eq.institute" : "NULL::text"} AS qualification_institute,
        ${hasQualTable ? "eq.country" : "NULL::text"} AS qualification_country,
        org.name AS entity_name,
        parent_org.name AS parent_entity_name,
        u.is_active
      FROM users u
      LEFT JOIN ${orgTable} org ON org.id = ${orgIdColumn}
      LEFT JOIN ${orgTable} parent_org ON parent_org.id = org.parent_entity_id
      ${hasQualTable ? "LEFT JOIN LATERAL (SELECT qualification, year, subject, institute, country FROM employee_qualifications WHERE user_id = u.id ORDER BY is_primary DESC, id ASC LIMIT 1) eq ON true" : ""}
      WHERE lower(u.email) = lower($1)
      LIMIT 1
    `,
    [email],
  );

  const row = result.rows[0];
  if (!row) {
    throw new UserProfileError(`No profile was found for ${email}.`, 404);
  }

  return {
    employeeId: row.employee_id,
    firstName: row.first_name,
    lastName: row.last_name,
    emailAddress: row.email,
    entity: row.entity_name,
    orgLevel1: row.parent_entity_name ?? row.entity_name,
    orgLevel2: row.parent_entity_name ? row.entity_name : null,
    designation: row.designation ?? formatEnumLabel(row.emp_sub_category),
    dateOfJoining: row.date_of_joining ? row.date_of_joining.slice(0, 10) : null,
    qualification: row.qualification,
    qualificationYear: row.qualification_year,
    qualificationSubject: row.qualification_subject,
    qualificationInstitute: row.qualification_institute,
    qualificationCountry: row.qualification_country,
    mobileNumber: null,
    employmentStatus: row.is_active ? "1" : "0",
    systemRole: formatEnumLabel(row.system_role),
    empCategory: formatEnumLabel(row.emp_category),
  };
}
