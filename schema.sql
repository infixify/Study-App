-- ============================================================================
-- PREPWISE — COMPLETE SUPABASE SETUP (single file, fresh project)
-- Run this ONE file in Supabase SQL Editor. Nothing else needed.
-- Fixes vs old schema:
--  * Quiz-bank table renamed tests -> quiz_tests (app/tests page owns "tests")
--  * Profile lock trigger REMOVED (settings page edits class/exam/boards)
--  * users: streak/goal/shift columns; daily_logs: study-mode minutes
--  * chapters: JEE/NEET scope flags; tasks: priority
--  * + groups, focus, question logs, practice logs, chapter progress,
--    user test logs/schedules, daily content, exam schedule, FCM tokens
-- ============================================================================

create extension if not exists "uuid-ossp";

create type class_level_enum as enum ('11', '12', '11_12', 'Dropper');
create type target_exam_enum as enum ('JEE', 'NEET', 'Boards');
create type study_mode_enum as enum ('Online', 'Offline', 'Self');
create type resource_type_enum as enum ('pdf', 'micro_video');
create type task_status_enum as enum ('pending', 'completed', 'backlog');
create type task_type_enum as enum ('todo', 'backlog');
create type question_difficulty_enum as enum ('easy', 'medium', 'hard');

-- ============================ USERS ============================
create table batches (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  mode study_mode_enum not null,
  city text,
  created_at timestamptz not null default now()
);

