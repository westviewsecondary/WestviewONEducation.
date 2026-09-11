-- OneEducation MIS v3 in-place upgrade
-- SAFE FOR AN EXISTING INSTALL: this script does NOT delete students, behaviour,
-- attendance, houses, communities or exam records.
-- It upgrades timetabling, staff, emergencies, exams and calendar support.

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Roles / permissions
-- -----------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin','slt','teacher','exam_officer','pastoral','cover_manager'));

create or replace function public.is_admin_or_slt()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and role in ('admin','slt')
  )
$$;

-- -----------------------------------------------------------------------------
-- Staff directory + aligned lesson/duty schedules
-- -----------------------------------------------------------------------------
create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  staff_code text unique not null,
  full_name text not null,
  job_title text not null default 'Teacher',
  role_type text not null default 'Teacher' check(role_type in ('Headteacher','SLT','Teacher','Support')),
  subject text,
  allocation_order int not null default 1,
  slt boolean not null default false,
  on_call_eligible boolean not null default true,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.class_groups add column if not exists teacher_id uuid references public.staff_members(id) on delete set null;

create table if not exists public.class_schedule (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.class_groups(id) on delete cascade,
  week_pattern text not null check(week_pattern in ('A','B')),
  day_of_week int not null check(day_of_week between 1 and 5),
  period int not null check(period between 1 and 5),
  lesson_label text not null,
  room_code text,
  created_at timestamptz not null default now(),
  unique(class_id,week_pattern,day_of_week,period)
);

create table if not exists public.staff_duties (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  week_pattern text not null check(week_pattern in ('A','B')),
  day_of_week int not null check(day_of_week between 1 and 5),
  period int not null check(period between 1 and 5),
  duty_type text not null check(duty_type in ('On-Call','SLT Removal','Duty','PPA','Pastoral')),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  unique(staff_id,week_pattern,day_of_week,period,duty_type)
);

