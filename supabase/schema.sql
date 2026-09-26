-- MyDiiwaan School Portal — Supabase Schema
-- Run this in the Supabase SQL editor to set up the database.
--
-- Safe to re-run in full against an existing database to catch it up on
-- anything added since it was first set up: every statement is guarded
-- (if not exists / or replace / drop-then-create), including every policy
-- below, none of which Postgres lets you write as "create policy if not
-- exists" — without the matching drop first, a second run would fail on
-- the first one it hit instead of quietly reconciling the rest.

-- Enable RLS globally
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- ══════════════════════════════════════
-- Schools
-- ══════════════════════════════════════
create table if not exists schools (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  -- Shown in the portal chrome under the school's name, the way "ديواني"
  -- sits under the platform wordmark. Optional: the sidebar just omits the
  -- line when a school hasn't given one.
  name_arabic  text,
  slug         text unique not null,
  address      text,
  city         text not null default 'Edmonton',
  province     text not null default 'AB',
  phone        text,
  email        text,
  logo_url     text,
  timezone     text not null default 'America/Edmonton',
  school_year  text not null default '2026-2027',
  max_students int not null default 200,
  plan         text not null default 'starter' check (plan in ('starter', 'growth', 'premium')),
  active       boolean not null default true,
  created_at   timestamptz default now()
);
alter table schools enable row level security;

-- Migration for schools created before the portal could be white-labelled.
alter table schools add column if not exists name_arabic text;

-- Which country the school is in, as an ISO 3166 code ('CA', 'SO', 'GB'…):
-- schools can sign up from anywhere. Every school from before it existed
-- was Canadian, which the default fills in for them. For a Canadian school
-- `province` holds the province's code; anywhere else, the state or region
-- as typed, or nothing.
alter table schools add column if not exists country text not null default 'CA';

-- ══════════════════════════════════════
-- Profiles (extends auth.users)
-- ══════════════════════════════════════
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin', 'teacher', 'parent', 'student')),
  full_name   text not null,
  email       text,
  phone       text,
  school_id   uuid references schools(id) on delete cascade,
  avatar_url  text,
  active      boolean not null default true,
  created_at  timestamptz default now()
);
alter table profiles enable row level security;

-- Marks the platform operator's own account(s) — the person onboarding
-- schools and selling the product — not a per-school role. Nobody can set
-- this on themselves: it has no UI, and is granted with a one-off
-- `update profiles set is_platform_admin = true where email = '...'` run by
-- whoever runs the database. Kept separate from `role` since it's
-- orthogonal to which school (if any) the account belongs to.
alter table profiles add column if not exists is_platform_admin boolean not null default false;

-- Migration for databases created before this was relaxed. A user created
-- straight from the Supabase dashboard's Auth UI (no raw_user_meta_data)
-- would otherwise fail the on_auth_user_created trigger's not-null
-- constraint before an admin ever gets the chance to assign their real
-- role and school via a follow-up update.
alter table profiles alter column school_id drop not null;
drop policy if exists "Users can read own profile" on profiles;
create policy "Users can read own profile" on profiles
  for select using (auth.uid() = id);
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);
-- security definer + a pinned search_path so these run as the function
-- owner and bypass profiles' own RLS internally. Without that, a policy
-- on profiles that subqueries profiles (e.g. "is the caller an admin of
-- this school") recurses into itself — Postgres has to re-apply every
-- profiles SELECT policy, including this one, to answer that subquery.
-- Postgres reports that as `42P17 infinite recursion detected in policy
-- for relation "profiles"`, and it fires even for a plain self-read: the
-- subquery is planned as an uncorrelated InitPlan evaluated up front,
-- before the simple `auth.uid() = id` branch could ever short-circuit it.
create or replace function my_role()
returns text
language sql security definer stable set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

create or replace function my_school_id()
returns uuid
language sql security definer stable set search_path = public
as $$ select school_id from profiles where id = auth.uid() $$;

drop policy if exists "Admins can read all school profiles" on profiles;
create policy "Admins can read all school profiles" on profiles
  for select using (
    school_id = my_school_id() and my_role() = 'admin'
  );
drop policy if exists "Admins can insert profiles in their school" on profiles;
create policy "Admins can insert profiles in their school" on profiles
  for insert with check (
    school_id = my_school_id() and my_role() = 'admin'
  );
drop policy if exists "Admins can update profiles in their school" on profiles;
create policy "Admins can update profiles in their school" on profiles
  for update using (
    school_id = my_school_id() and my_role() = 'admin'
  );

-- Schools' own policies reference profiles (to check the caller's school
-- and role), so they're defined here rather than right after the schools
-- table — a policy's USING clause is resolved against real tables at
-- creation time and can't forward-reference one defined later in the file.
drop policy if exists "Authenticated users can read their school" on schools;
create policy "Authenticated users can read their school" on schools
  for select using (
    id in (select school_id from profiles where id = auth.uid())
  );
drop policy if exists "Admins can update own school" on schools;
create policy "Admins can update own school" on schools
  for update using (
    id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );

-- Auto-create profile on signup. Schema-qualified and with search_path
-- pinned explicitly: this trigger fires inside a transaction run by
-- Supabase's own auth service role, whose default search_path doesn't
-- include public, so an unqualified "profiles" fails to resolve even
-- though the table exists — a well-known gotcha for this exact pattern.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name, email, school_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'parent'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    (new.raw_user_meta_data->>'school_id')::uuid
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ══════════════════════════════════════
-- Students
-- ══════════════════════════════════════
create table if not exists students (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  grade           int not null check (grade between 0 and 10),
  date_of_birth   date,
  gender          text check (gender in ('male', 'female')),
  avatar_initials text not null,
  avatar_color    text not null default 'bg-subject-blue',
  school_id       uuid not null references schools(id) on delete cascade,
  profile_id      uuid references profiles(id),
  active          boolean not null default true,
  -- Which way this child works through the mushaf. Most hifz students go
  -- 'hifz': An-Nas and up, 114 toward Al-Baqarah, while ayahs still run
  -- 1→n inside each surah. Others go 'forward': Al-Baqarah and down.
  --
  -- On the student rather than on each plan or assignment, because it is
  -- a fact about how the child studies, not about one year or one lesson.
  -- Keeping a copy in both places is how a plan ends up generating
  -- backwards while the daily lessons run forwards. Yearly plans still
  -- record the direction they were built under, for history.
  --
  -- Null until somebody sets it, so an existing school is not silently
  -- assigned an order nobody chose.
  hifz_direction  text check (hifz_direction in ('forward', 'hifz')),
  created_at      timestamptz default now()
);
alter table students enable row level security;
-- Migration for rosters created before the direction was tracked.
alter table students add column if not exists hifz_direction text;
drop policy if exists "Admins and teachers can read students in their school" on students;
create policy "Admins and teachers can read students in their school" on students
  for select using (
    school_id in (select school_id from profiles where id = auth.uid() and role in ('admin', 'teacher'))
  );
drop policy if exists "Student can read own record" on students;
create policy "Student can read own record" on students
  for select using (profile_id = auth.uid());
drop policy if exists "Admins can manage students" on students;
create policy "Admins can manage students" on students
  for all using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );

-- A child signs in with a 4-digit PIN rather than an email and password,
-- which means the office has to be able to read it back to a child who has
-- forgotten it — so it is stored as typed rather than hashed. That is a
-- deliberate trade: a PIN is a low-value credential guarding a child's own
-- homework, and the alternative (resetting it every time a seven-year-old
-- forgets) is worse. RLS keeps it to the school's own staff.
alter table students add column if not exists pin text;

