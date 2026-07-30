-- Security audit remediation: dedicated security event stream
-- (appraisal_logs remains appraisal-domain; do not overload it.)

CREATE TABLE IF NOT EXISTS security_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    path TEXT,
    method VARCHAR(16),
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_type_created
  ON security_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_actor_created
  ON security_events (actor_user_id, created_at DESC)
  WHERE actor_user_id IS NOT NULL;

-- Optional anomaly view: repeated authz denials per actor in 15 minutes
-- SELECT actor_user_id, count(*) AS denials
-- FROM security_events
-- WHERE event_type = 'AUTHZ_DENIED'
--   AND created_at > now() - interval '15 minutes'
-- GROUP BY actor_user_id
-- HAVING count(*) >= 10;