-- Public page supplied by the project owner currently names Mr Williams as Headteacher.
-- All other names below are fictional OneEducation demonstration staff.
insert into public.staff_members(staff_code,full_name,job_title,role_type,subject,allocation_order,slt,on_call_eligible,email) values
('HT01','Mr Williams','Headteacher','Headteacher',null,1,true,true,null),
('SLT01','Ms Priya Shah','Deputy Headteacher','SLT',null,1,true,true,null),
('SLT02','Mr Daniel Mercer','Assistant Headteacher','SLT',null,2,true,true,null),
('SLT03','Mrs Louise Bennett','Assistant Headteacher','SLT',null,3,true,true,null),
('ENG01','Mrs Evelyn Foster','Teacher of English','Teacher','English',1,false,true,null),
('ENG02','Mr Aaron Hughes','Teacher of English','Teacher','English',2,false,true,null),
('ENG03','Ms Mia Clarke','Teacher of English','Teacher','English',3,false,true,null),
('ENG04','Mr Nathan Reed','Teacher of English','Teacher','English',4,false,true,null),
('ENG05','Miss Chloe Barrett','Teacher of English','Teacher','English',5,false,true,null),
('MAT01','Mr Theo Grant','Teacher of Mathematics','Teacher','Mathematics',1,false,true,null),
('MAT02','Ms Hannah Cole','Teacher of Mathematics','Teacher','Mathematics',2,false,true,null),
('MAT03','Mr Adam Turner','Teacher of Mathematics','Teacher','Mathematics',3,false,true,null),
('MAT04','Mrs Priya Mills','Teacher of Mathematics','Teacher','Mathematics',4,false,true,null),
('MAT05','Mr Oliver Ward','Teacher of Mathematics','Teacher','Mathematics',5,false,true,null),
('SCI01','Dr Leah Morgan','Teacher of Science','Teacher','Combined Science',1,false,true,null),
('SCI02','Mr Samuel King','Teacher of Science','Teacher','Combined Science',2,false,true,null),
('SCI03','Ms Grace Patel','Teacher of Science','Teacher','Combined Science',3,false,true,null),
('SCI04','Mr Isaac Bell','Teacher of Science','Teacher','Combined Science',4,false,true,null),
('SCI05','Ms Ruby Collins','Teacher of Science','Teacher','Combined Science',5,false,true,null),
('BIO01','Dr Nina Hall','Teacher of Biology','Teacher','Biology',1,false,true,null),
('CHE01','Dr Ben Carter','Teacher of Chemistry','Teacher','Chemistry',1,false,true,null),
('PHY01','Dr Eva Shaw','Teacher of Physics','Teacher','Physics',1,false,true,null),
('HIS01','Mr Lewis Parker','Teacher of History','Teacher','History',1,false,true,null),
('HIS02','Ms Sophie Harris','Teacher of History','Teacher','History',2,false,true,null),
('GEO01','Ms Amelia Wood','Teacher of Geography','Teacher','Geography',1,false,true,null),
('GEO02','Mr Jack Evans','Teacher of Geography','Teacher','Geography',2,false,true,null),
('FRE01','Ms Camille Martin','Teacher of French','Teacher','French',1,false,true,null),
('GER01','Ms Freya Weber','Teacher of German','Teacher','German',1,false,true,null),
('SPA01','Ms Sofia Lewis','Teacher of Spanish','Teacher','Spanish',1,false,true,null),
('COM01','Mr Daniel Brooks','Teacher of Computer Science','Teacher','Computer Science',1,false,true,null),
('BUS01','Mrs Rachel Morgan','Teacher of Business','Teacher','Business',1,false,true,null),
('FIL01','Mr Jamie Sinclair','Teacher of Film Studies','Teacher','Film Studies',1,false,true,null),
('ART01','Ms Maya Bennett','Teacher of Art & Design','Teacher','Art & Design',1,false,true,null),
('3DD01','Mr Callum Price','Teacher of 3D Design','Teacher','3D Design',1,false,true,null),
('PE001','Mr Jordan Ellis','Teacher of PE','Teacher','GCSE PE',1,false,true,null),
('FOD01','Mrs Sarah Cook','Teacher of Food Preparation','Teacher','Food Preparation & Nutrition',1,false,true,null),
('MUS01','Mr Tom Bailey','Teacher of Music','Teacher','Music',1,false,true,null),
('DRA01','Ms Emily Ross','Teacher of Drama','Teacher','Drama',1,false,true,null),
('RS001','Ms Aisha Khan','Teacher of Religious Studies','Teacher','Religious Studies',1,false,true,null),
('DT001','Mr Henry Clarke','Teacher of Design & Technology','Teacher','Design & Technology',1,false,true,null),
('CD001','Mrs Laura Mitchell','Teacher of Child Development','Teacher','Child Development',1,false,true,null)
on conflict(staff_code) do update set
  full_name=excluded.full_name,
  job_title=excluded.job_title,
  role_type=excluded.role_type,
  subject=excluded.subject,
  allocation_order=excluded.allocation_order,
  slt=excluded.slt,
  on_call_eligible=excluded.on_call_eligible,
  active=true;

-- SLT on-call / removal rota examples.
insert into public.staff_duties(staff_id,week_pattern,day_of_week,period,duty_type,location,notes)
select id,'A',1,3,'On-Call','Whole site','SLT on-call response' from public.staff_members where staff_code='HT01'
on conflict do nothing;
insert into public.staff_duties(staff_id,week_pattern,day_of_week,period,duty_type,location,notes)
select id,'A',2,4,'SLT Removal','Removal room','Available for behaviour removals' from public.staff_members where staff_code='SLT01'
on conflict do nothing;
insert into public.staff_duties(staff_id,week_pattern,day_of_week,period,duty_type,location,notes)
select id,'B',3,2,'On-Call','Whole site','SLT on-call response' from public.staff_members where staff_code='SLT02'
on conflict do nothing;
insert into public.staff_duties(staff_id,week_pattern,day_of_week,period,duty_type,location,notes)
select id,'B',5,4,'SLT Removal','Removal room','Available for behaviour removals' from public.staff_members where staff_code='SLT03'
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Student profile / portal credential support
-- Existing secure codes remain valid. Their plaintext cannot be reconstructed from
-- the hash, so portal_code_display remains null until an admin/SLT resets the code.
-- New imports store the generated code so authorised staff can see it in profile.
-- -----------------------------------------------------------------------------
alter table public.students add column if not exists portal_code_display text;

