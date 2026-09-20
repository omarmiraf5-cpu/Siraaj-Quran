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
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quranic_assignments_surah_end_check'
  ) then
    alter table quranic_assignments
      add constraint quranic_assignments_surah_end_check
      check (surah_end between surah and 114);
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