-- ══════════════════════════════════════
-- Parent ↔ Student (many-to-many)
-- ══════════════════════════════════════
create table if not exists parent_students (
  parent_id   uuid not null references profiles(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  relation    text not null default 'parent' check (relation in ('parent', 'guardian', 'other')),
  primary key (parent_id, student_id)
);
alter table parent_students enable row level security;

-- security definer, for the same reason my_role()/my_school_id() above are:
-- students' policies need to ask parent_students a question, and
-- parent_students' policies need to ask students one. Written as plain
-- subqueries those two re-enter each other's RLS forever, and Postgres
-- aborts the whole query with `42P17 infinite recursion detected in policy
-- for relation "students"`. Reading through a definer function answers the
-- question without re-applying the other table's policies.
create or replace function my_children_student_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$ select student_id from parent_students where parent_id = auth.uid() $$;

create or replace function student_school_id(sid uuid)
returns uuid
language sql security definer stable set search_path = public
as $$ select school_id from students where id = sid $$;

drop policy if exists "Parents can read own links" on parent_students;
create policy "Parents can read own links" on parent_students
  for select using (parent_id = auth.uid());
drop policy if exists "Admins can manage parent links" on parent_students;
create policy "Admins can manage parent links" on parent_students
  for all using (
    student_school_id(student_id) = my_school_id() and my_role() = 'admin'
  );

-- Depends on parent_students existing, so it's defined here rather than
-- alongside students' other policies (same forward-reference reason as
-- schools' policies above).
drop policy if exists "Parents can read own children" on students;
create policy "Parents can read own children" on students
  for select using (id in (select my_children_student_ids()));

-- ══════════════════════════════════════
-- Classes
-- ══════════════════════════════════════
create table if not exists classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  subject     text not null,
  grade       int not null check (grade between 0 and 10),
  section     text,
  schedule    text,
  teacher_id  uuid references profiles(id),
  school_id   uuid not null references schools(id) on delete cascade,
  school_year text not null default '2026-2027',
  active      boolean not null default true,
  created_at  timestamptz default now()
);
alter table classes enable row level security;

-- Migration for databases created before these existed. A halaqa can be
-- created before a teacher is assigned to it (the admin UI's "Unassigned"
-- state), and needs a free-text meeting time — neither was in the original
-- generic-curriculum shape of this table.
alter table classes add column if not exists schedule text;
alter table classes alter column teacher_id drop not null;
drop policy if exists "Teachers can read own classes" on classes;
create policy "Teachers can read own classes" on classes
  for select using (teacher_id = auth.uid());
drop policy if exists "Admins can manage all classes" on classes;
create policy "Admins can manage all classes" on classes
  for all using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );

-- ══════════════════════════════════════
-- Class Enrollments (student ↔ class)
-- ══════════════════════════════════════
create table if not exists class_enrollments (
  class_id    uuid not null references classes(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  enrolled_at timestamptz default now(),
  primary key (class_id, student_id)
);
alter table class_enrollments enable row level security;

-- Same definer treatment as the students/parent_students pair above, and
-- for the same cycle: classes' policies ask class_enrollments who is
-- enrolled, class_enrollments' policies ask classes who owns the class.
-- Left as plain subqueries, an admin simply listing halaqas gets
-- `42P17 infinite recursion detected in policy for relation "classes"`
-- and the list comes back as an error rather than as rows.
create or replace function my_enrolled_class_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$
  select ce.class_id
  from class_enrollments ce
  join students s on s.id = ce.student_id
  where s.profile_id = auth.uid()
$$;

create or replace function my_taught_class_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$ select id from classes where teacher_id = auth.uid() $$;

create or replace function class_school_id(cid uuid)
returns uuid
language sql security definer stable set search_path = public
as $$ select school_id from classes where id = cid $$;

drop policy if exists "Teachers can read enrollments for own classes" on class_enrollments;
create policy "Teachers can read enrollments for own classes" on class_enrollments
  for select using (class_id in (select my_taught_class_ids()));
drop policy if exists "Admins can manage enrollments" on class_enrollments;
create policy "Admins can manage enrollments" on class_enrollments
  for all using (
    class_school_id(class_id) = my_school_id() and my_role() = 'admin'
  );

-- Depends on class_enrollments existing, so it's defined here rather than
-- alongside classes' other policies (same forward-reference reason as
-- schools' and students' policies above).
drop policy if exists "Students can read enrolled classes" on classes;
create policy "Students can read enrolled classes" on classes
  for select using (id in (select my_enrolled_class_ids()));

-- ══════════════════════════════════════
-- Lessons
-- ══════════════════════════════════════
create table if not exists lessons (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  subject      text not null,
  grade        int not null,
  week         int not null check (week between 1 and 40),
  day          int not null check (day between 1 and 5),
  content      jsonb,
  video_url    text,
  notes        text,
  class_id     uuid references classes(id) on delete set null,
  teacher_id   uuid references profiles(id),
  school_id    uuid not null references schools(id) on delete cascade,
  published_at timestamptz,
  created_at   timestamptz default now()
);
alter table lessons enable row level security;
drop policy if exists "School members can read published lessons" on lessons;
create policy "School members can read published lessons" on lessons
  for select using (
    published_at is not null and
    school_id in (select school_id from profiles where id = auth.uid())
  );
drop policy if exists "Teachers can manage own lessons" on lessons;
create policy "Teachers can manage own lessons" on lessons
  for all using (teacher_id = auth.uid());
drop policy if exists "Admins can manage all lessons" on lessons;
create policy "Admins can manage all lessons" on lessons
  for all using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );

-- ══════════════════════════════════════
-- Assignments
-- ══════════════════════════════════════
create table if not exists assignments (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  subject      text not null,
  instructions text not null,
  due_date     date not null,
  grade        int not null,
  class_id     uuid references classes(id) on delete set null,
  teacher_id   uuid references profiles(id),
  school_id    uuid not null references schools(id) on delete cascade,
  created_at   timestamptz default now()
);
alter table assignments enable row level security;
drop policy if exists "School members can read assignments" on assignments;
create policy "School members can read assignments" on assignments
  for select using (
    school_id in (select school_id from profiles where id = auth.uid())
  );
drop policy if exists "Teachers can manage own assignments" on assignments;
create policy "Teachers can manage own assignments" on assignments
  for all using (teacher_id = auth.uid());

-- ══════════════════════════════════════
-- Quranic Assignments (for Quranic schools)
-- ══════════════════════════════════════
create table if not exists quranic_assignments (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null references students(id) on delete cascade,
  teacher_id           uuid not null references profiles(id) on delete cascade,
  school_id            uuid not null references schools(id) on delete cascade,
  surah                int not null check (surah between 1 and 114),
  ayah_start           int not null check (ayah_start >= 1),
  -- Ending surah, when the range covers more than one — a muraajah portion
  -- set as "two juz'" rarely lines up with a surah's own edges. Equal to
  -- surah for the common single-surah case.
  surah_end            int not null check (surah_end between surah and 114),
  ayah_end             int not null check (ayah_end >= ayah_start),
  -- Which of the three daily portions this is. A hifz student is set all
  -- three each day: the new lesson (الدرس الجديد), the recent revision
  -- (المراجعة القريبة) and the old revision (المراجعة البعيدة).
  portion              text not null default 'new' check (portion in ('new', 'recent', 'old')),
  assigned_at          timestamptz default now(),
  due_date             date,
  status               text not null default 'assigned' check (status in ('assigned', 'in_progress', 'completed', 'needs_review')),
  memorization_level   int not null default 0 check (memorization_level between 0 and 100),
  -- How the teacher graded today's recitation. Parents read this before any
  -- percentage, so it is set independently of memorization_level.
  daily_rating         text check (daily_rating in ('excellent', 'very_good', 'good', 'weak')),
  teacher_notes        text,
  student_notes        text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- `create table if not exists` above does nothing to a table that already
-- exists, so a school running an earlier build needs the column added.
-- Existing rows become new lessons, which is what a single daily assignment
-- was standing in for.
alter table quranic_assignments
  add column if not exists portion text not null default 'new';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quranic_assignments_portion_check'
  ) then
    alter table quranic_assignments
      add constraint quranic_assignments_portion_check
      check (portion in ('new', 'recent', 'old'));
  end if;
end $$;
alter table quranic_assignments
  add column if not exists daily_rating text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quranic_assignments_daily_rating_check'
  ) then
    alter table quranic_assignments
      add constraint quranic_assignments_daily_rating_check
      check (daily_rating in ('excellent', 'very_good', 'good', 'weak'));
  end if;
end $$;
alter table quranic_assignments
  add column if not exists surah_end int;
update quranic_assignments set surah_end = surah where surah_end is null;
alter table quranic_assignments
  alter column surah_end set not null;
-- Which of these rows the yearly-plan generator wrote versus a teacher
-- typed by hand — the generator needs to know how far it already got
-- without being confused by a manual row a teacher added out of band, and
-- a manual correction must never look like the schedule caught up on its
-- own. Every existing row is 'manual' by definition: this column did not
-- exist for the generator to have written anything yet, which is also why
-- the uniqueness below is safe to add outright — nothing can already
-- violate it.
alter table quranic_assignments
  add column if not exists source text not null default 'manual';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quranic_assignments_source_check'
  ) then
    alter table quranic_assignments
      add constraint quranic_assignments_source_check
      check (source in ('manual', 'auto'));
  end if;