-- Week A / B timetables. Preserve all existing timetable rows as Week A first.
alter table public.student_timetable add column if not exists week_pattern text not null default 'A';
alter table public.student_timetable drop constraint if exists student_timetable_student_id_day_of_week_period_key;
do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conname='student_timetable_student_week_day_period_key'
      and conrelid='public.student_timetable'::regclass
  ) then
    alter table public.student_timetable
      add constraint student_timetable_student_week_day_period_key
      unique(student_id,week_pattern,day_of_week,period);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Emergency lifecycle
-- -----------------------------------------------------------------------------
alter table public.emergency_alerts drop constraint if exists emergency_alerts_status_check;
alter table public.emergency_alerts
  add constraint emergency_alerts_status_check
  check(status in ('open','monitoring','resolved','cancelled'));
alter table public.emergency_alerts add column if not exists resolution_note text;
alter table public.emergency_alerts add column if not exists resolved_by uuid references auth.users(id);

-- -----------------------------------------------------------------------------
-- Exam lifecycle / student-facing tags
-- -----------------------------------------------------------------------------
alter table public.exams add column if not exists status text not null default 'scheduled';
alter table public.exams drop constraint if exists exams_status_check;
alter table public.exams
  add constraint exams_status_check
  check(status in ('scheduled','delayed','cancelled','deleted'));
alter table public.exams add column if not exists status_note text;
alter table public.exams add column if not exists original_exam_date date;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.make_portal_code()
returns text language sql volatile set search_path=public,extensions as $$
  select 'OE-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,4)) || '-' ||
         upper(substr(encode(gen_random_bytes(6),'hex'),1,4))
$$;

create or replace function public.assign_teachers_to_classes()
returns int language plpgsql security definer set search_path=public as $$
declare c record; t record; changed int:=0;
begin
  if public.is_staff() and not public.is_admin_or_slt() then raise exception 'Administrator or SLT access required'; end if;
  for c in select * from public.class_groups order by year_group,subject,set_number loop
    select sm.id,sm.full_name into t
    from public.staff_members sm
    where sm.active=true and lower(coalesce(sm.subject,''))=lower(coalesce(c.subject,''))
    order by abs(sm.allocation_order-c.set_number),sm.allocation_order,sm.full_name
    limit 1;
    if t.id is not null then
      update public.class_groups
      set teacher_id=t.id,teacher_name=t.full_name
      where id=c.id;
      changed:=changed+1;
    end if;
  end loop;
  return changed;
end $$;

