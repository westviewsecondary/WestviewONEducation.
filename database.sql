-- OneEducation MIS database
-- Run this entire file once in Supabase SQL Editor.
-- Designed for the flat-file OneEducation GitHub build.

create extension if not exists pgcrypto;

-- ---------- Core identity / permissions ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'teacher' check (role in ('admin','teacher','exam_officer','pastoral','cover_manager')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name,role)
  values(
    new.id,
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''),'@',1)),
    case when lower(coalesce(new.email,''))='masonsandersbussiness@gmail.com' then 'admin' else 'teacher' end
  )
  on conflict (id) do update set email=excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.staff_role()
returns text language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid()
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid())
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin')
$$;

-- ---------- School structure ----------
create table if not exists public.school_settings (
  id int primary key default 1 check (id=1),
  school_name text not null default 'OneEducation Academy',
  school_status text not null default 'open' check (school_status in ('open','closing','closed')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.school_settings(id) values(1) on conflict do nothing;

create table if not exists public.houses (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  sort_order int not null default 0
);

create table if not exists public.tutor_groups (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  year_group int not null check (year_group between 7 and 11),
  tutor_name text,
  room text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  code text unique not null,
  category text not null default 'gcse' check (category in ('core','gcse','other')),
  active boolean not null default true
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  building text not null,
  capacity int not null default 30,
  type text not null default 'Classroom',
  active boolean not null default true
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  year_group int not null check (year_group between 7 and 11),
  tutor_group_id uuid references public.tutor_groups(id) on delete set null,
  house_id uuid references public.houses(id) on delete set null,
  candidate_number text unique not null,
  portal_code_hash text unique not null,
  status text not null default 'active' check (status in ('active','left','suspended')),
  created_at timestamptz not null default now()
);
create index if not exists students_name_idx on public.students(last_name,first_name);
create index if not exists students_tutor_idx on public.students(tutor_group_id);

create table if not exists public.class_groups (
  id uuid primary key default gen_random_uuid(),
  display_name text unique not null,
  subject text not null,
  subject_code text not null,
  subject_type text not null default 'gcse' check(subject_type in ('core','gcse','other')),
  year_group int not null check(year_group between 7 and 11),
  set_number int not null default 1,
  room_code text,
  teacher_name text,
  student_count int not null default 0,
  created_at timestamptz not null default now(),
  unique(year_group,subject,set_number)
);

create table if not exists public.class_memberships (
  student_id uuid not null references public.students(id) on delete cascade,
  class_group_id uuid not null references public.class_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(student_id,class_group_id)
);

create table if not exists public.student_timetable (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  day_of_week int not null check(day_of_week between 1 and 5),
  period int not null check(period between 1 and 5),
  class_id uuid references public.class_groups(id) on delete set null,
  class_name text,
  subject text,
  room_code text,
  unique(student_id,day_of_week,period)
);

-- ---------- Attendance ----------
create table if not exists public.attendance_marks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.class_groups(id) on delete cascade,
  attendance_date date not null,
  period int not null check(period between 1 and 5),
  mark text not null check(mark in ('present','absent','late')),
  reason text,
  notes text,
  recorded_by uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  unique(student_id,class_id,attendance_date,period)
);

-- ---------- Behaviour / rewards ----------
create table if not exists public.behaviour_reasons (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  points int not null check(points >= 0),
  active boolean not null default true
);

create table if not exists public.behaviour_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  reason_id uuid references public.behaviour_reasons(id),
  reason text not null,
  points int not null default 0,
  period int check(period between 1 and 5),
  notes text,
  removal boolean not null default false,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_restrictions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  restriction_date date not null default current_date,
  period int not null check(period between 1 and 5),
  label text not null default 'Scheduled to be out of lesson',
  source_behaviour_event uuid references public.behaviour_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(student_id,restriction_date,period)
);