end $$;
create unique index if not exists quranic_assignments_auto_one_per_day
  on quranic_assignments(student_id, due_date)
  where portion = 'new' and source = 'auto';
-- Earlier builds constrained surah_end to "between surah and 114" (added
-- here by name, and as the table's own unnamed checks alongside "ayah_end
-- >= ayah_start"). It is no longer added at all: re-adding it on every run
-- only to drop it again below failed outright the moment the table held a
-- single hifz lesson crossing into an earlier surah. Those checks all
-- assume an *ascending* walk — true for
-- a "forward" lesson, false for a "hifz" one, where the walk moves toward
-- *lower* surah numbers and, inside the surah it lands in, potentially a
-- lower ayah too. A lesson that starts at Al-Falaq 4 and reaches into
-- Al-Ikhlas 1 is a normal hifz-direction lesson; the old constraints
-- rejected it outright, which is exactly what the assignment generator in
-- autoAssignments.ts hit the first time anything actually produced one.
-- Dropped and replaced with independent range checks. Safe on a school
-- already using this table: every constraint below is strictly looser
-- than what it replaces, so any row that satisfied the old rule already
-- satisfies the new one.
alter table quranic_assignments drop constraint if exists quranic_assignments_check;
alter table quranic_assignments drop constraint if exists quranic_assignments_check1;
alter table quranic_assignments drop constraint if exists quranic_assignments_surah_end_check;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quranic_assignments_surah_end_range_check'
  ) then
    alter table quranic_assignments
      add constraint quranic_assignments_surah_end_range_check
      check (surah_end between 1 and 114);
  end if;
end $$;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quranic_assignments_ayah_end_check'
  ) then
    alter table quranic_assignments
      add constraint quranic_assignments_ayah_end_check
      check (ayah_end >= 1);
  end if;
end $$;
alter table quranic_assignments enable row level security;
drop policy if exists "Teachers can manage own quranic assignments" on quranic_assignments;
create policy "Teachers can manage own quranic assignments" on quranic_assignments
  for all using (teacher_id = auth.uid());
drop policy if exists "Students can read own quranic assignments" on quranic_assignments;
create policy "Students can read own quranic assignments" on quranic_assignments
  for select using (
    student_id in (select id from students where profile_id = auth.uid())
  );
drop policy if exists "Parents can read children quranic assignments" on quranic_assignments;
create policy "Parents can read children quranic assignments" on quranic_assignments
  for select using (
    student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );
drop policy if exists "Admins can manage quranic assignments" on quranic_assignments;
create policy "Admins can manage quranic assignments" on quranic_assignments
  for all using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );

-- A student's "new" lessons can be generated straight from their yearly
-- plan (see dailySchedule/autoAssignments), which means nothing stops the
-- walk at the end of a surah on its own — the mushaf just carries on into
-- the next one. This table is that stop: one row means a teacher has
-- actually heard the student recite the whole surah, not just its last
-- day's portion, and the generator refuses to schedule anything in the
-- next surah until the row exists.
create table if not exists surah_test_confirmations (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students(id) on delete cascade,
  school_id      uuid not null references schools(id) on delete cascade,
  surah          int not null check (surah between 1 and 114),
  teacher_id     uuid not null references profiles(id) on delete cascade,
  confirmed_at   timestamptz not null default now(),
  notes          text,
  -- A surah is tested once; a second confirmation would just be a second
  -- click on the same button, not a second fact.
  constraint surah_test_confirmations_one_per_surah unique (student_id, surah)
);
alter table surah_test_confirmations enable row level security;
drop policy if exists "Teachers can manage own students' surah confirmations" on surah_test_confirmations;
create policy "Teachers can manage own students' surah confirmations" on surah_test_confirmations
  for all using (teacher_id = auth.uid());
drop policy if exists "Students can read own surah confirmations" on surah_test_confirmations;
create policy "Students can read own surah confirmations" on surah_test_confirmations
  for select using (
    student_id in (select id from students where profile_id = auth.uid())
  );
drop policy if exists "Parents can read children surah confirmations" on surah_test_confirmations;
create policy "Parents can read children surah confirmations" on surah_test_confirmations
  for select using (
    student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );
drop policy if exists "Admins can manage surah confirmations" on surah_test_confirmations;
create policy "Admins can manage surah confirmations" on surah_test_confirmations
  for all using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );
create index if not exists idx_surah_test_confirmations_student
  on surah_test_confirmations(student_id);

-- ══════════════════════════════════════
-- Submissions
-- ══════════════════════════════════════
create table if not exists submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid references assignments(id) on delete cascade,
  student_id     uuid references students(id) on delete cascade,
  status         text not null default 'not_started' check (status in ('not_started', 'submitted', 'graded')),
  grade_letter   text,
  grade_percent  int,
  submitted_at   timestamptz,
  graded_at      timestamptz,
  created_at     timestamptz default now(),
  unique (assignment_id, student_id)
);
alter table submissions enable row level security;
drop policy if exists "Teachers can manage submissions for own assignments" on submissions;
create policy "Teachers can manage submissions for own assignments" on submissions
  for all using (
    assignment_id in (select id from assignments where teacher_id = auth.uid())
  );
drop policy if exists "Students can read own submissions" on submissions;
create policy "Students can read own submissions" on submissions
  for select using (
    student_id in (select id from students where profile_id = auth.uid())
  );
drop policy if exists "Parents can read children submissions" on submissions;
create policy "Parents can read children submissions" on submissions
  for select using (
    student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );

-- ══════════════════════════════════════
-- Attendance
-- ══════════════════════════════════════
create table if not exists attendance (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  class_id    uuid references classes(id) on delete set null,
  class_date  date not null,
  status      text not null check (status in ('present', 'late', 'absent', 'excused')),
  notes       text,
  teacher_id  uuid not null references profiles(id),
  school_id   uuid not null references schools(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (student_id, class_id, class_date)
);
alter table attendance enable row level security;

-- Migration for databases created before "excused" existed as a status —
-- the teacher attendance UI has always offered it as a fourth option
-- alongside present/late/absent.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'attendance_status_check'
  ) then
    alter table attendance drop constraint attendance_status_check;
  end if;
  alter table attendance
    add constraint attendance_status_check
    check (status in ('present', 'late', 'absent', 'excused'));
end $$;
drop policy if exists "Teachers can manage attendance for own classes" on attendance;
create policy "Teachers can manage attendance for own classes" on attendance
  for all using (teacher_id = auth.uid());
drop policy if exists "Admins can read all attendance" on attendance;
create policy "Admins can read all attendance" on attendance
  for select using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "Parents can read children attendance" on attendance;
create policy "Parents can read children attendance" on attendance
  for select using (
    student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );
drop policy if exists "Students can read own attendance" on attendance;
create policy "Students can read own attendance" on attendance
  for select using (
    student_id in (select id from students where profile_id = auth.uid())
  );

-- ══════════════════════════════════════
-- Fees
-- ══════════════════════════════════════
create table if not exists fees (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  school_id    uuid not null references schools(id) on delete cascade,
  term         int not null,
  description  text not null default 'Tuition',
  amount_due   numeric(10,2) not null,
  amount_paid  numeric(10,2) not null default 0,
  due_date     date not null,
  status       text not null default 'due' check (status in ('due', 'partial', 'paid')),
  created_at   timestamptz default now()
);
alter table fees enable row level security;
drop policy if exists "Admins can manage fees" on fees;
create policy "Admins can manage fees" on fees
  for all using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "Parents can read own children fees" on fees;
create policy "Parents can read own children fees" on fees
  for select using (
    student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );

-- ══════════════════════════════════════
-- Subject Grades (report cards)
-- ══════════════════════════════════════
create table if not exists subject_grades (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete cascade,
  class_id        uuid references classes(id) on delete set null,
  subject         text not null,
  course_code     text not null,
  grade_percent   int not null check (grade_percent between 0 and 100),
  teacher_comment text,
  term            int not null,
  school_year     text not null,
  teacher_id      uuid references profiles(id),
  school_id       uuid not null references schools(id) on delete cascade,
  created_at      timestamptz default now(),
  unique (student_id, subject, term, school_year)
);
alter table subject_grades enable row level security;
drop policy if exists "Teachers can manage grades" on subject_grades;
create policy "Teachers can manage grades" on subject_grades
  for all using (teacher_id = auth.uid());