create or replace function public.rebuild_class_schedule()
returns int language plpgsql security definer set search_path=public as $$
declare c record; base int; idx int; d int; p int; made int:=0; w text; slots_a int[]; slots_b int[];
begin
  if public.is_staff() and not public.is_admin_or_slt() then
    raise exception 'Administrator or SLT access required';
  end if;

  delete from public.class_schedule;

  -- English: exactly 2 Language + 2 Literature lessons each week.
  insert into public.class_schedule(class_id,week_pattern,day_of_week,period,lesson_label,room_code)
  select id,'A',1,1,'English Language',room_code from public.class_groups where lower(subject)='english'
  union all select id,'A',2,2,'English Literature',room_code from public.class_groups where lower(subject)='english'
  union all select id,'A',4,3,'English Language',room_code from public.class_groups where lower(subject)='english'
  union all select id,'A',5,4,'English Literature',room_code from public.class_groups where lower(subject)='english'
  union all select id,'B',1,3,'English Language',room_code from public.class_groups where lower(subject)='english'
  union all select id,'B',2,4,'English Literature',room_code from public.class_groups where lower(subject)='english'
  union all select id,'B',3,2,'English Language',room_code from public.class_groups where lower(subject)='english'
  union all select id,'B',5,1,'English Literature',room_code from public.class_groups where lower(subject)='english';

  -- Mathematics: exactly 4 lessons each week. Every set shares its set timetable.
  insert into public.class_schedule(class_id,week_pattern,day_of_week,period,lesson_label,room_code)
  select id,'A',1,2,'Mathematics',room_code from public.class_groups where lower(subject)='mathematics'
  union all select id,'A',2,3,'Mathematics',room_code from public.class_groups where lower(subject)='mathematics'
  union all select id,'A',4,4,'Mathematics',room_code from public.class_groups where lower(subject)='mathematics'
  union all select id,'A',5,1,'Mathematics',room_code from public.class_groups where lower(subject)='mathematics'
  union all select id,'B',1,1,'Mathematics',room_code from public.class_groups where lower(subject)='mathematics'
  union all select id,'B',2,2,'Mathematics',room_code from public.class_groups where lower(subject)='mathematics'
  union all select id,'B',4,3,'Mathematics',room_code from public.class_groups where lower(subject)='mathematics'
  union all select id,'B',5,4,'Mathematics',room_code from public.class_groups where lower(subject)='mathematics';

  -- Combined Science core: 4 lessons each week.
  insert into public.class_schedule(class_id,week_pattern,day_of_week,period,lesson_label,room_code)
  select id,'A',1,3,'Combined Science',room_code from public.class_groups where lower(subject)='combined science'
  union all select id,'A',3,1,'Combined Science',room_code from public.class_groups where lower(subject)='combined science'
  union all select id,'A',3,4,'Combined Science',room_code from public.class_groups where lower(subject)='combined science'
  union all select id,'A',5,2,'Combined Science',room_code from public.class_groups where lower(subject)='combined science'
  union all select id,'B',1,4,'Combined Science',room_code from public.class_groups where lower(subject)='combined science'
  union all select id,'B',3,1,'Combined Science',room_code from public.class_groups where lower(subject)='combined science'
  union all select id,'B',4,2,'Combined Science',room_code from public.class_groups where lower(subject)='combined science'
  union all select id,'B',5,3,'Combined Science',room_code from public.class_groups where lower(subject)='combined science';

  -- Remaining subject classes receive three scheduled lessons per week using the
  -- non-core timetable slots. These are deterministic per class, so teacher and
  -- student views line up with one another.
  slots_a := array[[1,4],[1,5],[2,1],[2,4],[2,5],[3,2],[3,3],[3,5],[4,1],[4,2],[4,5],[5,3],[5,5]];
  slots_b := array[[1,2],[1,5],[2,1],[2,3],[2,5],[3,3],[3,4],[3,5],[4,1],[4,4],[4,5],[5,2],[5,5]];

  for c in
    select * from public.class_groups
    where lower(subject) not in ('english','mathematics','combined science')
    order by year_group,subject,set_number
  loop
    base := mod(abs(hashtext(c.display_name)),13);
    foreach w in array array['A','B'] loop
      for idx in 0..2 loop
        if w='A' then
          d := slots_a[mod(base+(idx*4),13)+1][1];
          p := slots_a[mod(base+(idx*4),13)+1][2];
        else
          d := slots_b[mod(base+(idx*5)+2,13)+1][1];
          p := slots_b[mod(base+(idx*5)+2,13)+1][2];
        end if;
        insert into public.class_schedule(class_id,week_pattern,day_of_week,period,lesson_label,room_code)
        values(c.id,w,d,p,c.subject,c.room_code)
        on conflict(class_id,week_pattern,day_of_week,period) do nothing;
      end loop;
    end loop;
  end loop;

  select count(*) into made from public.class_schedule;
  return made;
end $$;

