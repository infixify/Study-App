-- ============================================================================
-- HYBRID STUDY APP — SUPABASE SCHEMA
-- Modules covered: Users, Content, Tests, User Tracking, Admin/Ads
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
create type class_level_enum as enum ('10', '11', '12', 'Dropper');
create type target_exam_enum as enum ('JEE', 'NEET', 'Boards');
create type study_mode_enum as enum ('Online', 'Offline', 'Self');
create type resource_type_enum as enum ('pdf', 'micro_video');
create type task_status_enum as enum ('pending', 'completed', 'backlog');
create type task_type_enum as enum ('todo', 'backlog');
create type question_difficulty_enum as enum ('easy', 'medium', 'hard');

-- ============================================================================
-- MODULE 1a: USERS
-- ============================================================================

-- Batches / branches (for Online -> PW/Allen dropdown, Offline -> city/branch)
create table batches (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                       -- e.g. 'Physics Wallah', 'Allen Kota Branch'
  mode study_mode_enum not null,            -- 'Online' or 'Offline'
  city text,                                -- relevant for Offline
  created_at timestamptz not null default now()
);

-- Main user profile table (extends Supabase auth.users)
create table users (
  uid uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  class_level class_level_enum not null,
  target_exam target_exam_enum not null,
  wants_boards boolean not null default false,   -- optional 'Boards' checkbox for 10th/12th
  study_mode study_mode_enum not null,
  batch_or_branch_id uuid references batches(id),
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_users_target_exam on users(target_exam);
create index idx_users_class_level on users(class_level);

alter table users enable row level security;
create policy "Users can view own profile" on users
  for select using (auth.uid() = uid);
create policy "Users can update own profile" on users
  for update using (auth.uid() = uid);
create policy "Users can insert own profile" on users
  for insert with check (auth.uid() = uid);

-- ============================================================================
-- MODULE 1b: CONTENT (Subjects -> Chapters -> Resources)
-- ============================================================================

create table subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                        -- 'Physics', 'Chemistry', 'Maths', 'Biology'
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
  is_tough_topic boolean not null default false,  -- flags chapters needing micro-video CTA
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_chapters_subject on chapters(subject_id);

-- Unified resource table: PDF notes + micro-video links
create table resources (
  id uuid primary key default uuid_generate_v4(),
  chapter_id uuid not null references chapters(id) on delete cascade,
  resource_type resource_type_enum not null,
  title text not null,
  url text not null,                          -- PDF file URL or video URL
  duration_seconds int,                        -- relevant for micro_video
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_resources_chapter on resources(chapter_id);

alter table subjects enable row level security;
alter table chapters enable row level security;
alter table resources enable row level security;
create policy "Authenticated users can read subjects" on subjects
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read chapters" on chapters
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read resources" on resources
  for select using (auth.role() = 'authenticated');
-- Admin writes to these tables via service role key (bypasses RLS), no insert/update policy needed here.

-- ============================================================================
-- MODULE 1c: TESTS (Mock tests, questions, attempts, scores)
-- ============================================================================

create table tests (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  subject_id uuid references subjects(id),
  target_exam target_exam_enum not null,
  duration_minutes int not null default 60,
  marks_per_correct numeric not null default 4,
  negative_marks_per_wrong numeric not null default 1,   -- stored positive, subtracted in scoring logic
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default uuid_generate_v4(),
  test_id uuid not null references tests(id) on delete cascade,
  question_text text not null,
  image_url text,
  difficulty question_difficulty_enum not null default 'medium',
  correct_option_id uuid,  -- FK added after question_options exists (see below)
  explanation text,
  display_order int not null default 0
);

create table question_options (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references questions(id) on delete cascade,
  option_text text not null,
  display_order int not null default 0
);

alter table questions
  add constraint fk_correct_option
  foreign key (correct_option_id) references question_options(id);

create index idx_questions_test on questions(test_id);
create index idx_options_question on question_options(question_id);

-- One row per user attempt of a test
create table test_attempts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(uid) on delete cascade,
  test_id uuid not null references tests(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  total_score numeric,
  accuracy numeric,              -- percentage: correct / attempted
  correct_count int default 0,
  wrong_count int default 0,
  skipped_count int default 0
);

create index idx_attempts_user on test_attempts(user_id);
create index idx_attempts_test on test_attempts(test_id);

-- Per-question answer within an attempt
create table attempt_answers (
  id uuid primary key default uuid_generate_v4(),
  attempt_id uuid not null references test_attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  selected_option_id uuid references question_options(id),
  is_correct boolean,
  time_taken_seconds int
);

create index idx_answers_attempt on attempt_answers(attempt_id);

alter table tests enable row level security;
alter table questions enable row level security;
alter table question_options enable row level security;
alter table test_attempts enable row level security;
alter table attempt_answers enable row level security;

create policy "Authenticated users can read published tests" on tests
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

-- ============================================================================
-- MODULE 1d: USER TRACKING (daily study time, streaks, to-do/backlog)
-- ============================================================================

-- One row per user per calendar day
create table daily_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(uid) on delete cascade,
  log_date date not null default current_date,
  study_time_minutes int not null default 0,
  target_minutes int not null default 240,     -- daily target, editable per user
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

-- ============================================================================
-- MODULE 6: ADMIN / ADS
-- ============================================================================

-- Global app settings (Ad Controller master switch, max ads/day, etc.)
create table app_settings (
  id int primary key default 1,
  ads_enabled boolean not null default true,
  max_ads_per_day_per_user int not null default 5,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into app_settings (id) values (1);

-- Per-user ad impression log (for enforcing max_ads_per_day_per_user)
create table ad_impressions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(uid) on delete cascade,
  shown_at timestamptz not null default now(),
  ad_unit text
);

create index idx_ad_impressions_user_date on ad_impressions(user_id, shown_at);

alter table app_settings enable row level security;
alter table ad_impressions enable row level security;
-- app_settings: no public policy -> only accessible via service role (admin panel backend).
-- ad_impressions: no public read policy -> writes go through an edge function using service role.

-- ============================================================================
-- HELPER: auto-update `updated_at` on users
-- ============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at
before update on users
for each row execute function set_updated_at();

-- ============================================================================
-- CHANGE SET v2 — additive migration, safe to run after the base schema above
-- 1) "11 + 12" combined class option
-- 2) Lock class_level / target_exam / wants_boards after onboarding
-- 3) Seed real batches (Online: institute + named batch; Offline: institute only)
-- 4) Seed baseline JEE/NEET syllabus (subjects + chapters) so library isn't empty
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) New class_level value: students prepping across both years.
-- Content queries should treat '11_12' as the UNION of '11' and '12' content
-- (see helper view below) rather than an exact match.
-- ----------------------------------------------------------------------------
alter type class_level_enum add value if not exists '11_12';