drop policy if exists "Admins can read all grades" on subject_grades;
create policy "Admins can read all grades" on subject_grades
  for select using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "Parents can read own children grades" on subject_grades;
create policy "Parents can read own children grades" on subject_grades
  for select using (
    student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );
drop policy if exists "Students can read own grades" on subject_grades;
create policy "Students can read own grades" on subject_grades
  for select using (
    student_id in (select id from students where profile_id = auth.uid())
  );

-- ══════════════════════════════════════
-- Announcements
-- ══════════════════════════════════════
create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  audience   text not null default 'all' check (audience in ('all', 'teachers', 'parents', 'students')),
  author_id  uuid not null references profiles(id),
  school_id  uuid not null references schools(id) on delete cascade,
  pinned     boolean not null default false,
  created_at timestamptz default now()
);
alter table announcements enable row level security;
drop policy if exists "School members can read announcements" on announcements;
create policy "School members can read announcements" on announcements
  for select using (
    school_id in (select school_id from profiles where id = auth.uid())
  );
drop policy if exists "Admins can manage announcements" on announcements;
create policy "Admins can manage announcements" on announcements
  for all using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );

-- ══════════════════════════════════════
-- Messages (parent ↔ teacher, per student)
-- ══════════════════════════════════════
create table if not exists messages (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  school_id     uuid not null references schools(id) on delete cascade,
  author_id     uuid not null references profiles(id),
  author_role   text not null check (author_role in ('parent', 'teacher')),
  -- "absence" carries a specific date rather than free text, so a teacher's
  -- inbox can flag it distinctly from a general concern.
  kind          text not null default 'message' check (kind in ('message', 'absence')),
  body          text not null,
  absence_date  date,
  created_at    timestamptz default now()
);
alter table messages enable row level security;

-- Originally scoped to students enrolled in one of the teacher's own
-- classes, via class_enrollments/classes.teacher_id. Nothing in the admin
-- UI requires a school to set up halaqas and enroll students into them
-- before a teacher can be added — students, attendance, and quranic
-- assignments all already treat "any teacher at this school" as enough —
-- so a school that skipped that setup had a teacher who could never see a
-- parent's messages at all: the class_enrollments join was always empty.
drop policy if exists "Teachers can manage messages in their school" on messages;
create policy "Teachers can manage messages in their school" on messages
  for all using (
    (school_id = my_school_id() and my_role() in ('admin', 'teacher'))
    or author_id = auth.uid()
  );
drop policy if exists "Parents can read and send messages for own children" on messages;
create policy "Parents can read and send messages for own children" on messages
  for all using (
    student_id in (select student_id from parent_students where parent_id = auth.uid())
    or author_id = auth.uid()
  );
drop policy if exists "Admins can read all messages" on messages;
create policy "Admins can read all messages" on messages
  for select using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );

-- ══════════════════════════════════════
-- Recitation log (one dated entry per graded session)
-- ══════════════════════════════════════
-- quranic_assignments.daily_rating is only ever the latest snapshot for a
-- portion — grading it again overwrites the last mark. Every grading also
-- writes a row here, so a parent or teacher can look back over the whole
-- month rather than only ever seeing today's mark.
create table if not exists recitation_log (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  teacher_id    uuid not null references profiles(id),
  school_id     uuid not null references schools(id) on delete cascade,
  assignment_id uuid references quranic_assignments(id) on delete set null,
  portion       text not null check (portion in ('new', 'recent', 'old')),
  surah         int not null check (surah between 1 and 114),
  ayah_start    int not null check (ayah_start >= 1),
  -- Ending surah, when the session covered more than one. Equal to surah
  -- for the common single-surah case.
  surah_end     int not null check (surah_end between surah and 114),
  ayah_end      int not null check (ayah_end >= ayah_start),
  rating        text not null check (rating in ('excellent', 'very_good', 'good', 'weak')),
  notes         text,
  -- The day the session was heard, distinct from created_at (when the row
  -- was written) so a teacher can log yesterday's session without it
  -- appearing to have happened today.
  session_date  date not null default current_date,
  created_at    timestamptz default now()
);
alter table recitation_log
  add column if not exists surah_end int;
update recitation_log set surah_end = surah where surah_end is null;
alter table recitation_log
  alter column surah_end set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'recitation_log_surah_end_check'
  ) then
    alter table recitation_log
      add constraint recitation_log_surah_end_check
      check (surah_end between surah and 114);
  end if;
end $$;
alter table recitation_log enable row level security;
drop policy if exists "Teachers can manage recitation log for own students" on recitation_log;
create policy "Teachers can manage recitation log for own students" on recitation_log
  for all using (teacher_id = auth.uid());
drop policy if exists "Students can read own recitation log" on recitation_log;
create policy "Students can read own recitation log" on recitation_log
  for select using (
    student_id in (select id from students where profile_id = auth.uid())
  );
drop policy if exists "Parents can read children recitation log" on recitation_log;
create policy "Parents can read children recitation log" on recitation_log
  for select using (
    student_id in (select student_id from parent_students where parent_id = auth.uid())
  );
drop policy if exists "Admins can read all recitation log" on recitation_log;
create policy "Admins can read all recitation log" on recitation_log
  for select using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );

-- ══════════════════════════════════════
-- Stars and badges (teacher-awarded recognition)
-- ══════════════════════════════════════
-- Separate from the XP the student portal computes from assignments and
-- attendance. XP is earned by doing the work; a star is a teacher choosing
-- to mark something. Keeping them in different places means neither can be
-- mistaken for the other.
create table if not exists student_stars (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  teacher_id  uuid not null references profiles(id),
  school_id   uuid not null references schools(id) on delete cascade,
  reason      text not null check (reason in ('attendance', 'assignment', 'quiz', 'quran', 'effort')),
  note        text,
  created_at  timestamptz default now()
);
alter table student_stars enable row level security;
drop policy if exists "Teachers can manage stars for own students" on student_stars;
create policy "Teachers can manage stars for own students" on student_stars
  for all using (teacher_id = auth.uid());
drop policy if exists "Students can read own stars" on student_stars;
create policy "Students can read own stars" on student_stars
  for select using (
    student_id in (select id from students where profile_id = auth.uid())
  );
drop policy if exists "Parents can read children stars" on student_stars;
create policy "Parents can read children stars" on student_stars
  for select using (
    student_id in (select student_id from parent_students where parent_id = auth.uid())
  );
drop policy if exists "Admins can read all stars" on student_stars;
create policy "Admins can read all stars" on student_stars
  for select using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );

-- One of each badge per student: a badge is a standing achievement, not a
-- tally, so awarding the same one twice would say nothing new.
create table if not exists student_badges (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  teacher_id  uuid not null references profiles(id),
  school_id   uuid not null references schools(id) on delete cascade,
  badge       text not null check (badge in ('perfect_attendance', 'homework_champion', 'quran_achiever', 'tajweed_star', 'most_improved', 'consistent_learner')),
  created_at  timestamptz default now(),
  unique (student_id, badge)
);
alter table student_badges enable row level security;
drop policy if exists "Teachers can manage badges for own students" on student_badges;
create policy "Teachers can manage badges for own students" on student_badges
  for all using (teacher_id = auth.uid());
drop policy if exists "Students can read own badges" on student_badges;
create policy "Students can read own badges" on student_badges
  for select using (
    student_id in (select id from students where profile_id = auth.uid())
  );
drop policy if exists "Parents can read children badges" on student_badges;
create policy "Parents can read children badges" on student_badges
  for select using (
    student_id in (select student_id from parent_students where parent_id = auth.uid())
  );
drop policy if exists "Admins can read all badges" on student_badges;
create policy "Admins can read all badges" on student_badges
  for select using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );

-- ══════════════════════════════════════
-- Individualized yearly Qur'an plan
-- ══════════════════════════════════════
-- A yearly plan is the long arc a teacher sets for one student: where the
-- child should be by Ramadan, where by the end of the year. It is split
-- into milestones with their own dates and targets, and progress is
-- recorded against those milestones rather than against the year as a
-- whole — which is what makes "is this child behind?" answerable at all.
-- One running total against one end date can only say whether the year is
-- on course; the milestone schedule is what says whether this month is.
--
-- ── On the _enc columns ──────────────────────────────────────────────
-- Every field carrying what a teacher actually wrote about a child — plan
-- titles, milestone descriptions, progress remarks, the text of an alert —
-- is stored as ciphertext, encrypted by the application (src/lib/
-- planCrypto.ts) before it is ever sent to Postgres. They are text columns
-- because that is what an AES-256-GCM envelope serialises to. Nothing in
-- the database can read them, and neither can anyone holding a database
-- backup or a leaked service-role key without also holding
-- PLAN_ENCRYPTION_KEY, which lives only in the server's environment.
--
-- The structural columns around them are deliberately NOT encrypted:
-- student_id, school_id, the dates, the unit counts, the status enums.
-- Three reasons, in order of weight:
--   1. RLS is the access control for this module, and a policy cannot read
--      through ciphertext. Encrypting student_id would leave no way for a
--      policy to scope a row to a parent's own child, and the only thing
--      protecting it would be application code remembering to filter.
--   2. Progress and pace are computed from dates and integers. Encrypted,
--      every one would have to be pulled into Node and decrypted before a
--      single comparison — no ordering, no date ranges, no usable index.
--   3. They carry no content on their own. "42 ayahs by 2026-03-01" hung
--      off an opaque row id says nothing about a child; the sentence the
--      teacher wrote beside it does, and that sentence is encrypted.
-- If a deployment needs the dates hidden too, that is a real change and
-- not a config flag: it costs the RLS policies below and all SQL-side
-- ordering, and the progress sweep becomes a full decrypt of every plan.

create table if not exists yearly_plans (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references students(id) on delete cascade,
  teacher_id        uuid not null references profiles(id) on delete cascade,
  school_id         uuid not null references schools(id) on delete cascade,
  -- Plain label like '2025-2026'. Kept clear so a school can list which
  -- years it has on file without decrypting every plan it owns.
  academic_year     text not null,
  starts_on         date not null,
  ends_on           date not null,
  -- What the targets below are counted in. A hifz plan counts ayahs; a
  -- qaidah plan counts pages or lessons.
  unit              text not null default 'ayah'
                    check (unit in ('ayah', 'page', 'line', 'surah', 'juz', 'lesson')),
  status            text not null default 'draft'
                    check (status in ('draft', 'active', 'completed', 'archived')),
  -- Where in the mushaf the plan was anchored when it was built, and
  -- which way through it the student works. Most hifz students go
  -- backwards — An-Nas up through Juz 30, 29, 28 — while ayahs still run
  -- 1→n inside each surah, so the direction cannot be inferred from the
  -- positions alone and has to be recorded.
  --
  -- Null on a plan built as a plain count with no mushaf anchor, which
  -- stays supported: a qaidah or lesson-counted plan has no surah.
  start_surah       int check (start_surah between 1 and 114),
  start_ayah        int check (start_ayah >= 1),
  direction         text check (direction in ('forward', 'hifz')),
  -- Encrypted: the teacher's own words.
  title_enc         text,
  notes_enc         text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  -- A year ending before it starts would make every pace calculation below
  -- divide by a negative span, so it is refused at the column.
  constraint yearly_plans_dates_ordered check (ends_on > starts_on),
  -- One plan per student per year. A student may carry an archived plan
  -- from last year and a draft for next at the same time, so uniqueness is
  -- on the pair rather than on student_id alone.
  constraint yearly_plans_one_per_year unique (student_id, academic_year)
);
alter table yearly_plans enable row level security;

create table if not exists yearly_plan_milestones (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references yearly_plans(id) on delete cascade,
  -- Position in the plan, 1-based. Ordering by due_on alone breaks when two
  -- milestones share a date, which happens whenever a teacher splits a
  -- month into a memorisation goal and a revision goal.
  sequence          int not null check (sequence >= 1),
  starts_on         date not null,
  due_on            date not null,
  -- How many units this milestone adds — not a running total. The plan's
  -- total is the sum, so editing one milestone cannot silently desync the
  -- rest from a stored grand total.
  -- Numeric, not int: five juz across ten months is half a juz a month,
  -- and whole numbers cannot say that. Rounded to whole units, the
  -- remainder piles into the earliest segments — a 5-juz year came out as
  -- one juz a month from September to January and nothing afterwards,
  -- which then read as "complete" from February while the school meant
  -- June. Two decimals covers quarter- and half-unit targets without
  -- inviting float noise into the pace arithmetic.
  target_units      numeric(8,2) not null default 0 check (target_units >= 0),
  -- How many the teacher has signed off. Not capped against target_units
  -- here: a child reciting further than the milestone asked is a real
  -- thing, and the pace maths clamps it where clamping matters rather than
  -- refusing the write and losing the fact.
  completed_units   numeric(8,2) not null default 0 check (completed_units >= 0),
  status            text not null default 'pending'
                    check (status in ('pending', 'in_progress', 'completed', 'missed')),
  completed_on      date,
  -- Which stretch of the mushaf this segment covers. Null on a plan that
  -- is a plain count rather than a walk through the text.
  --
  -- NOT encrypted, unlike the wording beside it, and the same call the
  -- existing quranic_assignments table already makes: a surah and ayah
  -- number is where a lesson sits in a shared, public text, not something
  -- written about a child. Keeping it readable is also what lets the
  -- database order and filter milestones by position at all, which a
  -- ciphertext column could not.
  from_surah        int check (from_surah between 1 and 114),
  from_ayah         int check (from_ayah >= 1),
  to_surah          int check (to_surah between 1 and 114),
  to_ayah           int check (to_ayah >= 1),
  -- Encrypted: the teacher's own words.
  title_enc         text,
  description_enc   text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  constraint yearly_plan_milestones_dates_ordered check (due_on >= starts_on),
  constraint yearly_plan_milestones_seq_unique unique (plan_id, sequence)
);
alter table yearly_plan_milestones enable row level security;

-- Every progress update a teacher records, kept rather than overwritten:
-- milestones.completed_units is the current figure, this is how it got
-- there. "When did she start falling behind?" is answered from here.
create table if not exists yearly_plan_progress (
  id                uuid primary key default gen_random_uuid(),
  milestone_id      uuid not null references yearly_plan_milestones(id) on delete cascade,
  -- Denormalised from the milestone so a plan's whole history is one
  -- indexed read. Reached through the milestone it would be a join, and the
  -- RLS policy on the far side would be re-derived per row.
  plan_id           uuid not null references yearly_plans(id) on delete cascade,
  teacher_id        uuid not null references profiles(id) on delete cascade,
  recorded_on       date not null default current_date,
  -- The milestone's completed_units as of this entry, not a delta: a
  -- teacher correcting yesterday's figure downwards is ordinary, and deltas
  -- would record that as an awkward negative row.
  units_after       numeric(8,2) not null check (units_after >= 0),
  note_enc          text,
  created_at        timestamptz default now()
);
alter table yearly_plan_progress enable row level security;

-- Alerts are persisted rather than recomputed for display only, for two
-- reasons: a parent should see the same banner the teacher sees, and "this
-- child has been behind since February" is a fact about a date, which needs
-- somewhere to live. Clearing is a resolved_on timestamp rather than a
-- delete, so the history survives a child catching back up.
create table if not exists yearly_plan_alerts (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references yearly_plans(id) on delete cascade,
  student_id        uuid not null references students(id) on delete cascade,
  school_id         uuid not null references schools(id) on delete cascade,
  code              text not null
                    check (code in ('behind_schedule', 'milestone_overdue', 'no_recent_progress', 'ending_incomplete')),
  level             text not null default 'warning' check (level in ('info', 'warning', 'critical')),
  triggered_on      date not null default current_date,
  resolved_on       date,
  acknowledged_at   timestamptz,
  detail_enc        text,
  created_at        timestamptz default now(),
  -- One alert per plan per kind per day. Without this the sweep would add a
  -- fresh row every time a parent opened the page.
  constraint yearly_plan_alerts_one_open unique (plan_id, code, triggered_on)
);
alter table yearly_plan_alerts enable row level security;

