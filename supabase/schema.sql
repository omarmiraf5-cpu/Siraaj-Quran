-- MyDiiwaan School Portal — Supabase Schema
-- Run this in the Supabase SQL editor to set up the database

-- Enable RLS globally
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- ══════════════════════════════════════
-- Schools
-- ══════════════════════════════════════
create table if not exists schools (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
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
create policy "Authenticated users can read their school" on schools
  for select using (
    id in (select school_id from profiles where id = auth.uid())
  );
create policy "Admins can update own school" on schools
  for update using (
    id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );

-- ══════════════════════════════════════
-- Profiles (extends auth.users)
-- ══════════════════════════════════════
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin', 'teacher', 'parent', 'student')),
  full_name   text not null,
  email       text,
  phone       text,
  school_id   uuid not null references schools(id) on delete cascade,
  avatar_url  text,
  active      boolean not null default true,
  created_at  timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can read own profile" on profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);
create policy "Admins can read all school profiles" on profiles
  for select using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Admins can insert profiles in their school" on profiles
  for insert with check (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Admins can update profiles in their school" on profiles
  for update using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, role, full_name, email, school_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'parent'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    (new.raw_user_meta_data->>'school_id')::uuid
  );
  return new;
end;
$$ language plpgsql security definer;

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
  created_at      timestamptz default now()
);
alter table students enable row level security;
create policy "Admins and teachers can read students in their school" on students
  for select using (
    school_id in (select school_id from profiles where id = auth.uid() and role in ('admin', 'teacher'))
  );
create policy "Parents can read own children" on students
  for select using (
    id in (select student_id from parent_students where parent_id = auth.uid())
  );
create policy "Student can read own record" on students
  for select using (profile_id = auth.uid());
create policy "Admins can manage students" on students
  for all using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );

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
create policy "Parents can read own links" on parent_students
  for select using (parent_id = auth.uid());
create policy "Admins can manage parent links" on parent_students
  for all using (
    exists (
      select 1 from students s
      join profiles p on p.school_id = s.school_id
      where s.id = parent_students.student_id and p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ══════════════════════════════════════
-- Classes
-- ══════════════════════════════════════
create table if not exists classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  subject     text not null,
  grade       int not null check (grade between 0 and 10),
  section     text,
  teacher_id  uuid not null references profiles(id),
  school_id   uuid not null references schools(id) on delete cascade,
  school_year text not null default '2026-2027',
  active      boolean not null default true,
  created_at  timestamptz default now()
);
alter table classes enable row level security;
create policy "Teachers can read own classes" on classes
  for select using (teacher_id = auth.uid());
create policy "Admins can manage all classes" on classes
  for all using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Students can read enrolled classes" on classes
  for select using (
    id in (
      select class_id from class_enrollments ce
      join students s on s.id = ce.student_id
      where s.profile_id = auth.uid()
    )
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
create policy "Teachers can read enrollments for own classes" on class_enrollments
  for select using (
    class_id in (select id from classes where teacher_id = auth.uid())
  );
create policy "Admins can manage enrollments" on class_enrollments
  for all using (
    exists (
      select 1 from classes c
      join profiles p on p.school_id = c.school_id
      where c.id = class_enrollments.class_id and p.id = auth.uid() and p.role = 'admin'
    )
  );

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
create policy "School members can read published lessons" on lessons
  for select using (
    published_at is not null and
    school_id in (select school_id from profiles where id = auth.uid())
  );
create policy "Teachers can manage own lessons" on lessons
  for all using (teacher_id = auth.uid());
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
create policy "School members can read assignments" on assignments
  for select using (
    school_id in (select school_id from profiles where id = auth.uid())
  );
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
  ayah_end             int not null check (ayah_end >= ayah_start),
  assigned_at          timestamptz default now(),
  due_date             date,
  status               text not null default 'assigned' check (status in ('assigned', 'in_progress', 'completed', 'needs_review')),
  memorization_level   int not null default 0 check (memorization_level between 0 and 100),
  teacher_notes        text,
  student_notes        text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);
alter table quranic_assignments enable row level security;
create policy "Teachers can manage own quranic assignments" on quranic_assignments
  for all using (teacher_id = auth.uid());
create policy "Students can read own quranic assignments" on quranic_assignments
  for select using (
    student_id in (select id from students where profile_id = auth.uid())
  );
create policy "Parents can read children quranic assignments" on quranic_assignments
  for select using (
    student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );
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
create policy "Teachers can manage submissions for own assignments" on submissions
  for all using (
    assignment_id in (select id from assignments where teacher_id = auth.uid())
  );
create policy "Students can read own submissions" on submissions
  for select using (
    student_id in (select id from students where profile_id = auth.uid())
  );
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
  status      text not null check (status in ('present', 'late', 'absent')),
  notes       text,
  teacher_id  uuid not null references profiles(id),
  school_id   uuid not null references schools(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (student_id, class_id, class_date)
);
alter table attendance enable row level security;
create policy "Teachers can manage attendance for own classes" on attendance
  for all using (teacher_id = auth.uid());
create policy "Admins can read all attendance" on attendance
  for select using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Parents can read children attendance" on attendance
  for select using (
    student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );
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
create policy "Admins can manage fees" on fees
  for all using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );
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
create policy "Teachers can manage grades" on subject_grades
  for all using (teacher_id = auth.uid());
create policy "Admins can read all grades" on subject_grades
  for select using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Parents can read own children grades" on subject_grades
  for select using (
    student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );
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
create policy "School members can read announcements" on announcements
  for select using (
    school_id in (select school_id from profiles where id = auth.uid())
  );
create policy "Admins can manage announcements" on announcements
  for all using (
    school_id in (select school_id from profiles where id = auth.uid() and role = 'admin')
  );

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