create or replace function public.generate_student_timetable(p_student_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r record; w text; d int; p int; v_room text;
begin
  delete from public.student_timetable where student_id=p_student_id;

  -- Core first, then GCSE/options. Conflicting option slots never overwrite core.
  for r in
    select cs.*,cg.display_name,cg.subject,
      case when lower(cg.subject)='english' then 1
           when lower(cg.subject)='mathematics' then 2
           when lower(cg.subject)='combined science' then 3 else 4 end as priority
    from public.class_memberships cm
    join public.class_groups cg on cg.id=cm.class_group_id
    join public.class_schedule cs on cs.class_id=cg.id
    where cm.student_id=p_student_id
    order by priority,cs.week_pattern,cs.day_of_week,cs.period,cg.display_name
  loop
    insert into public.student_timetable(
      student_id,week_pattern,day_of_week,period,class_id,class_name,subject,room_code
    ) values(
      p_student_id,r.week_pattern,r.day_of_week,r.period,r.class_id,r.display_name,r.lesson_label,coalesce(r.room_code,'H01')
    ) on conflict(student_id,week_pattern,day_of_week,period) do nothing;
  end loop;

  -- Keep a complete 5-period day. Any genuinely free slot is shown as supervised
  -- Personal Development / Study rather than silently disappearing.
  foreach w in array array['A','B'] loop
    for d in 1..5 loop
      for p in 1..5 loop
        if not exists(
          select 1 from public.student_timetable
          where student_id=p_student_id and week_pattern=w and day_of_week=d and period=p
        ) then
          select coalesce(tg.room,'H01') into v_room
          from public.students s left join public.tutor_groups tg on tg.id=s.tutor_group_id
          where s.id=p_student_id;
          insert into public.student_timetable(student_id,week_pattern,day_of_week,period,class_name,subject,room_code)
          values(p_student_id,w,d,p,null,'Personal Development / Study','Personal Development / Study',coalesce(v_room,'H01'));
        end if;
      end loop;
    end loop;
  end loop;
end $$;

create or replace function public.rebuild_all_current_timetables()
returns int language plpgsql security definer set search_path=public as $$
declare s record; n int:=0;
begin
  if public.is_staff() and not public.is_admin_or_slt() then
    raise exception 'Administrator or SLT access required';
  end if;
  for s in select id from public.students where status='active' loop
    perform public.generate_student_timetable(s.id);
    n:=n+1;
  end loop;
  return n;
end $$;

create or replace function public.move_student_class(p_student_id uuid,p_new_class_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_subject text; v_year int; v_student_year int; v_name text;
begin
  if not public.is_admin_or_slt() then raise exception 'Administrator or SLT access required'; end if;
  select subject,year_group,display_name into v_subject,v_year,v_name from public.class_groups where id=p_new_class_id;
  select year_group into v_student_year from public.students where id=p_student_id and status='active';
  if v_subject is null then raise exception 'Target class not found'; end if;
  if v_student_year is null then raise exception 'Student not found'; end if;
  if v_year<>v_student_year then raise exception 'Class must be in the student''s year group'; end if;

  delete from public.class_memberships cm
  using public.class_groups cg
  where cm.class_group_id=cg.id and cm.student_id=p_student_id and lower(cg.subject)=lower(v_subject);
  insert into public.class_memberships(student_id,class_group_id) values(p_student_id,p_new_class_id) on conflict do nothing;
  perform public.generate_student_timetable(p_student_id);
  return v_name;
end $$;

create or replace function public.reset_student_portal_code(p_student_id uuid)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare v_code text;
begin
  if not public.is_admin_or_slt() then raise exception 'Administrator or SLT access required'; end if;
  if not exists(select 1 from public.students where id=p_student_id) then raise exception 'Student not found'; end if;
  loop
    v_code:=public.make_portal_code();
    exit when not exists(select 1 from public.students where portal_code_hash=encode(digest(v_code,'sha256'),'hex'));
  end loop;
  update public.students
  set portal_code_hash=encode(digest(v_code,'sha256'),'hex'),portal_code_display=v_code
  where id=p_student_id;
  return v_code;
end $$;

-- Preserve import behaviour while storing the new code for staff profile display.
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
) language plpgsql security definer set search_path=public,extensions as $$
declare
  v_student uuid; v_code text; v_candidate text; v_house uuid; v_house_name text; v_tutor_code text; r record;
begin
  if not public.is_staff() then raise exception 'Staff login required'; end if;
  if p_year_group not between 7 and 11 then raise exception 'Invalid year group'; end if;
  select code into v_tutor_code from public.tutor_groups where id=p_tutor_group_id and year_group=p_year_group;
  if v_tutor_code is null then raise exception 'Tutor group does not belong to Year %',p_year_group; end if;
  select h.id,h.name into v_house,v_house_name from public.houses h order by random() limit 1;
  if v_house is null then raise exception 'No houses configured'; end if;

  loop
    v_code:=public.make_portal_code();
    exit when not exists(select 1 from public.students where portal_code_hash=encode(digest(v_code,'sha256'),'hex'));
  end loop;
  v_candidate:=public.make_candidate_number();

  insert into public.students(first_name,last_name,year_group,tutor_group_id,house_id,candidate_number,portal_code_hash,portal_code_display)
  values(trim(p_first_name),trim(p_last_name),p_year_group,p_tutor_group_id,v_house,v_candidate,encode(digest(v_code,'sha256'),'hex'),v_code)
  returning id into v_student;

  for r in
    select distinct on(subject) id from public.class_groups
    where year_group=p_year_group and subject_type='core'
    order by subject,random()
  loop
    insert into public.class_memberships(student_id,class_group_id) values(v_student,r.id) on conflict do nothing;
  end loop;

  for r in
    select id from (
      select distinct on(subject) id,subject from public.class_groups
      where year_group=p_year_group and subject_type='gcse'
      order by subject,random()
    ) q order by random() limit 4
  loop
    insert into public.class_memberships(student_id,class_group_id) values(v_student,r.id) on conflict do nothing;
  end loop;

  if not exists(select 1 from public.class_schedule limit 1) then
    perform public.rebuild_class_schedule();
  end if;
  perform public.generate_student_timetable(v_student);

  insert into public.communities(type,ref_id,name)
  values('tutor',p_tutor_group_id,v_tutor_code||' Community') on conflict(type,ref_id) do nothing;
  insert into public.communities(type,ref_id,name)
  select 'class',cg.id,cg.display_name from public.class_groups cg
  join public.class_memberships cm on cm.class_group_id=cg.id where cm.student_id=v_student
  on conflict(type,ref_id) do nothing;

  return query select v_student,trim(p_first_name)||' '||trim(p_last_name),v_code,v_candidate,v_house_name,v_tutor_code;
end $$;

create or replace function public.finish_emergency_alert(p_alert_id uuid,p_action text,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_staff() then raise exception 'Staff login required'; end if;
  if p_action not in ('resolved','cancelled') then raise exception 'Action must be resolved or cancelled'; end if;
  update public.emergency_alerts
  set status=p_action,resolved_at=now(),resolved_by=auth.uid(),resolution_note=nullif(trim(coalesce(p_note,'')),'')
  where id=p_alert_id and status in ('open','monitoring');
  if not found then raise exception 'Alert is already closed or was not found'; end if;
end $$;

create or replace function public.set_exam_status(p_exam_id uuid,p_status text,p_new_date date default null,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare e record;
begin
  if public.staff_role() not in ('admin','exam_officer') then raise exception 'Admin or Exam Officer access required'; end if;
  if p_status not in ('scheduled','delayed','cancelled','deleted') then raise exception 'Invalid exam status'; end if;
  select * into e from public.exams where id=p_exam_id;
  if e.id is null then raise exception 'Exam not found'; end if;
  if p_status='delayed' and p_new_date is null then raise exception 'A new date is required for a delayed exam'; end if;

  update public.exams set
    original_exam_date=case when p_status='delayed' then coalesce(original_exam_date,exam_date) else original_exam_date end,
    exam_date=case when p_status='delayed' then p_new_date else exam_date end,
    status=p_status,
    status_note=nullif(trim(coalesce(p_note,'')),'')
  where id=p_exam_id;

  if p_status in ('delayed','cancelled') then
    insert into public.community_posts(community_id,title,body,created_by)
    select distinct c.id,
      case when p_status='delayed' then 'Exam delayed' else 'Exam cancelled' end,
      e.paper||' · '||case when p_status='delayed' then 'New date: '||to_char(p_new_date,'Dy DD Mon YYYY') else 'This exam has been cancelled.' end ||
      case when nullif(trim(coalesce(p_note,'')),'') is not null then ' · '||trim(p_note) else '' end,
      auth.uid()
    from public.exam_class_links ecl
    join public.communities c on c.type='class' and c.ref_id=ecl.class_id
    where ecl.exam_id=p_exam_id;
  end if;
end $$;

-- Student portal: cancelled/delayed tags are visible; deleted exams are hidden.
create or replace function public.student_portal_snapshot(p_code text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare s record; result jsonb;
begin
  select st.*,tg.code tutor_code,h.name house_name into s
  from public.students st
  left join public.tutor_groups tg on tg.id=st.tutor_group_id
  left join public.houses h on h.id=st.house_id
  where st.portal_code_hash=encode(digest(trim(p_code),'sha256'),'hex') and st.status='active'
  limit 1;
  if s.id is null then return jsonb_build_object('error','Invalid student access code'); end if;

  select jsonb_build_object(
    'student',jsonb_build_object(
      'id',s.id,'first_name',s.first_name,'last_name',s.last_name,'year_group',s.year_group,
      'candidate_number',s.candidate_number,'tutor_code',s.tutor_code,'house_name',s.house_name
    ),
    'classes',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',cg.id,'display_name',cg.display_name,'subject',cg.subject,'room_code',cg.room_code,'teacher_name',cg.teacher_name
      ) order by cg.subject)
      from public.class_memberships cm join public.class_groups cg on cg.id=cm.class_group_id
      where cm.student_id=s.id
    ),'[]'::jsonb),
    'timetable',coalesce((
      select jsonb_agg(to_jsonb(tt) order by tt.week_pattern,tt.day_of_week,tt.period)
      from public.student_timetable tt where tt.student_id=s.id
    ),'[]'::jsonb),
    'notices',coalesce((
      select jsonb_agg(jsonb_build_object('title',cp.title,'body',cp.body,'created_at',cp.created_at) order by cp.created_at desc)
      from public.community_posts cp join public.communities c on c.id=cp.community_id
      where (c.type='tutor' and c.ref_id=s.tutor_group_id)
         or (c.type='class' and c.ref_id in (select class_group_id from public.class_memberships where student_id=s.id))
    ),'[]'::jsonb),
    'exams',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'exam_type',e.exam_type,'subject',e.subject,'paper',e.paper,'exam_date',e.exam_date,
        'start_time',e.start_time,'duration_minutes',e.duration_minutes,'status',e.status,'status_note',e.status_note
      ) order by e.exam_date,e.start_time)
      from public.exams e join public.exam_class_links ecl on ecl.exam_id=e.id
      where ecl.class_id in (select class_group_id from public.class_memberships where student_id=s.id)
        and e.status<>'deleted' and (e.exam_date>=current_date or e.status='cancelled')
    ),'[]'::jsonb)
  ) into result;
  return result;