-- Columns added after the first cut of this module; `create table if not
-- exists` above leaves an existing table untouched, so they are added
-- here for a database that already has it.
alter table yearly_plans add column if not exists start_surah int;
alter table yearly_plans add column if not exists start_ayah int;
alter table yearly_plans add column if not exists direction text;
-- A steady per-instructional-day pace ("1 page a day"), as an alternative
-- to typing a year's total and letting it apportion evenly. Null on every
-- plan made the other way — nothing here reads differently until a value
-- is actually set. Review carries no mushaf position of its own: it is a
-- daily amount the teacher chooses which pages to spend on, not a second
-- walk through the text.
alter table yearly_plans add column if not exists daily_new_amount numeric(8,2)
  check (daily_new_amount is null or daily_new_amount > 0);
alter table yearly_plans add column if not exists daily_review_amount numeric(8,2)
  check (daily_review_amount is null or daily_review_amount > 0);
-- Review is commonly sized in a much bigger unit than new memorisation —
-- reviewing a whole juz a day is ordinary, memorising one is not — so it
-- gets its own unit rather than sharing the plan's `unit` column. Null on
-- a plan with no review amount set, and on a plan saved before this column
-- existed, where the UI falls back to the plan's own `unit`.
alter table yearly_plans add column if not exists daily_review_unit text
  check (daily_review_unit is null or daily_review_unit in ('ayah', 'page', 'line', 'surah', 'juz', 'lesson'));
alter table yearly_plan_milestones add column if not exists from_surah int;
alter table yearly_plan_milestones add column if not exists from_ayah int;
alter table yearly_plan_milestones add column if not exists to_surah int;
alter table yearly_plan_milestones add column if not exists to_ayah int;

-- `create table if not exists` above leaves an existing table alone, so a
-- deployment that applied the first cut of this module still has int
-- quantity columns. Widening them is safe and keeps every stored value.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'yearly_plan_milestones' and column_name = 'target_units'
      and data_type = 'integer'
  ) then
    alter table yearly_plan_milestones alter column target_units type numeric(8,2);
    alter table yearly_plan_milestones alter column completed_units type numeric(8,2);
    alter table yearly_plan_progress   alter column units_after type numeric(8,2);
  end if;
end $$;

-- ── RLS helpers ──────────────────────────────────────────────────────
-- Security definer for the same reason as the helpers further up: a
-- milestone's policy has to ask its plan a question, and asking it as a
-- plain subquery re-enters yearly_plans' own policies, which ask students,
-- which ask parent_students. Postgres gives up on that with
-- `42P17 infinite recursion detected in policy for relation "yearly_plans"`.
create or replace function plan_student_id(pid uuid)
returns uuid
language sql security definer stable set search_path = public
as $$ select student_id from yearly_plans where id = pid $$;

create or replace function plan_school_id(pid uuid)
returns uuid
language sql security definer stable set search_path = public
as $$ select school_id from yearly_plans where id = pid $$;

create or replace function milestone_plan_id(mid uuid)
returns uuid
language sql security definer stable set search_path = public
as $$ select plan_id from yearly_plan_milestones where id = mid $$;

-- ── yearly_plans ─────────────────────────────────────────────────────
-- Teachers reach any plan in their own school, not only ones they wrote:
-- halaqas get reassigned mid-year, and a plan whose author has left has to
-- stay editable by whoever took the class over. The school boundary is the
-- one that actually matters, and it is enforced here rather than trusted to
-- the client.
drop policy if exists "Teachers can manage plans in their school" on yearly_plans;
create policy "Teachers can manage plans in their school" on yearly_plans
  for all using (school_id = my_school_id() and my_role() in ('teacher', 'admin'));

drop policy if exists "Parents can read own children plans" on yearly_plans;
create policy "Parents can read own children plans" on yearly_plans
  for select using (student_id in (select my_children_student_ids()));

drop policy if exists "Students can read own plan" on yearly_plans;
create policy "Students can read own plan" on yearly_plans
  for select using (
    student_id in (select id from students where profile_id = auth.uid())
  );

-- ── yearly_plan_milestones ───────────────────────────────────────────
drop policy if exists "Teachers can manage milestones in their school" on yearly_plan_milestones;
create policy "Teachers can manage milestones in their school" on yearly_plan_milestones
  for all using (plan_school_id(plan_id) = my_school_id() and my_role() in ('teacher', 'admin'));

drop policy if exists "Parents can read own children milestones" on yearly_plan_milestones;
create policy "Parents can read own children milestones" on yearly_plan_milestones
  for select using (plan_student_id(plan_id) in (select my_children_student_ids()));

drop policy if exists "Students can read own milestones" on yearly_plan_milestones;
create policy "Students can read own milestones" on yearly_plan_milestones
  for select using (
    plan_student_id(plan_id) in (select id from students where profile_id = auth.uid())
  );

-- ── yearly_plan_progress ─────────────────────────────────────────────
drop policy if exists "Teachers can manage progress in their school" on yearly_plan_progress;
create policy "Teachers can manage progress in their school" on yearly_plan_progress
  for all using (plan_school_id(plan_id) = my_school_id() and my_role() in ('teacher', 'admin'));

drop policy if exists "Parents can read own children progress" on yearly_plan_progress;
create policy "Parents can read own children progress" on yearly_plan_progress
  for select using (plan_student_id(plan_id) in (select my_children_student_ids()));

drop policy if exists "Students can read own plan progress" on yearly_plan_progress;
create policy "Students can read own plan progress" on yearly_plan_progress
  for select using (
    plan_student_id(plan_id) in (select id from students where profile_id = auth.uid())
  );

-- ── yearly_plan_alerts ───────────────────────────────────────────────
drop policy if exists "Teachers can manage plan alerts in their school" on yearly_plan_alerts;
create policy "Teachers can manage plan alerts in their school" on yearly_plan_alerts
  for all using (school_id = my_school_id() and my_role() in ('teacher', 'admin'));

drop policy if exists "Parents can read own children plan alerts" on yearly_plan_alerts;
create policy "Parents can read own children plan alerts" on yearly_plan_alerts
  for select using (student_id in (select my_children_student_ids()));

-- A parent may update their own child's alert rows, but the only column the
-- application ever sets from a parent request is acknowledged_at — that is
-- what dismissing the banner writes. Postgres has no column-level grant
-- inside a policy, so that narrowing lives in the API route; this policy's
-- job is the row boundary, and it holds whatever the route does.
drop policy if exists "Parents can acknowledge own children plan alerts" on yearly_plan_alerts;
create policy "Parents can acknowledge own children plan alerts" on yearly_plan_alerts
  for update using (student_id in (select my_children_student_ids()))
  with check (student_id in (select my_children_student_ids()));

-- ══════════════════════════════════════
-- Indexes for performance
-- ══════════════════════════════════════
create index if not exists idx_profiles_school   on profiles(school_id);
create index if not exists idx_profiles_role     on profiles(role);
create index if not exists idx_students_school   on students(school_id);
create index if not exists idx_students_grade    on students(grade);
create index if not exists idx_classes_school    on classes(school_id);
create index if not exists idx_classes_teacher   on classes(teacher_id);
create index if not exists idx_enrollments_student on class_enrollments(student_id);
create index if not exists idx_attendance_date   on attendance(class_date);
create index if not exists idx_attendance_student on attendance(student_id);
create index if not exists idx_lessons_school    on lessons(school_id);
create index if not exists idx_fees_student      on fees(student_id);
create index if not exists idx_grades_student    on subject_grades(student_id);
create index if not exists idx_announcements_school on announcements(school_id);
create index if not exists idx_quranic_assignments_student on quranic_assignments(student_id);
create index if not exists idx_quranic_assignments_teacher on quranic_assignments(teacher_id);
create index if not exists idx_quranic_assignments_surah on quranic_assignments(surah);
create index if not exists idx_messages_student on messages(student_id);
create index if not exists idx_messages_created on messages(created_at);
create index if not exists idx_recitation_log_student on recitation_log(student_id);
create index if not exists idx_recitation_log_date on recitation_log(session_date);
create index if not exists idx_student_stars_student on student_stars(student_id);
create index if not exists idx_student_badges_student on student_badges(student_id);
create index if not exists idx_yearly_plans_student on yearly_plans(student_id);
create index if not exists idx_yearly_plans_school on yearly_plans(school_id);
-- The teacher portal's default view is "active plans in my school", and the
-- alert sweep walks the same set.
create index if not exists idx_yearly_plans_school_status on yearly_plans(school_id, status);
-- Milestones are always read as a plan's ordered list, never individually.
create index if not exists idx_yearly_plan_milestones_plan on yearly_plan_milestones(plan_id, sequence);
create index if not exists idx_yearly_plan_milestones_due on yearly_plan_milestones(due_on);
create index if not exists idx_yearly_plan_progress_plan on yearly_plan_progress(plan_id, recorded_on);
create index if not exists idx_yearly_plan_progress_milestone on yearly_plan_progress(milestone_id);
-- Partial: the only alerts anyone queries are the open ones. A school that
-- has run for years accumulates resolved rows this index never carries.
create index if not exists idx_yearly_plan_alerts_open
  on yearly_plan_alerts(student_id, code) where resolved_on is null;

