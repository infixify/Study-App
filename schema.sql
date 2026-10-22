-- ============================================================================
-- PREPWISE — COMPLETE SUPABASE SETUP (single file, IDEMPOTENT)
-- Safe to run ANY number of times (fresh or repeated run) — existing objects
-- are skipped, nothing is dropped, no duplicate seeds.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- ENUMS (idempotent)
-- ----------------------------------------------------------------------------
do $$ begin
  create type class_level_enum as enum ('11', '12', '11_12', 'Dropper');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type target_exam_enum as enum ('JEE', 'NEET', 'Boards');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type study_mode_enum as enum ('Online', 'Offline', 'Self');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type resource_type_enum as enum ('pdf', 'micro_video');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type task_status_enum as enum ('pending', 'completed', 'backlog');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type task_type_enum as enum ('todo', 'backlog');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type question_difficulty_enum as enum ('easy', 'medium', 'hard');
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- USERS
-- ============================================================================
create table if not exists batches (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  mode study_mode_enum not null,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists users (
  uid uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  class_level class_level_enum not null,
  target_exam target_exam_enum not null,
  wants_boards boolean not null default false,
  study_mode study_mode_enum not null,
  batch_or_branch_id uuid references batches(id),
  avatar_url text,
  onboarding_completed boolean not null default false,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_focus_date date,
  daily_goal_minutes int not null default 480,
  selected_shift_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_users_target_exam on users(target_exam);
create index if not exists idx_users_class_level on users(class_level);

alter table users enable row level security;
drop policy if exists "Users can view own profile" on users;
create policy "Users can view own profile" on users for select using (auth.uid() = uid);
drop policy if exists "Users can update own profile" on users;
create policy "Users can update own profile" on users for update using (auth.uid() = uid);
drop policy if exists "Users can insert own profile" on users;
create policy "Users can insert own profile" on users for insert with check (auth.uid() = uid);
drop policy if exists "Authenticated users can read profiles" on users;
create policy "Authenticated users can read profiles" on users for select using (auth.role() = 'authenticated');

create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
for each row execute function set_updated_at();

-- ============================================================================
-- CONTENT
-- ============================================================================
create table if not exists subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  target_exam target_exam_enum not null,
  class_level class_level_enum not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists chapters (
  id uuid primary key default uuid_generate_v4(),
  subject_id uuid not null references subjects(id) on delete cascade,
  title text not null,
  description text,
  is_tough_topic boolean not null default false,
  in_competitive_syllabus boolean not null default true,
  jee_scope text not null default 'common',
  neet_scope text not null default 'common',
  display_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_chapters_subject on chapters(subject_id);

create table if not exists resources (
  id uuid primary key default uuid_generate_v4(),
  chapter_id uuid not null references chapters(id) on delete cascade,
  resource_type resource_type_enum not null,
  title text not null,
  url text not null,
  duration_seconds int,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_resources_chapter on resources(chapter_id);

alter table subjects enable row level security;
alter table chapters enable row level security;
alter table resources enable row level security;
drop policy if exists "Authenticated users can read subjects" on subjects;
create policy "Authenticated users can read subjects" on subjects for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can read chapters" on chapters;
create policy "Authenticated users can read chapters" on chapters for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can read resources" on resources;
create policy "Authenticated users can read resources" on resources for select using (auth.role() = 'authenticated');

-- ============================================================================
-- QUIZ BANK (admin mock tests)
-- ============================================================================
create table if not exists quiz_tests (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  subject_id uuid references subjects(id),
  target_exam target_exam_enum not null,
  duration_minutes int not null default 60,
  marks_per_correct numeric not null default 4,
  negative_marks_per_wrong numeric not null default 1,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default uuid_generate_v4(),
  test_id uuid not null references quiz_tests(id) on delete cascade,
  question_text text not null,
  image_url text,
  difficulty question_difficulty_enum not null default 'medium',
  correct_option_id uuid,
  explanation text,
  display_order int not null default 0
);

create table if not exists question_options (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references questions(id) on delete cascade,
  option_text text not null,
  display_order int not null default 0
);

do $$ begin
  alter table questions add constraint fk_correct_option
    foreign key (correct_option_id) references question_options(id);
exception when duplicate_object then null;
end $$;
create index if not exists idx_questions_test on questions(test_id);
create index if not exists idx_options_question on question_options(question_id);

create table if not exists test_attempts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(uid) on delete cascade,
  test_id uuid not null references quiz_tests(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  total_score numeric,
  accuracy numeric,
  correct_count int default 0,
  wrong_count int default 0,
  skipped_count int default 0
);
create index if not exists idx_attempts_user on test_attempts(user_id);
create index if not exists idx_attempts_test on test_attempts(test_id);

create table if not exists attempt_answers (
  id uuid primary key default uuid_generate_v4(),
  attempt_id uuid not null references test_attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  selected_option_id uuid references question_options(id),
  is_correct boolean,
  time_taken_seconds int
);
create index if not exists idx_answers_attempt on attempt_answers(attempt_id);

alter table quiz_tests enable row level security;
alter table questions enable row level security;
alter table question_options enable row level security;
alter table test_attempts enable row level security;
alter table attempt_answers enable row level security;
drop policy if exists "Authenticated users can read published tests" on quiz_tests;
create policy "Authenticated users can read published tests" on quiz_tests for select using (is_published = true and auth.role() = 'authenticated');
drop policy if exists "Authenticated users can read questions" on questions;
create policy "Authenticated users can read questions" on questions for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can read options" on question_options;
create policy "Authenticated users can read options" on question_options for select using (auth.role() = 'authenticated');
drop policy if exists "Users manage own attempts" on test_attempts;
create policy "Users manage own attempts" on test_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own answers" on attempt_answers;
create policy "Users manage own answers" on attempt_answers
  for all using (
    exists (select 1 from test_attempts ta where ta.id = attempt_id and ta.user_id = auth.uid())
  );

-- ============================================================================
-- USER TEST LOGS & SCHEDULES
-- ============================================================================
create table if not exists tests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null default 'chapter',
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
  status text not null default 'upcoming',
  created_at timestamptz not null default now()
);

alter table tests enable row level security;
alter table test_schedules enable row level security;
alter table test_logs enable row level security;
alter table test_schedule enable row level security;
drop policy if exists "Users manage own tests" on tests;
create policy "Users manage own tests" on tests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own test schedules" on test_schedules;
create policy "Users manage own test schedules" on test_schedules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own test logs" on test_logs;
create policy "Users manage own test logs" on test_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own test schedule" on test_schedule;
create policy "Users manage own test schedule" on test_schedule for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- DAILY LOGS & TASKS
-- ============================================================================
create table if not exists daily_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(uid) on delete cascade,
  log_date date not null default current_date,
  study_time_minutes int not null default 0,
  theory_minutes int not null default 0,
  practice_minutes int not null default 0,
  revision_minutes int not null default 0,
  verified_minutes int not null default 0,
  target_minutes int not null default 240,
  streak_count int not null default 0,
  unique (user_id, log_date)
);
create index if not exists idx_daily_logs_user_date on daily_logs(user_id, log_date);

create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(uid) on delete cascade,
  chapter_id uuid references chapters(id),
  title text not null,
  task_type task_type_enum not null default 'todo',
  status task_status_enum not null default 'pending',
  priority text not null default 'medium',
  due_date date not null default current_date,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_tasks_user_due on tasks(user_id, due_date);
create index if not exists idx_tasks_status on tasks(status);

alter table daily_logs enable row level security;
alter table tasks enable row level security;
drop policy if exists "Users manage own daily logs" on daily_logs;
create policy "Users manage own daily logs" on daily_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own tasks" on tasks;
create policy "Users manage own tasks" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Authenticated users can read daily logs" on daily_logs;
create policy "Authenticated users can read daily logs" on daily_logs for select using (auth.role() = 'authenticated');

-- ============================================================================
-- FOCUS & QUESTION LOGS
-- ============================================================================
create table if not exists focus_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds int not null default 0,
  counts_for_streak boolean not null default true,
  subject text,
  task_type text,
  created_at timestamptz not null default now()
);
create index if not exists idx_focus_sessions_user on focus_sessions(user_id, started_at);

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
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
create index if not exists idx_question_logs_user on question_logs(user_id, log_date);

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

alter table focus_sessions enable row level security;
alter table question_logs enable row level security;
alter table question_practice_logs enable row level security;
drop policy if exists "Users manage own focus sessions" on focus_sessions;
create policy "Users manage own focus sessions" on focus_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own question logs" on question_logs;
create policy "Users manage own question logs" on question_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own practice logs" on question_practice_logs;
create policy "Users manage own practice logs" on question_practice_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- CHAPTER PROGRESS
-- ============================================================================
create table if not exists chapter_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  status text not null default 'not_started',
  is_backlog boolean not null default false,
  revision_count int not null default 0,
  total_questions_solved int not null default 0,
  accuracy int,
  updated_at timestamptz not null default now(),
  unique (user_id, chapter_id)
);
alter table chapter_progress enable row level security;
drop policy if exists "Users manage own chapter progress" on chapter_progress;
create policy "Users manage own chapter progress" on chapter_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- STUDY GROUPS
-- ============================================================================
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
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists group_join_requests (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

alter table study_groups enable row level security;
alter table group_members enable row level security;
alter table group_join_requests enable row level security;
drop policy if exists "Anyone can browse study groups" on study_groups;
create policy "Anyone can browse study groups" on study_groups for select using (auth.role() = 'authenticated');
drop policy if exists "Users create own groups" on study_groups;
create policy "Users create own groups" on study_groups for insert with check (auth.uid() = created_by);
drop policy if exists "Group creator can update own group" on study_groups;
create policy "Group creator can update own group" on study_groups for update using (auth.uid() = created_by);
drop policy if exists "Anyone can read group members" on group_members;
create policy "Anyone can read group members" on group_members for select using (auth.role() = 'authenticated');
drop policy if exists "Users join groups as themselves" on group_members;
create policy "Users join groups as themselves" on group_members for insert with check (auth.uid() = user_id);
drop policy if exists "Users read own join requests" on group_join_requests;
create policy "Users read own join requests" on group_join_requests for select using (auth.uid() = user_id);
drop policy if exists "Users create own join requests" on group_join_requests;
create policy "Users create own join requests" on group_join_requests for insert with check (auth.uid() = user_id);
drop policy if exists "Users update own join requests" on group_join_requests;
create policy "Users update own join requests" on group_join_requests for update using (auth.uid() = user_id);

-- ============================================================================
-- DASHBOARD CONTENT
-- ============================================================================
create table if not exists daily_content (
  id uuid primary key default uuid_generate_v4(),
  content_type text not null default 'motivation',
  quote text not null,
  quote_source text not null default 'human',
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
drop policy if exists "Authenticated users can read active content" on daily_content;
create policy "Authenticated users can read active content" on daily_content for select using (auth.role() = 'authenticated');

-- ============================================================================
-- EXAM SCHEDULE
-- ============================================================================
create table if not exists exam_schedule (
  id uuid primary key default uuid_generate_v4(),
  year int not null,
  display_order int not null default 0,
  label text not null,
  exam_date date not null,
  is_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists exam_shifts (
  id uuid primary key default uuid_generate_v4(),
  exam_schedule_id uuid not null references exam_schedule(id) on delete cascade,
  shift_date date,
  shift_time text,
  created_at timestamptz not null default now()
);

alter table exam_schedule enable row level security;
alter table exam_shifts enable row level security;
drop policy if exists "Authenticated users can read exam schedule" on exam_schedule;
create policy "Authenticated users can read exam schedule" on exam_schedule for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can read exam shifts" on exam_shifts;
create policy "Authenticated users can read exam shifts" on exam_shifts for select using (auth.role() = 'authenticated');

-- ============================================================================
-- FCM TOKENS
-- ============================================================================
create table if not exists user_fcm_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table user_fcm_tokens enable row level security;
drop policy if exists "Users manage own FCM tokens" on user_fcm_tokens;
create policy "Users manage own FCM tokens" on user_fcm_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- ADMIN / ADS
-- ============================================================================
create table if not exists app_settings (
  id int primary key default 1,
  ads_enabled boolean not null default true,
  max_ads_per_day_per_user int not null default 5,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

create table if not exists ad_impressions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(uid) on delete cascade,
  shown_at timestamptz not null default now(),
  ad_unit text
);
create index if not exists idx_ad_impressions_user_date on ad_impressions(user_id, shown_at);
alter table app_settings enable row level security;
alter table ad_impressions enable row level security;

-- ============================================================================
-- SEED: BATCHES (idempotent — name is not unique, so guard with NOT EXISTS)
-- ============================================================================
insert into batches (name, mode, city)
select v.name, v.mode::study_mode_enum, null
from (values
  ('Physics Wallah (PW) — Arjuna','Online'),
  ('Physics Wallah (PW) — Lakshya','Online'),
  ('Physics Wallah (PW) — Yakeen','Online'),
  ('Physics Wallah (PW) — Uday','Online'),
  ('Physics Wallah (PW) — Udaan','Online'),
  ('Aakash — iACST / ANTHE track','Online'),
  ('Aakash — Aakash iTutor','Online'),
  ('Vedantu — JEE/NEET Pro','Online'),
  ('Vedantu — Master Course','Online'),
  ('Unacademy — NEET/JEE batch','Online'),
  ('Other / not listed','Online'),
  ('Allen Career Institute','Offline'),
  ('Aakash Institute','Offline'),
  ('FIITJEE','Offline'),
  ('Resonance','Offline'),
  ('Motion Education','Offline'),
  ('Narayana','Offline'),
  ('Sri Chaitanya','Offline'),
  ('Physics Wallah Vidyapeeth','Offline'),
  ('Local / Independent Coaching','Offline')
) as v(name, mode)
where not exists (select 1 from batches b where b.name = v.name);

-- ============================================================================
-- SEED: SYLLABUS (Class 11 + 12, JEE + NEET) — fully idempotent
-- ============================================================================
do $$
declare s uuid;
begin
  -- ================= CLASS 11 =================
  insert into subjects (name, target_exam, class_level, display_order)
    select 'Physics', 'JEE', '11', 1
    where not exists (select 1 from subjects where name='Physics' and target_exam='JEE' and class_level='11')
  returning id into s;
  if s is null then
    select id into s from subjects where name='Physics' and target_exam='JEE' and class_level='11';
  end if;
  insert into chapters (subject_id, title, is_tough_topic, display_order)
  select s, c.title, c.tough, c.ord from (values
    ('Kinematics',false,1),('Laws of Motion',false,2),('Work, Energy & Power',true,3),
    ('Rotational Motion',true,4),('Thermodynamics',false,5),('Electrostatics',true,6)
  ) as c(title,tough,ord)
  where not exists (select 1 from chapters where subject_id = s and title = c.title);

  insert into subjects (name, target_exam, class_level, display_order)
    select 'Chemistry', 'JEE', '11', 2
    where not exists (select 1 from subjects where name='Chemistry' and target_exam='JEE' and class_level='11')
  returning id into s;
  if s is null then
    select id into s from subjects where name='Chemistry' and target_exam='JEE' and class_level='11';
  end if;
  insert into chapters (subject_id, title, is_tough_topic, display_order)
  select s, c.title, c.tough, c.ord from (values
    ('Mole Concept',false,1),('Atomic Structure',false,2),('Chemical Bonding',true,3),
    ('Thermodynamics',false,4),('Equilibrium',true,5),('Organic Basics (GOC)',true,6)
  ) as c(title,tough,ord)
  where not exists (select 1 from chapters where subject_id = s and title = c.title);

  insert into subjects (name, target_exam, class_level, display_order)
    select 'Maths', 'JEE', '11', 3
    where not exists (select 1 from subjects where name='Maths' and target_exam='JEE' and class_level='11')
  returning id into s;
  if s is null then
    select id into s from subjects where name='Maths' and target_exam='JEE' and class_level='11';
  end if;
  insert into chapters (subject_id, title, is_tough_topic, display_order)
  select s, c.title, c.tough, c.ord from (values
    ('Sets & Functions',false,1),('Quadratic Equations',false,2),('Trigonometry',true,3),
    ('Sequences & Series',false,4),('Straight Lines',false,5),('Calculus Basics',true,6)
  ) as c(title,tough,ord)
  where not exists (select 1 from chapters where subject_id = s and title = c.title);

  insert into subjects (name, target_exam, class_level, display_order)
    select 'Physics', 'NEET', '11', 1
    where not exists (select 1 from subjects where name='Physics' and target_exam='NEET' and class_level='11')
  returning id into s;
  if s is null then
    select id into s from subjects where name='Physics' and target_exam='NEET' and class_level='11';
  end if;
  insert into chapters (subject_id, title, is_tough_topic, display_order)
  select s, c.title, c.tough, c.ord from (values
    ('Kinematics',false,1),('Laws of Motion',false,2),('Work, Energy & Power',true,3),
    ('Thermodynamics',false,4),('Electrostatics',true,5)
  ) as c(title,tough,ord)
  where not exists (select 1 from chapters where subject_id = s and title = c.title);

  insert into subjects (name, target_exam, class_level, display_order)
    select 'Chemistry', 'NEET', '11', 2
    where not exists (select 1 from subjects where name='Chemistry' and target_exam='NEET' and class_level='11')
  returning id into s;
  if s is null then
    select id into s from subjects where name='Chemistry' and target_exam='NEET' and class_level='11';
  end if;
  insert into chapters (subject_id, title, is_tough_topic, display_order)
  select s, c.title, c.tough, c.ord from (values
    ('Mole Concept',false,1),('Atomic Structure',false,2),('Chemical Bonding',true,3),
    ('Equilibrium',true,4),('Organic Basics (GOC)',true,5)
  ) as c(title,tough,ord)
  where not exists (select 1 from chapters where subject_id = s and title = c.title);

  insert into subjects (name, target_exam, class_level, display_order)
    select 'Biology', 'NEET', '11', 3
    where not exists (select 1 from subjects where name='Biology' and target_exam='NEET' and class_level='11')
  returning id into s;
  if s is null then
    select id into s from subjects where name='Biology' and target_exam='NEET' and class_level='11';
  end if;
  insert into chapters (subject_id, title, is_tough_topic, display_order)
  select s, c.title, c.tough, c.ord from (values
    ('Cell Structure',false,1),('Genetics',true,2),('Human Physiology',true,3),
    ('Plant Physiology',false,4),('Ecology',false,5),('Biotechnology',true,6)
  ) as c(title,tough,ord)
  where not exists (select 1 from chapters where subject_id = s and title = c.title);

  -- ================= CLASS 12 =================
  insert into subjects (name, target_exam, class_level, display_order)
    select 'Physics', 'JEE', '12', 1
    where not exists (select 1 from subjects where name='Physics' and target_exam='JEE' and class_level='12')
  returning id into s;
  if s is null then
    select id into s from subjects where name='Physics' and target_exam='JEE' and class_level='12';
  end if;
  insert into chapters (subject_id, title, is_tough_topic, display_order)
  select s, c.title, c.tough, c.ord from (values
    ('Current Electricity',false,1),('Magnetism',true,2),('EMI & AC',true,3),
    ('Ray Optics',false,4),('Modern Physics',true,5),('Semiconductors',false,6)
  ) as c(title,tough,ord)
  where not exists (select 1 from chapters where subject_id = s and title = c.title);

  insert into subjects (name, target_exam, class_level, display_order)
    select 'Chemistry', 'JEE', '12', 2
    where not exists (select 1 from subjects where name='Chemistry' and target_exam='JEE' and class_level='12')
  returning id into s;
  if s is null then
    select id into s from subjects where name='Chemistry' and target_exam='JEE' and class_level='12';
  end if;
  insert into chapters (subject_id, title, is_tough_topic, display_order)
  select s, c.title, c.tough, c.ord from (values
    ('Solutions',false,1),('Electrochemistry',true,2),('Chemical Kinetics',true,3),
    ('d & f Block',false,4),('Coordination Compounds',true,5),('Aldehydes & Ketones',true,6)
  ) as c(title,tough,ord)
  where not exists (select 1 from chapters where subject_id = s and title = c.title);

  insert into subjects (name, target_exam, class_level, display_order)
    select 'Maths', 'JEE', '12', 3
    where not exists (select 1 from subjects where name='Maths' and target_exam='JEE' and class_level='12')
  returning id into s;
  if s is null then
    select id into s from subjects where name='Maths' and target_exam='JEE' and class_level='12';
  end if;
  insert into chapters (subject_id, title, is_tough_topic, display_order)
  select s, c.title, c.tough, c.ord from (values
    ('Relations & Functions',false,1),('Inverse Trigonometry',false,2),('Matrices & Determinants',true,3),
    ('Continuity & Differentiability',true,4),('Integrals',true,5),('Probability',false,6)
  ) as c(title,tough,ord)
  where not exists (select 1 from chapters where subject_id = s and title = c.title);

  insert into subjects (name, target_exam, class_level, display_order)
    select 'Physics', 'NEET', '12', 1
    where not exists (select 1 from subjects where name='Physics' and target_exam='NEET' and class_level='12')
  returning id into s;
  if s is null then
    select id into s from subjects where name='Physics' and target_exam='NEET' and class_level='12';
  end if;
  insert into chapters (subject_id, title, is_tough_topic, display_order)
  select s, c.title, c.tough, c.ord from (values
    ('Current Electricity',false,1),('Magnetism',true,2),('EMI & AC',true,3),
    ('Ray Optics',false,4),('Modern Physics',true,5)
  ) as c(title,tough,ord)
  where not exists (select 1 from chapters where subject_id = s and title = c.title);

  insert into subjects (name, target_exam, class_level, display_order)
    select 'Chemistry', 'NEET', '12', 2
    where not exists (select 1 from subjects where name='Chemistry' and target_exam='NEET' and class_level='12')
  returning id into s;
  if s is null then
    select id into s from subjects where name='Chemistry' and target_exam='NEET' and class_level='12';
  end if;
  insert into chapters (subject_id, title, is_tough_topic, display_order)
  select s, c.title, c.tough, c.ord from (values
    ('Solutions',false,1),('Electrochemistry',true,2),('Chemical Kinetics',true,3),
    ('Coordination Compounds',true,4),('Biomolecules',false,5)
  ) as c(title,tough,ord)
  where not exists (select 1 from chapters where subject_id = s and title = c.title);

  insert into subjects (name, target_exam, class_level, display_order)
    select 'Biology', 'NEET', '12', 3
    where not exists (select 1 from subjects where name='Biology' and target_exam='NEET' and class_level='12')
  returning id into s;
  if s is null then
    select id into s from subjects where name='Biology' and target_exam='NEET' and class_level='12';
  end if;
  insert into chapters (subject_id, title, is_tough_topic, display_order)
  select s, c.title, c.tough, c.ord from (values
    ('Reproduction',true,1),('Genetics & Evolution',true,2),('Human Health & Disease',false,3),
    ('Biotechnology',true,4),('Ecology',false,5)
  ) as c(title,tough,ord)
  where not exists (select 1 from chapters where subject_id = s and title = c.title);
end $$;

-- ============================================================================
-- DONE — setup complete. Manual steps:
--   1. Auth > Providers > Google: paste OAuth client id/secret
--   2. Google Cloud Console: redirect URI = https://<project-ref>.supabase.co/auth/v1/callback
--   3. Cloudflare Pages: update NEXT_PUBLIC_SUPABASE_URL + ANON_KEY, redeploy
-- ============================================================================
