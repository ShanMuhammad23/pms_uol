-- Allow decimal min/max scores on performance quartiles
ALTER TABLE performance_quartiles
  ALTER COLUMN score_min TYPE NUMERIC(10, 2) USING score_min::numeric,
  ALTER COLUMN score_max TYPE NUMERIC(10, 2) USING score_max::numeric;
