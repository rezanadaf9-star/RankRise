-- RankRise academic marks: one row per exam + class + student + subject.
-- This migration keeps the most recently created row if old duplicates exist.
-- Review your current marks before running in production.

BEGIN;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY exam_name, class_name, student_id, subject
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.academic_marks
)
DELETE FROM public.academic_marks AS am
USING ranked AS r
WHERE am.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS academic_marks_one_subject_per_student_exam
ON public.academic_marks (exam_name, class_name, subject, student_id);

COMMIT;
