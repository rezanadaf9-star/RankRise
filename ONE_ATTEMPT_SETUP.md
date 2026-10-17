# RankRise: one attempt per student per quiz

## What changed
- `assets/js/quiz-engine.js`: resumes an existing in-progress attempt; redirects a student with a submitted attempt to that attempt's analysis page; blocks abandoned attempts; handles simultaneous starts more safely.
- `assets/js/quizzes.js`: labels a quiz as in progress/completed and disables the Start button after a submitted or abandoned attempt.
- `supabase/migrations/20261017_one_attempt_per_student_quiz.sql`: removes only the known zero-score in-progress duplicate for the exact student/quiz pair shown in the user's screenshot, preserves the submitted attempt, checks for any other duplicate pairs, then creates a unique index.

## Apply
1. Back up your Supabase database first.
2. In Supabase Dashboard, open SQL Editor and run the contents of `supabase/migrations/20261017_one_attempt_per_student_quiz.sql` once.
3. If it raises an exception, the transaction rolls back. Do not remove the safeguards; inspect the remaining duplicate groups first.
4. Replace these files in the GitHub repository with the versions from this ZIP:
   - `assets/js/quiz-engine.js`
   - `assets/js/quizzes.js`
5. Commit/push and test with a test student account.

## Expected behavior
- Existing `in_progress` attempt: student can resume it.
- Existing `submitted` attempt: student is redirected to its analysis page and cannot start again.
- Existing `abandoned` attempt: student is blocked from starting again.
- Database unique index prevents a second attempt row for the same non-null quiz ID and student ID, including simultaneous requests.

This is tailored to the schema in `supabase/schema.sql`, which defines `public.quiz_attempts` with `quiz_id`, `student_id`, `status`, `score`, `started_at`, and `answers`.