-- ----------------------------------------------------------------------------
-- 2) Lock class_level / target_exam / wants_boards once onboarding is done.
-- The existing "Users can update own profile" policy only checks auth.uid(),
-- it does not restrict which columns change — so we enforce it with a trigger.
-- ----------------------------------------------------------------------------
create or replace function lock_profile_fields_after_onboarding()
returns trigger as $$
begin
  if old.onboarding_completed = true then
    if new.class_level is distinct from old.class_level
       or new.target_exam is distinct from old.target_exam
       or new.wants_boards is distinct from old.wants_boards then
      raise exception 'class_level, target_exam and wants_boards cannot be changed after onboarding is complete';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_users_lock_after_onboarding
before update on users
for each row execute function lock_profile_fields_after_onboarding();

-- ----------------------------------------------------------------------------
-- 3) Seed batches. mode + city already exist on `batches`; we reuse `city`
-- to store the institute name for Offline rows where useful, and encode the
-- institute in `name` for Online rows ("Institute — Batch").
-- ----------------------------------------------------------------------------
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
  ('Other / not listed', 'Online', null)
on conflict do nothing;

-- Offline: institute name only, no batch-level detail (per product call).
insert into batches (name, mode, city) values
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

-- ----------------------------------------------------------------------------
-- 4) Baseline syllabus seed — subjects + chapter titles per exam/class, so
-- the library has real structure on day one. PDFs/videos still need to be
-- attached per chapter via the admin CMS (resources table) — not seeded here
-- to avoid linking to any non-verified/copyrighted source.
-- ----------------------------------------------------------------------------
do $$
declare
  jee_phys uuid; jee_chem uuid; jee_math uuid;
  neet_phys uuid; neet_chem uuid; neet_bio uuid;
begin
  -- JEE subjects (class 11)
  insert into subjects (name, target_exam, class_level, display_order) values ('Physics','JEE','11',1) returning id into jee_phys;
  insert into subjects (name, target_exam, class_level, display_order) values ('Chemistry','JEE','11',2) returning id into jee_chem;
  insert into subjects (name, target_exam, class_level, display_order) values ('Maths','JEE','11',3) returning id into jee_math;

  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (jee_phys,'Kinematics',false,1),
    (jee_phys,'Laws of Motion',false,2),
    (jee_phys,'Work, Energy & Power',true,3),
    (jee_phys,'Rotational Motion',true,4),
    (jee_phys,'Thermodynamics',false,5),
    (jee_phys,'Electrostatics',true,6);

  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (jee_chem,'Mole Concept',false,1),
    (jee_chem,'Atomic Structure',false,2),
    (jee_chem,'Chemical Bonding',true,3),
    (jee_chem,'Thermodynamics',false,4),
    (jee_chem,'Equilibrium',true,5),
    (jee_chem,'Organic Basics (GOC)',true,6);

  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (jee_math,'Sets & Functions',false,1),
    (jee_math,'Quadratic Equations',false,2),
    (jee_math,'Trigonometry',true,3),
    (jee_math,'Sequences & Series',false,4),
    (jee_math,'Straight Lines',false,5),
    (jee_math,'Calculus Basics',true,6);

  -- NEET subjects (class 11)
  insert into subjects (name, target_exam, class_level, display_order) values ('Physics','NEET','11',1) returning id into neet_phys;
  insert into subjects (name, target_exam, class_level, display_order) values ('Chemistry','NEET','11',2) returning id into neet_chem;
  insert into subjects (name, target_exam, class_level, display_order) values ('Biology','NEET','11',3) returning id into neet_bio;

  insert into chapters (subject_id, title, is_tough_topic, display_order) values
    (neet_bio,'Cell Structure',false,1),
    (neet_bio,'Genetics',true,2),
    (neet_bio,'Human Physiology',true,3),
    (neet_bio,'Plant Physiology',false,4),
    (neet_bio,'Ecology',false,5),
    (neet_bio,'Biotechnology',true,6);
end $$;

-- NOTE: the same chapter titles should be duplicated under class_level = '12'
-- (Class 12 syllabus differs from 11 in real JEE/NEET) before this ships —
-- kept to class 11 here to review the pattern first without doubling content.
