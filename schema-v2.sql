-- ============================================================================
-- SCHEMA V2 — Missing tables & columns for the live app
-- Run this in Supabase SQL Editor AFTER schema.sql (fresh project re-setup).
-- Safe: uses IF NOT EXISTS / IF NOT EXISTS-style guards, additive ALTERs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) ALTERs to base schema tables (schema.sql me missing columns)
-- ----------------------------------------------------------------------------

-- users: streak + goal + shift fields (focus, dashboard, leaderboard use these)
alter table users add column if not exists current_streak int not null default 0;
alter table users add column if not exists longest_streak int not null default 0;
alter table users add column if not exists last_focus_date date;
alter table users add column if not exists daily_goal_minutes int not null default 480;
alter table users add column if not exists selected_shift_id uuid;

-- Leaderboard reads all users' profiles (public board)
create policy "Authenticated users can read profiles"
  on users for select using (auth.role() = 'authenticated');

-- daily_logs: study-mode breakdown (focus + analytics use these)
alter table daily_logs add column if not exists theory_minutes int not null default 0;
alter table daily_logs add column if not exists practice_minutes int not null default 0;
alter table daily_logs add column if not exists revision_minutes int not null default 0;
alter table daily_logs add column if not exists verified_minutes int not null default 0;

-- Leaderboard reads everyone's verified minutes
create policy "Authenticated users can read daily logs"
  on daily_logs for select using (auth.role() = 'authenticated');

-- chapters: syllabus-scope flags (library page)
alter table chapters add column if not exists in_competitive_syllabus boolean not null default true;
alter table chapters add column if not exists jee_scope text not null default 'common';
alter table chapters add column if not exists neet_scope text not null default 'common';

-- tasks: priority (dashboard)
alter table tasks add column if not exists priority text not null default 'medium';

-- ----------------------------------------------------------------------------
-- 0b) Rename the original quiz-bank "tests" table (from schema.sql).
-- The live app/tests page uses "tests" as the USER TEST-LOG table, so the old
-- admin quiz-bank shape can't stay under that name. FKs keep pointing to the
-- renamed table (Postgres tracks them by OID).
-- ----------------------------------------------------------------------------
alter table tests rename to quiz_tests;

-- ----------------------------------------------------------------------------
-- 1) GROUPS MODULE
-- ----------------------------------------------------------------------------
create table if not exists study_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  target_exam text not null default 'JEE',
  member_count int not null default 1,
  is_private boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',  -- 'member' | 'admin'
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists group_join_requests (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

alter table study_groups enable row level security;
alter table group_members enable row level security;
alter table group_join_requests enable row level security;

create policy "Anyone can browse study groups"
  on study_groups for select using (auth.role() = 'authenticated');
create policy "Users create own groups"
  on study_groups for insert with check (auth.uid() = created_by);
create policy "Group creator can update own group"
  on study_groups for update using (auth.uid() = created_by);

create policy "Anyone can read group members"
  on group_members for select using (auth.role() = 'authenticated');
create policy "Users join groups as themselves"
  on group_members for insert with check (auth.uid() = user_id);

create policy "Users read own join requests"
  on group_join_requests for select using (auth.uid() = user_id);
create policy "Users create own join requests"
  on group_join_requests for insert with check (auth.uid() = user_id);
create policy "Users update own join requests"
  on group_join_requests for update using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 2) FOCUS MODULE (focus timer + analytics)
-- ----------------------------------------------------------------------------
create table if not exists focus_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds int not null default 0,
  counts_for_streak boolean not null default true,
  subject text,
  task_type text,                          -- 'theory' | 'questions' | 'revision'
  created_at timestamptz not null default now()
);

create index if not exists idx_focus_sessions_user on focus_sessions(user_id, started_at);

alter table focus_sessions enable row level security;
create policy "Users manage own focus sessions"
  on focus_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3) QUESTION LOGS (dashboard Q-log + library practice sessions)
-- ----------------------------------------------------------------------------
create table if not exists question_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_count int not null default 0,
  log_date date not null default current_date,
  topic_name text,
  start_from int,
  end_on int,
  subject_id uuid references subjects(id),
  chapter_id uuid references chapters(id),
  time_from text,
  time_to text,
  source text not null default 'manual',    -- 'manual' | 'timer'
  created_at timestamptz not null default now()
);

create index if not exists idx_question_logs_user on question_logs(user_id, log_date);

