-- RankRise: enforce one attempt per student per quiz.
-- This migration handles the one duplicate pair identified in the user's Supabase screenshot.
-- It preserves the submitted score (48) and removes only the matching zero-score in-progress duplicate.
-- It aborts without committing if the expected records are not present or other duplicate pairs remain.

BEGIN;

DO $$
DECLARE
  submitted_count integer;
  in_progress_count integer;
  other_duplicate_groups integer;
BEGIN
  SELECT COUNT(*) INTO submitted_count
  FROM public.quiz_attempts
  WHERE quiz_id = '878bbd9d-6d8e-43a5-b4f4-502e966c5f94'::uuid
    AND student_id = '475745f7-2c5c-4b36-9f77-e1757e139fa1'::uuid
    AND status = 'submitted';

  SELECT COUNT(*) INTO in_progress_count
  FROM public.quiz_attempts
  WHERE quiz_id = '878bbd9d-6d8e-43a5-b4f4-502e966c5f94'::uuid
    AND student_id = '475745f7-2c5c-4b36-9f77-e1757e139fa1'::uuid
    AND status = 'in_progress'
    AND score = 0;

  IF submitted_count <> 1 OR in_progress_count <> 1 THEN
    RAISE EXCEPTION 'Stopped safely: expected exactly one submitted attempt and one zero-score in-progress duplicate for the identified student/quiz pair. No migration changes will be committed.';
  END IF;

  DELETE FROM public.quiz_attempts
  WHERE quiz_id = '878bbd9d-6d8e-43a5-b4f4-502e966c5f94'::uuid
    AND student_id = '475745f7-2c5c-4b36-9f77-e1757e139fa1'::uuid
    AND status = 'in_progress'
    AND score = 0;

  SELECT COUNT(*) INTO other_duplicate_groups
  FROM (
    SELECT quiz_id, student_id
    FROM public.quiz_attempts
    WHERE quiz_id IS NOT NULL
    GROUP BY quiz_id, student_id
    HAVING COUNT(*) > 1
  ) d;

  IF other_duplicate_groups > 0 THEN
    RAISE EXCEPTION 'Stopped safely: other student/quiz duplicate pairs remain. Transaction rolled back; inspect duplicates before rerunning.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_one_attempt_per_student_quiz
ON public.quiz_attempts (quiz_id, student_id)
WHERE quiz_id IS NOT NULL;

COMMIT;
