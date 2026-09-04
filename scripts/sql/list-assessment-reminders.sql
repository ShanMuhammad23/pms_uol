-- Sanity check: who would receive assessment reminders RIGHT NOW?
-- Employee source of truth = form assignment in the active cycle
-- (self-assessment enabled, not completed yet).

WITH active_cycle AS (
  SELECT id, fiscal_year
  FROM appraisal_cycles
  ORDER BY is_active DESC, fiscal_year DESC
  LIMIT 1
),

employee_due AS (
  SELECT
    'employee'::text AS audience,
    efa.id AS assignment_id,
    ap.id AS appraisal_id,
    u.employee_id AS sap_code,
    CONCAT(u.first_name, ' ', u.last_name) AS recipient_name,
    u.email AS recipient_email,
    ft.title AS form_title,
    NULL::int AS direct_assessment_count,
    NULL::int AS pending_review_count,
    efa.last_self_assessment_reminder_at AS last_reminder_at,
    CASE
      WHEN ap.id IS NULL THEN 'assigned (no appraisal yet)'
      ELSE 'PENDING_SELF_ASSESSMENT'
    END AS workflow,
    CASE
      WHEN efa.last_self_assessment_reminder_at IS NULL THEN 'due (never sent)'
      ELSE 'due (cooldown elapsed)'
    END AS reminder_status
  FROM employee_form_assignments efa
  INNER JOIN form_templates ft ON ft.id = efa.template_id
  INNER JOIN active_cycle ac ON ac.id = ft.cycle_id
  INNER JOIN users u ON u.id = efa.employee_id
  LEFT JOIN appraisals ap
    ON ap.employee_id = u.id
   AND ap.cycle_id = ft.cycle_id
  WHERE efa.self_assessment_disabled = FALSE
    AND u.is_active = TRUE
    AND COALESCE(u.assessment_eligibility, TRUE) = TRUE
    AND u.employee_id <> 'EMP-0001'
    AND u.email IS NOT NULL
    AND BTRIM(u.email) <> ''
    AND (
      ap.id IS NULL
      OR (
        ap.status = 'PENDING_SELF_ASSESSMENT'
        AND ap.submitted_at IS NULL
      )
    )
    AND (
      efa.last_self_assessment_reminder_at IS NULL
      OR efa.last_self_assessment_reminder_at
           <= (CURRENT_TIMESTAMP - INTERVAL '48 hours')
    )
),

manager_due AS (
  WITH pending AS (
    SELECT
      CASE
        WHEN COALESCE(ap.manager_level, 1) <= 1 THEN emp.head_id
        ELSE emp.manager_2_id
      END AS manager_id,
      efa.self_assessment_disabled
    FROM appraisals ap
    INNER JOIN active_cycle ac ON ac.id = ap.cycle_id
    INNER JOIN users emp ON emp.id = ap.employee_id
    INNER JOIN employee_form_assignments efa
      ON efa.employee_id = emp.id
     AND efa.template_id = ap.template_id
    WHERE ap.status = 'PENDING_HEAD_REVIEW'
      AND ap.template_id IS NOT NULL
      AND emp.is_active = TRUE
      AND COALESCE(emp.assessment_eligibility, TRUE) = TRUE
      AND emp.employee_id <> 'EMP-0001'
  ),
  counts AS (
    SELECT
      manager_id,
      COUNT(*) FILTER (WHERE self_assessment_disabled = TRUE)::int
        AS direct_assessment_count,
      COUNT(*) FILTER (WHERE self_assessment_disabled = FALSE)::int
        AS pending_review_count
    FROM pending
    WHERE manager_id IS NOT NULL
    GROUP BY manager_id
  )
  SELECT
    'manager'::text AS audience,
    NULL::bigint AS assignment_id,
    NULL::bigint AS appraisal_id,
    m.employee_id AS sap_code,
    CONCAT(m.first_name, ' ', m.last_name) AS recipient_name,
    m.email AS recipient_email,
    NULL::text AS form_title,
    c.direct_assessment_count,
    c.pending_review_count,
    m.last_manager_reminder_at AS last_reminder_at,
    'PENDING_HEAD_REVIEW'::text AS workflow,
    CASE
      WHEN m.last_manager_reminder_at IS NULL THEN 'due (never sent)'
      ELSE 'due (cooldown elapsed)'
    END AS reminder_status
  FROM counts c
  INNER JOIN users m ON m.id = c.manager_id
  WHERE m.is_active = TRUE
    AND m.email IS NOT NULL
    AND BTRIM(m.email) <> ''
    AND (c.direct_assessment_count + c.pending_review_count) > 0
    AND (
      m.last_manager_reminder_at IS NULL
      OR m.last_manager_reminder_at
           <= (CURRENT_TIMESTAMP - INTERVAL '3 days')
    )
)

SELECT * FROM employee_due
UNION ALL
SELECT * FROM manager_due
ORDER BY audience, recipient_email;