create table users (
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
create index idx_users_target_exam on users(target_exam);
create index idx_users_class_level on users(class_level);

alter table users enable row level security;
create policy "Users can view own profile" on users for select using (auth.uid() = uid);
create policy "Users can update own profile" on users for update using (auth.uid() = uid);
create policy "Users can insert own profile" on users for insert with check (auth.uid() = uid);
create policy "Authenticated users can read profiles" on users for select using (auth.role() = 'authenticated');

create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
create trigger trg_users_updated_at before update on users
for each row execute function set_updated_at();

-- ============================ CONTENT ============================
create table subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  target_exam target_exam_enum not null,
  class_level class_level_enum not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table chapters (
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
create index idx_chapters_subject on chapters(subject_id);

create table resources (
  id uuid primary key default uuid_generate_v4(),
  chapter_id uuid not null references chapters(id) on delete cascade,
  resource_type resource_type_enum not null,
  title text not null,
  url text not null,
  duration_seconds int,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_resources_chapter on resources(chapter_id);

alter table subjects enable row level security;
alter table chapters enable row level security;
alter table resources enable row level security;
create policy "Authenticated users can read subjects" on subjects for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read chapters" on chapters for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read resources" on resources for select using (auth.role() = 'authenticated');

-- ==================== QUIZ BANK (admin mock tests) ====================
create table quiz_tests (
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

create table questions (
  id uuid primary key default uuid_generate_v4(),
  test_id uuid not null references quiz_tests(id) on delete cascade,
  question_text text not null,
  image_url text,
  difficulty question_difficulty_enum not null default 'medium',
  correct_option_id uuid,
  explanation text,
  display_order int not null default 0
);

create table question_options (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references questions(id) on delete cascade,
  option_text text not null,
  display_order int not null default 0
);

alter table questions add constraint fk_correct_option
  foreign key (correct_option_id) references question_options(id);
create index idx_questions_test on questions(test_id);
create index idx_options_question on question_options(question_id);

create table test_attempts (
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
create index idx_attempts_user on test_attempts(user_id);
create index idx_attempts_test on test_attempts(test_id);

create table attempt_answers (
  id uuid primary key default uuid_generate_v4(),
  attempt_id uuid not null references test_attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  selected_option_id uuid references question_options(id),
  is_correct boolean,
  time_taken_seconds int
);
create index idx_answers_attempt on attempt_answers(attempt_id);

alter table quiz_tests enable row level security;
alter table questions enable row level security;
alter table question_options enable row level security;
alter table test_attempts enable row level security;
alter table attempt_answers enable row level security;
create policy "Authenticated users can read published tests" on quiz_tests
  for select using (is_published = true and auth.role() = 'authenticated');
create policy "Authenticated users can read questions" on questions
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read options" on question_options
  for select using (auth.role() = 'authenticated');
create policy "Users manage own attempts" on test_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own answers" on attempt_answers
  for all using (
    exists (select 1 from test_attempts ta where ta.id = attempt_id and ta.user_id = auth.uid())
  );

-- ================= USER TEST LOGS & SCHEDULES =================
create table tests (
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
create index idx_tests_user on tests(user_id, test_date);

create table test_schedules (
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

create table test_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_name text not null,
  total_marks numeric,
  max_marks numeric,
  accuracy numeric,
  test_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table test_schedule (
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
create policy "Users manage own tests" on tests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own test schedules" on test_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own test logs" on test_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own test schedule" on test_schedule
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ================= DAILY LOGS & TASKS =================
create table daily_logs (
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
create index idx_daily_logs_user_date on daily_logs(user_id, log_date);

create table tasks (
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
create index idx_tasks_user_due on tasks(user_id, due_date);
create index idx_tasks_status on tasks(status);

alter table daily_logs enable row level security;
alter table tasks enable row level security;
create policy "Users manage own daily logs" on daily_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own tasks" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Authenticated users can read daily logs" on daily_logs
  for select using (auth.role() = 'authenticated');

-- ================= FOCUS & QUESTION LOGS =================
create table focus_sessions (
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
create index idx_focus_sessions_user on focus_sessions(user_id, started_at);

create table question_logs (
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
create index idx_question_logs_user on question_logs(user_id, log_date);

create table question_practice_logs (
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
create policy "Users manage own focus sessions" on focus_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own question logs" on question_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own practice logs" on question_practice_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ================= CHAPTER PROGRESS =================
create table chapter_progress (
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
create policy "Users manage own chapter progress" on chapter_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ================= STUDY GROUPS =================
create table study_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  target_exam text not null default 'JEE',
  member_count int not null default 1,
  is_private boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table group_members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table group_join_requests (
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
create policy "Anyone can browse study groups" on study_groups
  for select using (auth.role() = 'authenticated');
create policy "Users create own groups" on study_groups
  for insert with check (auth.uid() = created_by);
create policy "Group creator can update own group" on study_groups
  for update using (auth.uid() = created_by);
create policy "Anyone can read group members" on group_members
  for select using (auth.role() = 'authenticated');
create policy "Users join groups as themselves" on group_members
  for insert with check (auth.uid() = user_id);
create policy "Users read own join requests" on group_join_requests
  for select using (auth.uid() = user_id);
create policy "Users create own join requests" on group_join_requests
  for insert with check (auth.uid() = user_id);
create policy "Users update own join requests" on group_join_requests
  for update using (auth.uid() = user_id);

-- ================= DASHBOARD CONTENT =================
create table daily_content (
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
create policy "Authenticated users can read active content" on daily_content
  for select using (auth.role() = 'authenticated');

-- ================= EXAM SCHEDULE =================
create table exam_schedule (
  id uuid primary key default uuid_generate_v4(),
  year int not null,
  display_order int not null default 0,
  label text not null,
  exam_date date not null,
  is_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create table exam_shifts (
  id uuid primary key default uuid_generate_v4(),
  exam_schedule_id uuid not null references exam_schedule(id) on delete cascade,
  shift_date date,
  shift_time text,
  created_at timestamptz not null default now()
);

alter table exam_schedule enable row level security;
alter table exam_shifts enable row level security;
create policy "Authenticated users can read exam schedule" on exam_schedule
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read exam shifts" on exam_shifts
  for select using (auth.role() = 'authenticated');

-- ================= FCM TOKENS =================
create table user_fcm_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table user_fcm_tokens enable row level security;
create policy "Users manage own FCM tokens" on user_fcm_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ================= ADMIN / ADS =================
create table app_settings (
  id int primary key default 1,
  ads_enabled boolean not null default true,
  max_ads_per_day_per_user int not null default 5,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into app_settings (id) values (1);

create table ad_impressions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(uid) on delete cascade,
  shown_at timestamptz not null default now(),
  ad_unit text
);
create index idx_ad_impressions_user_date on ad_impressions(user_id, shown_at);
alter table app_settings enable row level security;
alter table ad_impressions enable row level security;

-- ================= SEED: BATCHES =================
insert into batches (name, mode, city) values
  ('Physics Wallah (PW) — Arjuna', 'Online', null),
  ('Physics Wallah (PW) — Lakshya', 'Online', null),
  ('Physics Wallah (PW) — Yakeen', 'Online', null),
  ('Physics Wallah (PW) — Uday', 'Online', null),
  ('Physics Wallah (PW) — Udaan', 'Online', null),
  ('Aakash — iACST / ANTHE track', 'Online', null),
  ('Aakash — Aakash iTutor', 'Online', null),
  ('Vedantu — JEE/NEET Pro', 'Online', null),
  ('Vedantu — Master Course', 'Online', null),
  ('Unacademy — NEET/JEE batch', 'Online', null),
  ('Other / not listed', 'Online', null),
  ('Allen Career Institute', 'Offline', null),
  ('Aakash Institute', 'Offline', null),
  ('FIITJEE', 'Offline', null),
  ('Resonance', 'Offline', null),
  ('Motion Education', 'Offline', null),
  ('Narayana', 'Offline', null),
  ('Sri Chaitanya', 'Offline', null),
  ('Physics Wallah Vidyapeeth', 'Offline', null),
  ('Local / Independent Coaching', 'Offline', null)
on conflict do nothing;

-- ============ SEED: SYLLABUS (Class 11 + 12, JEE + NEET) ============
do $$
declare s uuid;
begin
  -- CLASS 11
  insert into subjects (name, target_exam, class_level, display_order) values ('Physics','JEE','11',1) returning id into s;
  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (s,'Kinematics',false,1),(s,'Laws of Motion',false,2),(s,'Work, Energy & Power',true,3),
    (s,'Rotational Motion',true,4),(s,'Thermodynamics',false,5),(s,'Electrostatics',true,6);
  insert into subjects (name, target_exam, class_level, display_order) values ('Chemistry','JEE','11',2) returning id into s;
  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (s,'Mole Concept',false,1),(s,'Atomic Structure',false,2),(s,'Chemical Bonding',true,3),
    (s,'Thermodynamics',false,4),(s,'Equilibrium',true,5),(s,'Organic Basics (GOC)',true,6);
  insert into subjects (name, target_exam, class_level, display_order) values ('Maths','JEE','11',3) returning id into s;
  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (s,'Sets & Functions',false,1),(s,'Quadratic Equations',false,2),(s,'Trigonometry',true,3),
    (s,'Sequences & Series',false,4),(s,'Straight Lines',false,5),(s,'Calculus Basics',true,6);
  insert into subjects (name, target_exam, class_level, display_order) values ('Physics','NEET','11',1) returning id into s;
  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (s,'Kinematics',false,1),(s,'Laws of Motion',false,2),(s,'Work, Energy & Power',true,3),
    (s,'Thermodynamics',false,4),(s,'Electrostatics',true,5);
  insert into subjects (name, target_exam, class_level, display_order) values ('Chemistry','NEET','11',2) returning id into s;
  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (s,'Mole Concept',false,1),(s,'Atomic Structure',false,2),(s,'Chemical Bonding',true,3),
    (s,'Equilibrium',true,4),(s,'Organic Basics (GOC)',true,5);
  insert into subjects (name, target_exam, class_level, display_order) values ('Biology','NEET','11',3) returning id into s;
  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (s,'Cell Structure',false,1),(s,'Genetics',true,2),(s,'Human Physiology',true,3),
    (s,'Plant Physiology',false,4),(s,'Ecology',false,5),(s,'Biotechnology',true,6);

  -- CLASS 12
  insert into subjects (name, target_exam, class_level, display_order) values ('Physics','JEE','12',1) returning id into s;
  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (s,'Current Electricity',false,1),(s,'Magnetism',true,2),(s,'EMI & AC',true,3),
    (s,'Ray Optics',false,4),(s,'Modern Physics',true,5),(s,'Semiconductors',false,6);
  insert into subjects (name, target_exam, class_level, display_order) values ('Chemistry','JEE','12',2) returning id into s;
  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (s,'Solutions',false,1),(s,'Electrochemistry',true,2),(s,'Chemical Kinetics',true,3),
    (s,'d & f Block',false,4),(s,'Coordination Compounds',true,5),(s,'Aldehydes & Ketones',true,6);
  insert into subjects (name, target_exam, class_level, display_order) values ('Maths','JEE','12',3) returning id into s;
  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (s,'Relations & Functions',false,1),(s,'Inverse Trigonometry',false,2),(s,'Matrices & Determinants',true,3),
    (s,'Continuity & Differentiability',true,4),(s,'Integrals',true,5),(s,'Probability',false,6);
  insert into subjects (name, target_exam, class_level, display_order) values ('Physics','NEET','12',1) returning id into s;
  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (s,'Current Electricity',false,1),(s,'Magnetism',true,2),(s,'EMI & AC',true,3),
    (s,'Ray Optics',false,4),(s,'Modern Physics',true,5);
  insert into subjects (name, target_exam, class_level, display_order) values ('Chemistry','NEET','12',2) returning id into s;
  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (s,'Solutions',false,1),(s,'Electrochemistry',true,2),(s,'Chemical Kinetics',true,3),
    (s,'Coordination Compounds',true,4),(s,'Biomolecules',false,5);
  insert into subjects (name, target_exam, class_level, display_order) values ('Biology','NEET','12',3) returning id into s;
  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (s,'Reproduction',true,1),(s,'Genetics & Evolution',true,2),(s,'Human Health & Disease',false,3),
    (s,'Biotechnology',true,4),(s,'Ecology',false,5);
end $$;

-- ============================================================================
-- DONE. Remaining manual steps:
--   1. Auth > Providers > Google: paste OAuth client id/secret
--   2. Google Cloud Console: redirect URI = https://<project-ref>.supabase.co/auth/v1/callback
--   3. Cloudflare Pages: update NEXT_PUBLIC_SUPABASE_URL + ANON_KEY, redeploy
-- ============================================================================
