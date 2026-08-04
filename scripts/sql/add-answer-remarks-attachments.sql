-- Optional remarks + file attachments for per-question employee answers.

ALTER TABLE appraisal_answers
  ADD COLUMN IF NOT EXISTS remarks TEXT;

CREATE TABLE IF NOT EXISTS appraisal_answer_attachments (
  id BIGSERIAL PRIMARY KEY,
  appraisal_id BIGINT NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES form_questions(id) ON DELETE CASCADE,
  filled_by_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_answer_attachments_lookup
  ON appraisal_answer_attachments (appraisal_id, question_id, filled_by_id);