end $$;

-- -----------------------------------------------------------------------------
-- RLS for new data
-- -----------------------------------------------------------------------------
alter table public.staff_members enable row level security;
alter table public.class_schedule enable row level security;
alter table public.staff_duties enable row level security;

drop policy if exists staff_read on public.staff_members;
create policy staff_read on public.staff_members for select to authenticated using(public.is_staff());
drop policy if exists staff_read on public.class_schedule;
create policy staff_read on public.class_schedule for select to authenticated using(public.is_staff());
drop policy if exists staff_read on public.staff_duties;
create policy staff_read on public.staff_duties for select to authenticated using(public.is_staff());

drop policy if exists slt_manage on public.staff_members;
create policy slt_manage on public.staff_members for all to authenticated using(public.is_admin_or_slt()) with check(public.is_admin_or_slt());
drop policy if exists slt_manage on public.class_schedule;
create policy slt_manage on public.class_schedule for all to authenticated using(public.is_admin_or_slt()) with check(public.is_admin_or_slt());
drop policy if exists slt_manage on public.staff_duties;
create policy slt_manage on public.staff_duties for all to authenticated using(public.is_admin_or_slt()) with check(public.is_admin_or_slt());

grant execute on function public.assign_teachers_to_classes() to authenticated;
grant execute on function public.rebuild_class_schedule() to authenticated;
grant execute on function public.rebuild_all_current_timetables() to authenticated;
grant execute on function public.move_student_class(uuid,uuid) to authenticated;
grant execute on function public.reset_student_portal_code(uuid) to authenticated;
grant execute on function public.finish_emergency_alert(uuid,text,text) to authenticated;
grant execute on function public.set_exam_status(uuid,text,date,text) to authenticated;

-- -----------------------------------------------------------------------------
-- Apply v3 to EXISTING data. Students themselves are not deleted or recreated.
-- -----------------------------------------------------------------------------
select public.assign_teachers_to_classes();
select public.rebuild_class_schedule();
select public.rebuild_all_current_timetables();