create table if not exists public.house_points (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  points int not null check(points > 0),
  reason text not null,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------- Communities ----------
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  type text not null check(type in ('tutor','class')),
  ref_id uuid not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique(type,ref_id)
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null default 'Announcement',
  body text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------- Emergencies ----------
create table if not exists public.emergency_alerts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  type text not null,
  severity text not null default 'medium' check(severity in ('low','medium','high')),
  status text not null default 'open' check(status in ('open','monitoring','resolved')),
  details text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------- Exams ----------
create table if not exists public.exam_windows (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  exam_type text not null check(exam_type in ('Mock 1','Mock 2','Mock 3','GCSE')),
  year_group int not null check(year_group between 10 and 11),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check(end_date >= start_date),
  check(not (exam_type='Mock 1' and year_group<>10))
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  exam_window_id uuid references public.exam_windows(id) on delete cascade,
  exam_type text not null check(exam_type in ('Mock 1','Mock 2','Mock 3','GCSE')),
  subject text not null,
  paper text not null,
  exam_date date not null,
  start_time time not null,
  duration_minutes int not null default 90 check(duration_minutes > 0),
  board text,
  room_code text default 'HALL',
  official boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_class_links (
  exam_id uuid not null references public.exams(id) on delete cascade,
  class_id uuid not null references public.class_groups(id) on delete cascade,
  primary key(exam_id,class_id)
);

-- ---------- Cover ----------
create table if not exists public.cover_arrangements (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  period int not null check(period between 1 and 5),
  class_id uuid references public.class_groups(id) on delete set null,
  class_name text,
  absent_teacher text not null,
  cover_teacher text,
  room_code text,
  status text not null default 'Open' check(status in ('Open','Assigned','Completed','Cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------- Calendar ----------
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  end_date date,
  category text not null default 'school',
  details text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------- Helpers ----------
create or replace function public.sync_class_counts()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.class_groups cg
  set student_count=(select count(*) from public.class_memberships cm where cm.class_group_id=cg.id)
  where cg.id=coalesce(new.class_group_id,old.class_group_id);
  return coalesce(new,old);
end $$;
drop trigger if exists class_membership_count_trg on public.class_memberships;
create trigger class_membership_count_trg after insert or delete on public.class_memberships
for each row execute function public.sync_class_counts();

create or replace function public.make_portal_code()
returns text language sql volatile as $$
  select 'OE-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,4)) || '-' ||
         upper(substr(encode(gen_random_bytes(6),'hex'),1,4))
$$;

create or replace function public.make_candidate_number()
returns text language plpgsql volatile as $$
declare n text;
begin
  loop
    n := lpad((1000 + floor(random()*9000))::int::text,4,'0');
    exit when not exists(select 1 from public.students where candidate_number=n);
  end loop;
  return n;
end $$;

create or replace function public.generate_student_timetable(p_student_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  classes uuid[];
  c uuid;
  d int;
  p int;
  info record;
begin
  delete from public.student_timetable where student_id=p_student_id;
  select array_agg(class_group_id order by random()) into classes
  from public.class_memberships where student_id=p_student_id;
  if classes is null or array_length(classes,1)=0 then return; end if;

  for d in 1..5 loop
    for p in 1..5 loop
      c := classes[1 + floor(random()*array_length(classes,1))::int];
      select display_name,subject,room_code into info from public.class_groups where id=c;
      insert into public.student_timetable(student_id,day_of_week,period,class_id,class_name,subject,room_code)
      values(p_student_id,d,p,c,info.display_name,info.subject,info.room_code);
    end loop;
  end loop;
end $$;

create or replace function public.import_student(
  p_first_name text,
  p_last_name text,
  p_year_group int,
  p_tutor_group_id uuid
) returns table(
  student_id uuid,
  full_name text,
  portal_code text,
  candidate_number text,
  house_name text,
  tutor_code text
) language plpgsql security definer set search_path=public as $$
declare
  v_student uuid;
  v_code text;
  v_candidate text;
  v_house uuid;
  v_house_name text;
  v_tutor_code text;
  r record;
begin
  if not public.is_staff() then raise exception 'Staff login required'; end if;
  if p_year_group not between 7 and 11 then raise exception 'Invalid year group'; end if;
  select code into v_tutor_code from public.tutor_groups where id=p_tutor_group_id and year_group=p_year_group;
  if v_tutor_code is null then raise exception 'Tutor group does not belong to Year %', p_year_group; end if;

  select h.id,h.name into v_house,v_house_name from public.houses h order by random() limit 1;
  if v_house is null then raise exception 'No houses configured'; end if;

  loop
    v_code := public.make_portal_code();
    exit when not exists(select 1 from public.students where portal_code_hash=encode(digest(v_code,'sha256'),'hex'));
  end loop;
  v_candidate := public.make_candidate_number();

  insert into public.students(first_name,last_name,year_group,tutor_group_id,house_id,candidate_number,portal_code_hash)
  values(trim(p_first_name),trim(p_last_name),p_year_group,p_tutor_group_id,v_house,v_candidate,encode(digest(v_code,'sha256'),'hex'))
  returning id into v_student;

  -- One class per core subject.
  for r in
    select distinct on(subject) id
    from public.class_groups
    where year_group=p_year_group and subject_type='core'
    order by subject,random()
  loop
    insert into public.class_memberships(student_id,class_group_id) values(v_student,r.id) on conflict do nothing;
  end loop;

  -- Four different GCSE option subjects where available.
  for r in
    select id from (
      select distinct on(subject) id,subject
      from public.class_groups
      where year_group=p_year_group and subject_type='gcse'
      order by subject,random()
    ) q order by random() limit 4
  loop
    insert into public.class_memberships(student_id,class_group_id) values(v_student,r.id) on conflict do nothing;
  end loop;

  perform public.generate_student_timetable(v_student);

  -- Ensure tutor/class communities exist.
  insert into public.communities(type,ref_id,name)
  values('tutor',p_tutor_group_id,v_tutor_code || ' Community') on conflict(type,ref_id) do nothing;
  insert into public.communities(type,ref_id,name)
  select 'class',cg.id,cg.display_name from public.class_groups cg
  join public.class_memberships cm on cm.class_group_id=cg.id
  where cm.student_id=v_student
  on conflict(type,ref_id) do nothing;

  return query select v_student,trim(p_first_name)||' '||trim(p_last_name),v_code,v_candidate,v_house_name,v_tutor_code;
end $$;

create or replace function public.get_class_register(p_class_id uuid,p_date date,p_period int)
returns table(
  student_id uuid,first_name text,last_name text,tutor_code text,
  existing_mark text,existing_reason text,existing_notes text
) language sql security definer set search_path=public as $$
  select s.id,s.first_name,s.last_name,tg.code,am.mark,am.reason,am.notes
  from public.class_memberships cm
  join public.students s on s.id=cm.student_id
  left join public.tutor_groups tg on tg.id=s.tutor_group_id
  left join public.attendance_marks am on am.student_id=s.id and am.class_id=p_class_id
    and am.attendance_date=p_date and am.period=p_period
  where cm.class_group_id=p_class_id and s.status='active'
  and public.is_staff()
  order by s.last_name,s.first_name
$$;

create or replace function public.record_attendance_mark(
  p_student_id uuid,p_class_id uuid,p_attendance_date date,p_period int,
  p_mark text,p_reason text default null,p_notes text default null
) returns void language plpgsql security definer set search_path=public as $$
declare v_status text;
begin
  if not public.is_staff() then raise exception 'Staff login required'; end if;
  select school_status into v_status from public.school_settings where id=1;
  if v_status <> 'open' then raise exception 'Attendance is locked because school status is %', v_status; end if;
  if p_mark not in ('present','absent','late') then raise exception 'Invalid attendance mark'; end if;

  insert into public.attendance_marks(student_id,class_id,attendance_date,period,mark,reason,notes,recorded_by)
  values(p_student_id,p_class_id,p_attendance_date,p_period,p_mark,p_reason,p_notes,auth.uid())
  on conflict(student_id,class_id,attendance_date,period) do update
  set mark=excluded.mark,reason=excluded.reason,notes=excluded.notes,recorded_by=auth.uid(),recorded_at=now();
end $$;

create or replace function public.record_behaviour(
  p_student_id uuid,p_reason_id uuid,p_period int,p_notes text default null,p_removal boolean default false
) returns uuid language plpgsql security definer set search_path=public as $$
declare r record; v_event uuid;
begin
  if not public.is_staff() then raise exception 'Staff login required'; end if;
  select name,points into r from public.behaviour_reasons where id=p_reason_id and active=true;
  if r.name is null then raise exception 'Behaviour reason not found'; end if;

  insert into public.behaviour_events(student_id,reason_id,reason,points,period,notes,removal,recorded_by)
  values(p_student_id,p_reason_id,r.name,r.points,p_period,p_notes,p_removal,auth.uid())
  returning id into v_event;

  -- Removal: schedule next lesson only for P1-P3.
  -- P4 must NOT create P5 restriction because lunch (13:20-14:00) breaks the sequence.
  if p_removal and p_period between 1 and 3 then
    insert into public.lesson_restrictions(student_id,restriction_date,period,label,source_behaviour_event)
    values(p_student_id,current_date,p_period+1,'Scheduled to be out of lesson',v_event)
    on conflict(student_id,restriction_date,period) do update
    set label=excluded.label,source_behaviour_event=excluded.source_behaviour_event;
  end if;
  return v_event;
end $$;

create or replace function public.set_school_status(p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_status not in ('open','closing','closed') then raise exception 'Invalid school status'; end if;
  update public.school_settings set school_status=p_status,updated_at=now(),updated_by=auth.uid() where id=1;
end $$;

create or replace function public.create_class_batch(
  p_year_group int,p_set_count int,p_mode text,p_single_subject text default null
) returns int language plpgsql security definer set search_path=public as $$
declare s record; n int; v_count int; v_suffix text; made int:=0;
begin
  if not public.is_staff() then raise exception 'Staff login required'; end if;
  if p_year_group not between 7 and 11 then raise exception 'Invalid year group'; end if;
  if p_set_count not between 1 and 10 then raise exception 'Set count must be 1-10'; end if;

  for s in
    select * from public.subjects
    where active=true and (
      p_mode='all' or
      (p_mode='core' and category='core') or
      (p_mode='gcse' and category='gcse') or
      (p_mode='single' and name=p_single_subject)
    )
    order by category,name
  loop
    v_count := case when s.category='core' then p_set_count when s.name in ('History','Geography') then 2 else 1 end;
    for n in 1..v_count loop
      v_suffix := case when s.category<>'core' and s.name in ('History','Geography') then case when n=1 then 'A' else 'B' end else n::text end;
      insert into public.class_groups(display_name,subject,subject_code,subject_type,year_group,set_number,room_code)
      values(
        p_year_group::text||s.code||v_suffix||' '||s.name,
        s.name,s.code,s.category,p_year_group,n,
        case
          when s.name in ('English','History','Geography') then 'A'||lpad((((n*3)%6)+1)::text,2,'0')
          when s.name='Mathematics' then 'B'||lpad((((n*3)%6)+1)::text,2,'0')
          when s.name in ('Combined Science','Biology','Chemistry','Physics') then 'C'||lpad((((n*3)%6)+1)::text,2,'0')
          when s.name in ('French','German','Spanish') then 'D'||lpad((((n*3)%6)+1)::text,2,'0')
          when s.name in ('Art & Design','3D Design','Music','Drama') then 'E'||lpad((((n*3)%6)+1)::text,2,'0')
          when s.name in ('Food Preparation & Nutrition','Design & Technology') then 'F'||lpad((((n*3)%6)+1)::text,2,'0')
          when s.name in ('Computer Science','Business','Film Studies') then 'G'||lpad((((n*3)%6)+1)::text,2,'0')
          when s.name='GCSE PE' then 'P01-GYM'
          else 'H'||lpad((((n*3)%6)+1)::text,2,'0')
        end
      ) on conflict(year_group,subject,set_number) do nothing;
      if found then made:=made+1; end if;
    end loop;
  end loop;

  insert into public.communities(type,ref_id,name)
  select 'class',id,display_name from public.class_groups where year_group=p_year_group
  on conflict(type,ref_id) do nothing;
  return made;
end $$;

create or replace function public.create_exam_window_and_schedule(
  p_start_date date,p_end_date date,p_exam_type text,p_year_group int
) returns uuid language plpgsql security definer set search_path=public as $$
declare w uuid; s record; i int:=0; exam_id uuid; exam_day date; slot time;
begin
  if not public.is_staff() then raise exception 'Staff login required'; end if;
  if p_exam_type='Mock 1' and p_year_group<>10 then raise exception 'Mock 1 is Year 10 only'; end if;
  if p_exam_type not in ('Mock 1','Mock 2','Mock 3','GCSE') then raise exception 'Invalid exam type'; end if;
  if p_end_date<p_start_date then raise exception 'End date is before start date'; end if;

  insert into public.exam_windows(start_date,end_date,exam_type,year_group,created_by)
  values(p_start_date,p_end_date,p_exam_type,p_year_group,auth.uid()) returning id into w;

  -- GCSE dates are imported from an official CSV, not auto-generated.
  if p_exam_type='GCSE' then return w; end if;

  for s in
    select distinct subject from public.class_groups where year_group=p_year_group order by subject
  loop
    exam_day := p_start_date + ((i/2) % greatest(1,(p_end_date-p_start_date+1)))::int;
    slot := case when i%2=0 then time '09:00' else time '13:30' end;
    insert into public.exams(exam_window_id,exam_type,subject,paper,exam_date,start_time,duration_minutes,room_code,official)
    values(w,p_exam_type,s.subject,s.subject||' '||p_exam_type,exam_day,slot,90,'HALL',false)
    returning id into exam_id;

    insert into public.exam_class_links(exam_id,class_id)
    select exam_id,id from public.class_groups where year_group=p_year_group and subject=s.subject;

    insert into public.community_posts(community_id,title,body,created_by)
    select c.id,p_exam_type||' exam published',
      s.subject||' exam: '||to_char(exam_day,'Dy DD Mon YYYY')||' at '||to_char(slot,'HH24:MI'),
      auth.uid()
    from public.communities c
    join public.class_groups cg on c.type='class' and c.ref_id=cg.id
    where cg.year_group=p_year_group and cg.subject=s.subject;
    i:=i+1;
  end loop;
  return w;
end $$;

create or replace function public.import_official_gcse_exam(
  p_subject text,p_paper text,p_exam_date date,p_start_time time,p_duration_minutes int,p_board text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare w uuid; e uuid;
begin
  if public.staff_role() not in ('admin','exam_officer') then raise exception 'Admin or Exam Officer access required'; end if;
  select id into w from public.exam_windows
  where exam_type='GCSE' and year_group=11 and p_exam_date between start_date and end_date
  order by start_date desc limit 1;
  if w is null then raise exception 'Create a Year 11 GCSE exam window covering % first',p_exam_date; end if;
  if not exists(select 1 from public.subjects where lower(name)=lower(trim(p_subject))) then
    raise exception 'Unknown subject: %',p_subject;
  end if;

  insert into public.exams(exam_window_id,exam_type,subject,paper,exam_date,start_time,duration_minutes,board,room_code,official)
  values(w,'GCSE',trim(p_subject),trim(p_paper),p_exam_date,p_start_time,p_duration_minutes,p_board,'HALL',true)
  returning id into e;

  insert into public.exam_class_links(exam_id,class_id)
  select e,id from public.class_groups where year_group=11 and lower(subject)=lower(trim(p_subject));

  insert into public.community_posts(community_id,title,body,created_by)
  select c.id,'Official GCSE exam',
    trim(p_paper)||': '||to_char(p_exam_date,'Dy DD Mon YYYY')||' at '||to_char(p_start_time,'HH24:MI'),
    auth.uid()
  from public.communities c
  join public.class_groups cg on c.type='class' and c.ref_id=cg.id
  where cg.year_group=11 and lower(cg.subject)=lower(trim(p_subject));
  return e;
end $$;

create or replace function public.student_portal_snapshot(p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s record; result jsonb;
begin
  select st.*,tg.code tutor_code,h.name house_name into s
  from public.students st
  left join public.tutor_groups tg on tg.id=st.tutor_group_id
  left join public.houses h on h.id=st.house_id
  where st.portal_code_hash=encode(digest(trim(p_code),'sha256'),'hex')
  and st.status='active'
  limit 1;
  if s.id is null then return jsonb_build_object('error','Invalid student access code'); end if;

  select jsonb_build_object(
    'student',jsonb_build_object(
      'id',s.id,'first_name',s.first_name,'last_name',s.last_name,'year_group',s.year_group,
      'candidate_number',s.candidate_number,'tutor_code',s.tutor_code,'house_name',s.house_name
    ),
    'classes',coalesce((
      select jsonb_agg(jsonb_build_object('id',cg.id,'display_name',cg.display_name,'subject',cg.subject,'room_code',cg.room_code) order by cg.subject)
      from public.class_memberships cm join public.class_groups cg on cg.id=cm.class_group_id
      where cm.student_id=s.id
    ),'[]'::jsonb),
    'timetable',coalesce((
      select jsonb_agg(to_jsonb(tt) order by tt.day_of_week,tt.period)
      from public.student_timetable tt where tt.student_id=s.id
    ),'[]'::jsonb),
    'notices',coalesce((
      select jsonb_agg(jsonb_build_object('title',cp.title,'body',cp.body,'created_at',cp.created_at) order by cp.created_at desc)
      from public.community_posts cp
      join public.communities c on c.id=cp.community_id
      where (c.type='tutor' and c.ref_id=s.tutor_group_id)
         or (c.type='class' and c.ref_id in (select class_group_id from public.class_memberships where student_id=s.id))
    ),'[]'::jsonb),
    'exams',coalesce((
      select jsonb_agg(jsonb_build_object('id',e.id,'exam_type',e.exam_type,'subject',e.subject,'paper',e.paper,'exam_date',e.exam_date,'start_time',e.start_time,'duration_minutes',e.duration_minutes) order by e.exam_date,e.start_time)
      from public.exams e
      join public.exam_class_links ecl on ecl.exam_id=e.id
      where ecl.class_id in (select class_group_id from public.class_memberships where student_id=s.id)
      and e.exam_date>=current_date
    ),'[]'::jsonb)
  ) into result;
  return result;
end $$;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.school_settings enable row level security;
alter table public.houses enable row level security;
alter table public.tutor_groups enable row level security;
alter table public.subjects enable row level security;
alter table public.rooms enable row level security;
alter table public.students enable row level security;
alter table public.class_groups enable row level security;
alter table public.class_memberships enable row level security;
alter table public.student_timetable enable row level security;
alter table public.attendance_marks enable row level security;
alter table public.behaviour_reasons enable row level security;
alter table public.behaviour_events enable row level security;
alter table public.lesson_restrictions enable row level security;
alter table public.house_points enable row level security;
alter table public.communities enable row level security;
alter table public.community_posts enable row level security;
alter table public.emergency_alerts enable row level security;
alter table public.exam_windows enable row level security;
alter table public.exams enable row level security;
alter table public.exam_class_links enable row level security;
alter table public.cover_arrangements enable row level security;
alter table public.calendar_events enable row level security;

-- Staff can read operational MIS data.
do $$
declare t text;
begin
  foreach t in array array[
    'school_settings','houses','tutor_groups','subjects','rooms','students','class_groups','class_memberships',
    'student_timetable','attendance_marks','behaviour_reasons','behaviour_events','lesson_restrictions',
    'house_points','communities','community_posts','emergency_alerts','exam_windows','exams','exam_class_links',
    'cover_arrangements','calendar_events'
  ]
  loop
    execute format('drop policy if exists staff_read on public.%I',t);
    execute format('create policy staff_read on public.%I for select to authenticated using (public.is_staff())',t);
  end loop;
end $$;

drop policy if exists own_profile on public.profiles;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());

-- General staff write areas.
do $$
declare t text;
begin
  foreach t in array array[
    'tutor_groups','students','class_groups','class_memberships','student_timetable','attendance_marks',
    'behaviour_events','lesson_restrictions','house_points','communities','community_posts',
    'emergency_alerts','cover_arrangements','calendar_events'
  ]
  loop
    execute format('drop policy if exists staff_insert on public.%I',t);
    execute format('drop policy if exists staff_update on public.%I',t);
    execute format('drop policy if exists staff_delete on public.%I',t);
    execute format('create policy staff_insert on public.%I for insert to authenticated with check (public.is_staff())',t);
    execute format('create policy staff_update on public.%I for update to authenticated using (public.is_staff()) with check (public.is_staff())',t);
    execute format('create policy staff_delete on public.%I for delete to authenticated using (public.is_staff())',t);
  end loop;
end $$;

-- Admin / exam staff configuration.
drop policy if exists admin_settings_update on public.school_settings;
create policy admin_settings_update on public.school_settings for update to authenticated using(public.is_admin()) with check(public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['houses','subjects','rooms','behaviour_reasons']
  loop
    execute format('drop policy if exists admin_insert on public.%I',t);
    execute format('drop policy if exists admin_update on public.%I',t);
    execute format('drop policy if exists admin_delete on public.%I',t);
    execute format('create policy admin_insert on public.%I for insert to authenticated with check (public.is_admin())',t);
    execute format('create policy admin_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.is_admin())',t);
  end loop;
end $$;

drop policy if exists exam_insert on public.exam_windows;
create policy exam_insert on public.exam_windows for insert to authenticated with check(public.staff_role() in ('admin','exam_officer'));
drop policy if exists exam_update on public.exam_windows;
create policy exam_update on public.exam_windows for update to authenticated using(public.staff_role() in ('admin','exam_officer')) with check(public.staff_role() in ('admin','exam_officer'));
drop policy if exists exam_delete on public.exam_windows;
create policy exam_delete on public.exam_windows for delete to authenticated using(public.staff_role() in ('admin','exam_officer'));

drop policy if exists exams_insert on public.exams;
create policy exams_insert on public.exams for insert to authenticated with check(public.staff_role() in ('admin','exam_officer'));
drop policy if exists exams_update on public.exams;
create policy exams_update on public.exams for update to authenticated using(public.staff_role() in ('admin','exam_officer')) with check(public.staff_role() in ('admin','exam_officer'));
drop policy if exists exams_delete on public.exams;
create policy exams_delete on public.exams for delete to authenticated using(public.staff_role() in ('admin','exam_officer'));

drop policy if exists ecl_insert on public.exam_class_links;
create policy ecl_insert on public.exam_class_links for insert to authenticated with check(public.staff_role() in ('admin','exam_officer'));
drop policy if exists ecl_delete on public.exam_class_links;
create policy ecl_delete on public.exam_class_links for delete to authenticated using(public.staff_role() in ('admin','exam_officer'));

-- Anonymous users receive no direct table access.
-- Student/parent portal data is available only through the code-validated security-definer snapshot RPC.

-- RPC execution grants.
grant execute on function public.import_student(text,text,int,uuid) to authenticated;
grant execute on function public.get_class_register(uuid,date,int) to authenticated;
grant execute on function public.record_attendance_mark(uuid,uuid,date,int,text,text,text) to authenticated;
grant execute on function public.record_behaviour(uuid,uuid,int,text,boolean) to authenticated;
grant execute on function public.set_school_status(text) to authenticated;
grant execute on function public.create_class_batch(int,int,text,text) to authenticated;
grant execute on function public.create_exam_window_and_schedule(date,date,text,int) to authenticated;
grant execute on function public.import_official_gcse_exam(text,text,date,time,int,text) to authenticated;
grant execute on function public.student_portal_snapshot(text) to anon,authenticated;

-- Protect internal helper functions from anonymous calls.
revoke execute on function public.generate_student_timetable(uuid) from public,anon;
revoke execute on function public.make_candidate_number() from public,anon;
revoke execute on function public.make_portal_code() from public,anon;


-- Backfill the configured administrator if the Auth user already existed before this SQL was installed.
insert into public.profiles(id,email,full_name,role)
select id,email,'Mason Sanders','admin'
from auth.users
where lower(email)='masonsandersbussiness@gmail.com'
on conflict(id) do update set email=excluded.email, role='admin';
