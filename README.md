# RankRise

A mobile-first private quiz platform starter built with HTML, CSS, JavaScript and Supabase. The project includes the supplied logo, crown, and visual reference screenshots.

## Important status
This is a **starter implementation**, not a production-deployed service. The UI and browser-side flows are included; complete privileged account creation, final RLS hardening, and end-to-end testing require your Supabase project credentials and setup.

## Project structure
- `index.html` — login and session gate
- `dashboard.html` — student dashboard and leaderboard
- `quizzes.html` — subjects and quiz lists
- `quiz.html` — quiz engine with timer, question palette, autosave and submission
- `analysis.html` — attempt history and review
- `marks.html` — academic marks view
- `admin/index.html` — protected admin workspace starter
- `assets/css/` — responsive styles
- `assets/js/` — app, auth, data, quiz and admin modules
- `supabase/schema.sql` — schema, indexes and RLS policy starter
- `supabase/functions/` — Edge Function starter for admin-created student accounts

## Setup
1. Create a Supabase project.
2. Open `assets/js/supabase-config.js` and enter your Supabase Project URL and publishable/anon key.
3. Run `supabase/schema.sql` in Supabase SQL Editor.
4. Enable Email/Password authentication.
5. Create the first admin auth user in Supabase Dashboard, then set that user's `profiles.role` to `admin` using the SQL editor.
6. Deploy the Edge Function in `supabase/functions/create-student` after setting `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` as function secrets.
7. Serve the folder using a local static server or deploy to a static host (GitHub Pages works for the frontend).

## Private access
There is no public sign-up UI. Admin-created accounts are intended to be provisioned by the Edge Function. Never put the service-role key in browser JavaScript. Use RLS and server-side role checks; a hidden admin link is not security.

## Student ID / password
The starter Edge Function uses a server-generated ID and temporary password based on the sample format `26NC10NR` and `NR@9283`. Confirm/change the format before real use. Passwords are shown once to the admin and should not be stored in plaintext.

## Remaining production steps
- Configure project URL/key and deploy the Edge Function.
- Review/strengthen RLS with real role setup and test as admin/student/anonymous.
- Configure a private Storage bucket and signed/public image URL policy.
- Add final supplied brand screenshots/assets and verify on real phones.
- Test concurrent quiz submits, duplicate submits, reconnect/resume, and rank tie-breaking.
