-- RankRise: starter schema for Supabase
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  student_id text unique,
  auth_email text unique,
  class_name text not null default '10',
  roll_number text,
  phone text,
  photo_url text,
  role text not null default 'student' check (role in ('admin','student')),
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now()
);
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);
insert into public.subjects(name,sort_order) values
 ('Science',1),('Social Science',2),('Mathematics',3),('Urdu',4),('Hindi',5),('English',6)
on conflict(name) do nothing;

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  class_name text not null default '10',
  duration_minutes int not null default 15 check(duration_minutes > 0),
  positive_marks numeric not null default 1,
  negative_marks numeric not null default 0 check(negative_marks >= 0),
  published boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  question_count int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position int not null,
  question_text text not null,
  options jsonb not null,
  correct_answer text not null,
  explanation text not null default '',
  hint text not null default '',
  unique(quiz_id,position)
);
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete set null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'in_progress' check(status in ('in_progress','submitted','abandoned')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  score numeric not null default 0,
  correct_count int not null default 0,
  incorrect_count int not null default 0,
  unanswered_count int not null default 0,
  elapsed_seconds int not null default 0,
  answers jsonb not null default '{}'::jsonb
);
create index if not exists attempts_student_date_idx on public.quiz_attempts(student_id,submitted_at desc);
create index if not exists attempts_quiz_status_idx on public.quiz_attempts(quiz_id,status);

create table if not exists public.academic_marks (
  id uuid primary key default gen_random_uuid(),
  exam_name text not null,
  exam_date date,
  class_name text not null default '10',
  subject text not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  marks_obtained numeric not null default 0,
  full_marks numeric not null default 100 check(full_marks > 0),
  class_rank int,
  published boolean not null default false,
  entered_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.app_settings (
  id int primary key default 1 check(id=1),
  website_url text not null default '',
  site_name text not null default 'RankRise',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.app_settings(id) values(1) on conflict(id) do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and status='active') $$;

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.academic_marks enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "profiles self or admin read" on public.profiles;
create policy "profiles self or admin read" on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
drop policy if exists "admin manages profiles" on public.profiles;
create policy "admin manages profiles" on public.profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "authenticated read subjects" on public.subjects;
create policy "authenticated read subjects" on public.subjects for select to authenticated using(true);
drop policy if exists "admin manages subjects" on public.subjects;
create policy "admin manages subjects" on public.subjects for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "students read published quizzes" on public.quizzes;
create policy "students read published quizzes" on public.quizzes for select to authenticated using(published=true or public.is_admin());
drop policy if exists "admin manages quizzes" on public.quizzes;
create policy "admin manages quizzes" on public.quizzes for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "students read published questions" on public.questions;
create policy "students read published questions" on public.questions for select to authenticated using(exists(select 1 from public.quizzes q where q.id=quiz_id and q.published=true) or public.is_admin());
drop policy if exists "admin manages questions" on public.questions;
create policy "admin manages questions" on public.questions for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "student reads own attempts" on public.quiz_attempts;
create policy "student reads own attempts" on public.quiz_attempts for select to authenticated using(student_id=auth.uid() or public.is_admin());
drop policy if exists "student creates own attempts" on public.quiz_attempts;
create policy "student creates own attempts" on public.quiz_attempts for insert to authenticated with check(student_id=auth.uid());
drop policy if exists "student updates own attempts" on public.quiz_attempts;
create policy "student updates own attempts" on public.quiz_attempts for update to authenticated using(student_id=auth.uid() and status='in_progress' or public.is_admin()) with check(student_id=auth.uid() or public.is_admin());
drop policy if exists "students read own marks" on public.academic_marks;
create policy "students read own marks" on public.academic_marks for select to authenticated using((student_id=auth.uid() and published=true) or public.is_admin());
drop policy if exists "admin manages marks" on public.academic_marks;
create policy "admin manages marks" on public.academic_marks for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "authenticated read settings" on public.app_settings;
create policy "authenticated read settings" on public.app_settings for select to authenticated using(true);
drop policy if exists "admin manages settings" on public.app_settings;
create policy "admin manages settings" on public.app_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Login maps a typed student ID to the synthetic Auth email. Password checking remains in Supabase Auth.
create or replace function public.resolve_student_login(p_student_id text)
returns jsonb language sql stable security definer set search_path=public
as $$
 select jsonb_build_object('auth_email',auth_email)
 from public.profiles
 where upper(student_id)=upper(trim(p_student_id)) and status='active'
 limit 1
$$;
revoke all on function public.resolve_student_login(text) from public;
grant execute on function public.resolve_student_login(text) to anon, authenticated;

-- Leaderboards return scores for the active student's class. Keep photo URLs public only if using a public bucket.
create or replace function public.get_latest_quiz_leaderboard(p_class text default '10')
returns table(id uuid,full_name text,photo_url text,score numeric,rank bigint)
language sql stable security definer set search_path=public
as $$
 with latest as (select q.id from public.quizzes q where q.published=true and q.class_name=p_class order by q.created_at desc limit 1),
 scores as (select a.student_id, max(a.score) score from public.quiz_attempts a join latest l on l.id=a.quiz_id where a.status='submitted' group by a.student_id)
 select p.id,p.full_name,p.photo_url,s.score,dense_rank() over(order by s.score desc) from scores s join public.profiles p on p.id=s.student_id where p.status='active' order by s.score desc
$$;
create or replace function public.get_cumulative_leaderboard(p_class text default '10')
returns table(id uuid,full_name text,photo_url text,score numeric,rank bigint)
language sql stable security definer set search_path=public
as $$
 with scores as (select a.student_id,sum(a.score) score from public.quiz_attempts a join public.quizzes q on q.id=a.quiz_id where a.status='submitted' and q.class_name=p_class group by a.student_id)
 select p.id,p.full_name,p.photo_url,s.score,dense_rank() over(order by s.score desc) from scores s join public.profiles p on p.id=s.student_id where p.status='active' order by s.score desc
$$;