-- ══════════════════════════════════════
-- School calendar
-- ══════════════════════════════════════
-- What "expected by today" means depends on how many school days have
-- actually happened, not how many calendar days have gone by. Without
-- this, a plan's pace curve runs across weekends and holidays exactly
-- like a Tuesday — every yearly plan reads as further behind on a Monday
-- morning than it really is, and the gap never closes because the same
-- error repeats every week of the year.
--
-- Two independent pieces, because they answer different questions and
-- change on different schedules. Which weekdays carry Quran instruction
-- at all is a standing fact about the timetable — most schools set it
-- once and rarely touch it again, which is why it lives as one row of
-- flags on the school itself rather than as a table a query has to
-- aggregate. Which specific dates are closed (Eid, winter break, a PD
-- day) is a list that grows all year, so those are individual rows a
-- calendar upload or a form can add to without touching anything else.

-- A student not in class for Qur'an on a Friday because that block is
-- given to PE is the same, calendar-wise, as the school being closed on
-- Saturday: the day simply carries no expected progress. Modelled as a
-- weekday flag rather than a special "PE day" concept, because the
-- pace engine only ever needs one answer — was there Qur'an instruction
-- this day — and a school that later moves PE to a different weekday
-- changes one flag rather than a schema.
--
-- 1 = Monday .. 7 = Sunday (ISO 8601), so the array reads left-to-right
-- the way a week does on a page. Defaults to the ordinary five-day week;
-- a school unchecks Friday for PE, or any other day their timetable
-- gives to something other than Qur'an.
alter table schools add column if not exists instructional_weekdays int[] not null default '{1,2,3,4,5}';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'schools_instructional_weekdays_valid'
  ) then
    alter table schools add constraint schools_instructional_weekdays_valid
      check (instructional_weekdays <@ array[1,2,3,4,5,6,7]);
  end if;
end $$;

-- One row per closed calendar date — a multi-week break is expanded into
-- one row per day at the point it is added, rather than stored as a
-- range, so every query that asks "is this date closed" is a single
-- indexed lookup instead of a range-containment check repeated across a
-- school year of dates.
create table if not exists school_calendar_days (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools(id) on delete cascade,
  date       date not null,
  -- Not encrypted, and deliberately so: unlike the yearly-plan content
  -- above, a label like "Eid al-Fitr" or "Winter break" describes the
  -- school's own timetable, not a child, and the pace engine has to be
  -- able to order and filter these rows the same way it does dates
  -- elsewhere in this module.
  label      text,
  created_at timestamptz default now(),
  constraint school_calendar_days_unique unique (school_id, date)
);
alter table school_calendar_days enable row level security;

drop policy if exists "Authenticated users can read their school's calendar" on school_calendar_days;
create policy "Authenticated users can read their school's calendar" on school_calendar_days
  for select using (school_id = my_school_id());
drop policy if exists "Admins can manage their school's calendar" on school_calendar_days;
create policy "Admins can manage their school's calendar" on school_calendar_days
  for all using (school_id = my_school_id() and my_role() = 'admin');

create index if not exists idx_school_calendar_days_school_date
  on school_calendar_days(school_id, date);

-- ══════════════════════════════════════
-- Staff attendance: signing in on the premises
-- ══════════════════════════════════════
-- Where the school is, so a teacher's sign-in can be checked against it.
-- Set by an admin standing on the premises ("use my current location") or
-- typed in from a map. Null until then, and signing in is refused until it
-- is set — there is nothing to check a location against.
alter table schools add column if not exists latitude double precision;
alter table schools add column if not exists longitude double precision;
-- How far from that point still counts as "on the premises", in metres.
alter table schools add column if not exists geofence_radius_m int not null default 150;
-- When staff are due in, in the school's own time zone, and how many
-- minutes after that a sign-in still counts as on time.
alter table schools add column if not exists staff_start_time time not null default '09:00';
alter table schools add column if not exists staff_late_grace_minutes int not null default 5;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'schools_location_valid') then
    alter table schools add constraint schools_location_valid check (
      (latitude is null and longitude is null)
      or (latitude between -90 and 90 and longitude between -180 and 180)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'schools_geofence_radius_valid') then
    alter table schools add constraint schools_geofence_radius_valid
      check (geofence_radius_m between 25 and 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'schools_late_grace_valid') then
    alter table schools add constraint schools_late_grace_valid
      check (staff_late_grace_minutes between 0 and 120);
  end if;
end $$;

-- One row per teacher per day they signed in. A day with no row is an
-- absence — worked out when the register is read, against the school
-- calendar and any absence the teacher reported, not stored.
--
-- Nobody can write these rows from the browser, teachers included: there
-- is deliberately no insert or update policy below. Every sign-in goes
-- through /api/staff-attendance, which checks the teacher is on the
-- premises before the server writes the row. If teachers could insert
-- their own rows directly, the location check would be a suggestion.
--
-- The teacher's own coordinates are not kept — only how far from the
-- school they were and how precise their phone said the fix was, which is
-- all a disputed sign-in ever needs.
create table if not exists staff_attendance (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references schools(id) on delete cascade,
  teacher_id          uuid not null references profiles(id) on delete cascade,
  work_date           date not null,
  signed_in_at        timestamptz,
  signed_out_at       timestamptz,
  sign_in_distance_m  int,
  sign_in_accuracy_m  int,
  sign_out_distance_m int,
  sign_out_accuracy_m int,
  -- The office's correction for a day the sign-in could not happen as it
  -- should (a phone with no location, a forgotten sign-out). Wins over
  -- whatever the sign-in times alone would say.
  override_status     text check (override_status in ('present', 'late', 'absent', 'excused')),
  override_note       text check (char_length(override_note) <= 500),
  override_by         uuid references profiles(id) on delete set null,
  created_at          timestamptz default now(),
  constraint staff_attendance_one_per_day unique (teacher_id, work_date)
);
alter table staff_attendance enable row level security;

drop policy if exists "Teachers can read own staff attendance" on staff_attendance;
create policy "Teachers can read own staff attendance" on staff_attendance
  for select using (teacher_id = auth.uid());
drop policy if exists "Admins can read staff attendance in their school" on staff_attendance;
create policy "Admins can read staff attendance in their school" on staff_attendance
  for select using (school_id = my_school_id() and my_role() = 'admin');

create index if not exists idx_staff_attendance_school_date
  on staff_attendance(school_id, work_date);

-- A teacher telling the office ahead of time (or on the morning) that they
-- will not be in. A day covered by one reads as a reported absence rather
-- than a no-show. Written through /api/staff-absence, which also lets the
-- office know.
create table if not exists staff_absence_reports (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  teacher_id    uuid not null references profiles(id) on delete cascade,
  from_date     date not null,
  to_date       date not null,
  reason        text not null check (reason in ('sick', 'family', 'travel', 'other')),
  note          text check (char_length(note) <= 500),
  cancelled_at  timestamptz,
  created_at    timestamptz default now(),
  constraint staff_absence_reports_range check (to_date >= from_date and to_date - from_date <= 60)
);
alter table staff_absence_reports enable row level security;

drop policy if exists "Teachers can read own absence reports" on staff_absence_reports;
create policy "Teachers can read own absence reports" on staff_absence_reports
  for select using (teacher_id = auth.uid());
drop policy if exists "Admins can read absence reports in their school" on staff_absence_reports;
create policy "Admins can read absence reports in their school" on staff_absence_reports
  for select using (school_id = my_school_id() and my_role() = 'admin');

create index if not exists idx_staff_absence_reports_school
  on staff_absence_reports(school_id, from_date);