alter table question_logs enable row level security;
create policy "Users manage own question logs"
  on question_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists question_practice_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  attempted int not null default 0,
  correct int not null default 0,
  incorrect int not null default 0,
  unattempted int not null default 0,
  attempt_date date not null default current_date,
  start_time text,
  end_time text,
  accuracy numeric,
  created_at timestamptz not null default now()
);

alter table question_practice_logs enable row level security;
create policy "Users manage own practice logs"
  on question_practice_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4) CHAPTER PROGRESS (library page)
-- ----------------------------------------------------------------------------
create table if not exists chapter_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  status text not null default 'not_started',  -- 'not_started' | 'in_progress' | 'done'
  is_backlog boolean not null default false,
  revision_count int not null default 0,
  total_questions_solved int not null default 0,
  accuracy int,
  updated_at timestamptz not null default now(),
  unique (user_id, chapter_id)
);

alter table chapter_progress enable row level security;
create policy "Users manage own chapter progress"
  on chapter_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5) TESTS MODULE (user test logs + schedules)
-- app/tests page -> "tests" + "test_schedules"
-- dashboard      -> "test_logs" + "test_schedule"
-- ----------------------------------------------------------------------------
create table if not exists tests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null default 'chapter',   -- 'chapter' | 'subject' | 'full_syllabus'
  test_name text not null,
  total_questions int not null default 0,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  unattempted_count int not null default 0,
  marks_scored numeric,
  max_marks numeric,
  physics_marks numeric,
  chemistry_marks numeric,
  maths_marks numeric,
  accuracy numeric,
  test_date date not null default current_date,
  subject_id uuid references subjects(id),
  chapter_id uuid references chapters(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_tests_user on tests(user_id, test_date);

create table if not exists test_schedules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  scope text not null default 'chapter',
  subject_id uuid references subjects(id),
  chapter_id uuid references chapters(id),
  scheduled_date date not null default current_date,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists test_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_name text not null,
  total_marks numeric,
  max_marks numeric,
  accuracy numeric,
  test_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists test_schedule (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_name text not null,
  scheduled_date date not null default current_date,
  subject text,
  status text not null default 'upcoming',  -- 'upcoming' | 'completed'
  created_at timestamptz not null default now()
);

alter table tests enable row level security;
alter table test_schedules enable row level security;
alter table test_logs enable row level security;
alter table test_schedule enable row level security;

create policy "Users manage own tests" on tests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own test schedules" on test_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own test logs" on test_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own test schedule" on test_schedule
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 6) DASHBOARD CONTENT (motivation / meme cards)
-- ----------------------------------------------------------------------------
create table if not exists daily_content (
  id uuid primary key default uuid_generate_v4(),
  content_type text not null default 'motivation',  -- 'motivation' | 'meme'
  quote text not null,
  quote_source text not null default 'human',       -- 'human' | 'anime'
  character text,
  show text,
  icon_or_sticker text,
  gradient_color text,
  bg_color text,
  border_color text,
  text_color text,
  badge_color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table daily_content enable row level security;
-- Public read for signed-in users; writes via service role (admin)
create policy "Authenticated users can read active content"
  on daily_content for select using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 7) EXAM SCHEDULE MODULE (dashboard countdown cards)
--    NOTE: empty for now — add rows via admin/service role when dates are fixed.
-- ----------------------------------------------------------------------------
create table if not exists exam_schedule (
  id uuid primary key default uuid_generate_v4(),
  year int not null,
  display_order int not null default 0,
  label text not null,                     -- e.g. 'JEE Main Session 1'
  exam_date date not null,
  is_confirmed boolean not null default false,  -- false = projected date
  created_at timestamptz not null default now()
);

create table if not exists exam_shifts (
  id uuid primary key default uuid_generate_v4(),
  exam_schedule_id uuid not null references exam_schedule(id) on delete cascade,
  shift_date date,
  shift_time text,                         -- e.g. '09:00 - 12:00'
  created_at timestamptz not null default now()
);

alter table exam_schedule enable row level security;
alter table exam_shifts enable row level security;
create policy "Authenticated users can read exam schedule"
  on exam_schedule for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read exam shifts"
  on exam_shifts for select using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 8) PUSH NOTIFICATIONS (FCM tokens)
-- ----------------------------------------------------------------------------
create table if not exists user_fcm_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table user_fcm_tokens enable row level security;
create policy "Users manage own FCM tokens" on user_fcm_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- DONE. Order of use:
--   1. schema.sql   (base: users, subjects, chapters, batches, tasks, ...)
--   2. schema-v2.sql (this file)
-- ============================================================================