-- ══════════════════════════════════════
-- Notifications
-- ══════════════════════════════════════
-- Notices the portal raises on its own — a child absent five school days
-- in a row, a teacher reporting an absence — shown to whoever they are for
-- until they dismiss them. Written only by the server; a recipient can
-- read their own and mark them read.
--
-- dedupe_key stops the same event notifying the same person twice: one
-- run of absences is one notice, however many more days it goes on.
create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  recipient_id  uuid not null references profiles(id) on delete cascade,
  student_id    uuid references students(id) on delete cascade,
  kind          text not null check (kind in ('absence_streak', 'staff_absence_report')),
  title         text not null,
  body          text not null,
  dedupe_key    text,
  read_at       timestamptz,
  created_at    timestamptz default now(),
  constraint notifications_once unique (recipient_id, dedupe_key)
);
alter table notifications enable row level security;

drop policy if exists "Recipients can read own notifications" on notifications;
create policy "Recipients can read own notifications" on notifications
  for select using (recipient_id = auth.uid());
drop policy if exists "Recipients can mark own notifications read" on notifications;
create policy "Recipients can mark own notifications read" on notifications
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create index if not exists idx_notifications_recipient
  on notifications(recipient_id, created_at desc);

-- ── Deleting your own account ─────────────────────────────────────────
-- The app stores require that people can delete their account from inside
-- the app. Deleting a teacher's or parent's account removes their login and
-- their profile, but what they recorded about students — attendance they
-- took, lessons they set and graded, yearly plans, messages in a child's
-- thread — belongs to the school and stays. Those references become null
-- rather than blocking the delete (most had no ON DELETE rule, so it simply
-- failed) or taking the students' records with it (quranic_assignments and
-- yearly_plans cascaded, so one departing teacher would have wiped every
-- lesson and plan they had set). The screens already fall back to "Teacher",
-- "Parent" or "School office" where a name is gone.
do $$
declare
  r record;
  c text;
begin
  for r in
    select * from (values
      ('students', 'profile_id'),
      ('classes', 'teacher_id'),
      ('lessons', 'teacher_id'),
      ('assignments', 'teacher_id'),
      ('quranic_assignments', 'teacher_id'),
      ('surah_test_confirmations', 'teacher_id'),
      ('attendance', 'teacher_id'),
      ('subject_grades', 'teacher_id'),
      ('announcements', 'author_id'),
      ('messages', 'author_id'),
      ('recitation_log', 'teacher_id'),
      ('student_stars', 'teacher_id'),
      ('student_badges', 'teacher_id'),
      ('yearly_plans', 'teacher_id'),
      ('yearly_plan_progress', 'teacher_id')
    ) as t(tbl, col)
  loop
    if to_regclass('public.' || r.tbl) is null then
      continue;
    end if;
    for c in
      select con.conname
      from pg_constraint con
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
      where con.contype = 'f'
        and con.conrelid = ('public.' || r.tbl)::regclass
        and con.confrelid = 'public.profiles'::regclass
        and att.attname = r.col
    loop
      execute format('alter table public.%I drop constraint %I', r.tbl, c);
    end loop;
    execute format('alter table public.%I alter column %I drop not null', r.tbl, r.col);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
      r.tbl, r.tbl || '_' || r.col || '_fkey', r.col
    );
  end loop;
end $$;

-- The school office is told when someone deletes their account, and when a
-- student asks for theirs to be deleted (a child's account is the school's
-- to remove).
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('absence_streak', 'staff_absence_report', 'account_deleted', 'deletion_request'));

-- ══════════════════════════════════════
-- Islamic Studies & Arabic assignments
-- ══════════════════════════════════════
-- Work a teacher or the office sets outside the Qur'an: written answers and
-- multiple-choice questions that a child answers in their own portal, the
-- teacher marks, and the child's parents can follow.
--
-- Three tables, because a child must never be able to read the right
-- answers: the questions live on the assignment, which children can read;
-- the right option of each multiple-choice question lives in its key,
-- which only staff can. A child's copy of the work — their answers, marks,
-- score and the teacher's comment — is their submission row, created for
-- each child the work is set for.
--
-- Children and parents only ever read here. A child hands work in through
-- /api/class-work/[id]/submit, which checks it is theirs and still open and
-- then writes it with the service role: an update policy of their own would
-- let them write their score too.
create table if not exists subject_assignments (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  subject       text not null check (subject in ('islamic_studies', 'arabic')),
  title         text not null,
  instructions  text not null default '',
  -- [{ id, kind: 'written' | 'choice', prompt, options?, points }], in order.
  questions     jsonb not null default '[]'::jsonb,
  max_points    int not null check (max_points > 0),
  due_date      date,
  -- Null once the teacher who set it deletes their account: the work and
  -- the children's answers belong to the school and stay.
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table subject_assignments enable row level security;
create index if not exists idx_subject_assignments_school
  on subject_assignments(school_id, created_at desc);

create table if not exists subject_assignment_keys (
  assignment_id uuid primary key references subject_assignments(id) on delete cascade,
  school_id     uuid not null references schools(id) on delete cascade,
  -- { questionId: index of the right option }, one per multiple-choice question.
  answers       jsonb not null default '{}'::jsonb
);
alter table subject_assignment_keys enable row level security;

create table if not exists subject_submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references subject_assignments(id) on delete cascade,
  student_id     uuid not null references students(id) on delete cascade,
  school_id      uuid not null references schools(id) on delete cascade,
  status         text not null default 'assigned' check (status in ('assigned', 'submitted', 'graded')),
  -- { questionId: written text, or the index of the option picked }
  answers        jsonb not null default '{}'::jsonb,
  -- { questionId: points given }
  marks          jsonb not null default '{}'::jsonb,
  score          numeric(7,2),
  feedback       text,
  submitted_at   timestamptz,
  graded_by      uuid references profiles(id) on delete set null,
  graded_at      timestamptz,
  updated_at     timestamptz not null default now(),
  constraint subject_submissions_one_per_student unique (assignment_id, student_id)
);
alter table subject_submissions enable row level security;
create index if not exists idx_subject_submissions_student on subject_submissions(student_id);

-- Definer functions for the questions these tables' policies ask of each
-- other — the same reason as my_children_student_ids() above: written as
-- plain subqueries, assignments asking submissions "is this child's?" while
-- submissions ask assignments "is this teacher's?" recurse forever (42P17).
create or replace function manages_subject_assignment(aid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from subject_assignments a
    where a.id = aid
      and a.school_id = my_school_id()
      and (my_role() = 'admin' or (my_role() = 'teacher' and a.created_by = auth.uid()))
  )
$$;

create or replace function my_subject_assignment_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$
  select ss.assignment_id
  from subject_submissions ss
  join students s on s.id = ss.student_id
  where s.profile_id = auth.uid()
$$;

create or replace function my_childrens_subject_assignment_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$
  select ss.assignment_id
  from subject_submissions ss
  join parent_students ps on ps.student_id = ss.student_id
  where ps.parent_id = auth.uid()
$$;

-- A teacher manages the work they set; the office manages all of the school's.
drop policy if exists "Staff manage subject assignments" on subject_assignments;
create policy "Staff manage subject assignments" on subject_assignments
  for all using (
    school_id = my_school_id()
    and (my_role() = 'admin' or (my_role() = 'teacher' and created_by = auth.uid()))
  ) with check (
    school_id = my_school_id()
    and (my_role() = 'admin' or (my_role() = 'teacher' and created_by = auth.uid()))
  );
drop policy if exists "Students read their subject assignments" on subject_assignments;
create policy "Students read their subject assignments" on subject_assignments
  for select using (id in (select my_subject_assignment_ids()));
drop policy if exists "Parents read their children's subject assignments" on subject_assignments;
create policy "Parents read their children's subject assignments" on subject_assignments
  for select using (id in (select my_childrens_subject_assignment_ids()));

drop policy if exists "Staff manage answer keys" on subject_assignment_keys;
create policy "Staff manage answer keys" on subject_assignment_keys
  for all using (manages_subject_assignment(assignment_id))
  with check (manages_subject_assignment(assignment_id));

drop policy if exists "Staff manage subject submissions" on subject_submissions;
create policy "Staff manage subject submissions" on subject_submissions
  for all using (manages_subject_assignment(assignment_id))
  with check (manages_subject_assignment(assignment_id) and school_id = my_school_id());
drop policy if exists "Students read own subject submissions" on subject_submissions;
create policy "Students read own subject submissions" on subject_submissions
  for select using (student_id in (select id from students where profile_id = auth.uid()));
drop policy if exists "Parents read children's subject submissions" on subject_submissions;
create policy "Parents read children's subject submissions" on subject_submissions
  for select using (student_id in (select my_children_student_ids()));
