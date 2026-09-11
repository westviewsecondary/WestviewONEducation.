-- OneEducation MIS seed data
-- Run AFTER database.sql.
-- Creates the four requested Year 11 tutor groups and sample students in GLK/TRS/RJN only.
-- 11MWR is intentionally left empty.

-- Houses
insert into public.houses(name,sort_order) values
('Brunel',1),('Nightingale',2),('Seacole',3),('Turing',4)
on conflict(name) do update set sort_order=excluded.sort_order;

-- Tutor groups
insert into public.tutor_groups(code,year_group,tutor_name,room,description) values
('11MWR',11,'M. Wright','A01','Year 11 tutor community'),
('11GLK',11,'G. Lake','A02','Year 11 tutor community'),
('11TRS',11,'T. Ross','A03','Year 11 tutor community'),
('11RJN',11,'R. Jones','A04','Year 11 tutor community')
on conflict(code) do update set year_group=excluded.year_group,tutor_name=excluded.tutor_name,room=excluded.room;

-- GCSE / curriculum subjects
insert into public.subjects(name,code,category) values
('English','GS','core'),
('Mathematics','GM','core'),
('Combined Science','SC','core'),
('Biology','BI','gcse'),
('Chemistry','CH','gcse'),
('Physics','PH','gcse'),
('History','HI','gcse'),
('Geography','GE','gcse'),
('French','FR','gcse'),
('German','DE','gcse'),
('Spanish','SP','gcse'),
('Computer Science','CS','gcse'),
('Business','BU','gcse'),
('Film Studies','FS','gcse'),
('Art & Design','AR','gcse'),
('3D Design','3D','gcse'),
('GCSE PE','PE','gcse'),
('Food Preparation & Nutrition','FN','gcse'),
('Music','MU','gcse'),
('Drama','DR','gcse'),
('Religious Studies','RS','gcse'),
('Design & Technology','DT','gcse'),
('Child Development','CD','gcse')
on conflict(name) do update set code=excluded.code,category=excluded.category,active=true;

-- Campus: enough general/specialist rooms for a full Year 11 timetable.
do $$
declare b text; i int; block_name text;
begin
  foreach b in array array['A','B','C','D','E','F','G','H']
  loop
    block_name := case b
      when 'A' then 'English & Humanities'
      when 'B' then 'Mathematics'
      when 'C' then 'Science'
      when 'D' then 'Languages'
      when 'E' then 'Arts'
      when 'F' then 'Technology'
      when 'G' then 'Business & Computing'
      else 'General Teaching' end;
    for i in 1..6 loop
      insert into public.rooms(code,name,building,capacity,type)
      values(b||lpad(i::text,2,'0'),block_name||' '||i,b||' Block',
             case when i=6 then 20 else 32 end,
             case when i=6 then 'Small group' else 'Classroom' end)
      on conflict(code) do update set name=excluded.name,building=excluded.building,capacity=excluded.capacity,type=excluded.type;
    end loop;
  end loop;
end $$;

insert into public.rooms(code,name,building,capacity,type) values
('P01-GYM','Gym','P01',60,'PE'),
('P01-EQ','Equipment Room','P01',8,'PE support'),
('P02-HALL','Sports Hall','P02',120,'PE'),
('P02-OFF','PE Office','P02',10,'Office'),
('HALL','Main Hall','Central',240,'Exam / assembly')
on conflict(code) do update set name=excluded.name,building=excluded.building,capacity=excluded.capacity,type=excluded.type;

-- Behaviour reasons: Uniform is exactly 3 behaviour points.
insert into public.behaviour_reasons(name,points) values
('Uniform',3),
('Disruption',2),
('Late to lesson',1),
('Defiance',4),
('Unsafe behaviour',5),
('Homework not completed',1),
('Equipment not brought',1),
('Mobile phone misuse',3),
('Truancy from lesson',5)
on conflict(name) do update set points=excluded.points,active=true;

-- Year 11 class builder seed:
-- 5 core sets for English, Maths and Combined Science.
do $$
declare s record; n int; room_code text;
begin
  for s in select * from public.subjects where category='core' order by name loop
    for n in 1..5 loop
      room_code := case
        when s.name='English' then 'A'||lpad((((n*3)%6)+1)::text,2,'0')
        when s.name='Mathematics' then 'B'||lpad((((n*3)%6)+1)::text,2,'0')
        else 'C'||lpad((((n*3)%6)+1)::text,2,'0') end;
      insert into public.class_groups(display_name,subject,subject_code,subject_type,year_group,set_number,room_code)
      values('11'||s.code||n||' '||s.name,s.name,s.code,'core',11,n,room_code)
      on conflict(year_group,subject,set_number) do update set display_name=excluded.display_name,room_code=excluded.room_code;
    end loop;
  end loop;
end $$;

-- One GCSE group per option, except History and Geography which have A/B groups.
do $$
declare s record; n int; count_groups int; suffix text; room_code text;
begin
  for s in select * from public.subjects where category='gcse' order by name loop
    count_groups := case when s.name in ('History','Geography') then 2 else 1 end;
    for n in 1..count_groups loop
      suffix := case when count_groups=2 then case when n=1 then 'A' else 'B' end else '1' end;
      room_code := case
        when s.name in ('History','Geography') then 'A'||lpad((((n*3)%6)+1)::text,2,'0')
        when s.name in ('Biology','Chemistry','Physics') then 'C'||lpad((((n*3)%6)+1)::text,2,'0')
        when s.name in ('French','German','Spanish') then 'D'||lpad((((n*3)%6)+1)::text,2,'0')
        when s.name in ('Art & Design','3D Design','Music','Drama') then 'E'||lpad((((n*3)%6)+1)::text,2,'0')
        when s.name in ('Food Preparation & Nutrition','Design & Technology') then 'F'||lpad((((n*3)%6)+1)::text,2,'0')
        when s.name in ('Computer Science','Business','Film Studies') then 'G'||lpad((((n*3)%6)+1)::text,2,'0')
        when s.name='GCSE PE' then 'P01-GYM'
        else 'H'||lpad((((n*3)%6)+1)::text,2,'0') end;
      insert into public.class_groups(display_name,subject,subject_code,subject_type,year_group,set_number,room_code)
      values('11'||s.code||suffix||' '||s.name,s.name,s.code,'gcse',11,n,room_code)
      on conflict(year_group,subject,set_number) do update set display_name=excluded.display_name,room_code=excluded.room_code;
    end loop;
  end loop;
end $$;

-- Tutor and class communities.
insert into public.communities(type,ref_id,name)
select 'tutor',id,code||' Community' from public.tutor_groups
on conflict(type,ref_id) do nothing;

insert into public.communities(type,ref_id,name)
select 'class',id,display_name from public.class_groups
on conflict(type,ref_id) do nothing;

-- Sample students. None are placed into 11MWR.
-- Portal code hashes are generated from random one-time values and are deliberately not exposed.
with sample(tutor_code,first_name,last_name,candidate_number) as (
  values
  ('11GLK','Amelia','Carter','4185'),
  ('11GLK','Noah','Bennett','4016'),
  ('11GLK','Freya','Collins','2930'),
  ('11GLK','Oliver','Hart','6543'),
  ('11GLK','Isla','Morgan','2521'),
  ('11GLK','Leo','Davies','5176'),
  ('11GLK','Ruby','Fletcher','2021'),
  ('11GLK','Oscar','Hughes','6635'),
  ('11GLK','Maya','Roberts','8136'),
  ('11GLK','Archie','Walker','7198'),
  ('11TRS','Sophie','Ellis','5531'),
  ('11TRS','Harry','Cole','4222'),
  ('11TRS','Evie','Turner','9805'),
  ('11TRS','George','Parker','9722'),
  ('11TRS','Lily','James','2541'),
  ('11TRS','Theo','Morris','5751'),
  ('11TRS','Grace','Ward','2489'),
  ('11TRS','Alfie','Price','9949'),
  ('11TRS','Chloe','Reed','8396'),
  ('11TRS','Lucas','Bailey','5133'),
  ('11RJN','Emily','Cooper','1090'),
  ('11RJN','Jack','Mitchell','3885'),
  ('11RJN','Poppy','Green','1417'),
  ('11RJN','Charlie','Wood','8832'),
  ('11RJN','Maisie','Adams','1179'),
  ('11RJN','Henry','Brooks','2190'),
  ('11RJN','Florence','Hill','1203'),
  ('11RJN','Arthur','Bell','6638'),
  ('11RJN','Millie','Cook','9320'),
  ('11RJN','Finley','Gray','5510')
)
insert into public.students(first_name,last_name,year_group,tutor_group_id,house_id,candidate_number,portal_code_hash)
select
  s.first_name,s.last_name,11,tg.id,
  (select id from public.houses order by random() limit 1),
  s.candidate_number::text,
  encode(digest(public.make_portal_code(),'sha256'),'hex')
from sample s join public.tutor_groups tg on tg.code=s.tutor_code
where not exists(
  select 1 from public.students x
  where x.first_name=s.first_name and x.last_name=s.last_name and x.year_group=11
);

-- Give every Year 11 sample student one core class per subject and four distinct GCSE options.
do $$
declare st record; c record;
begin
  for st in
    select s.id from public.students s
    join public.tutor_groups tg on tg.id=s.tutor_group_id
    where s.year_group=11 and tg.code in ('11GLK','11TRS','11RJN')
  loop
    for c in
      select distinct on(subject) id
      from public.class_groups
      where year_group=11 and subject_type='core'
      order by subject,random()
    loop
      insert into public.class_memberships(student_id,class_group_id) values(st.id,c.id) on conflict do nothing;
    end loop;

    for c in
      select id from (
        select distinct on(subject) id,subject
        from public.class_groups
        where year_group=11 and subject_type='gcse'
        order by subject,random()
      ) q order by random() limit 4
    loop
      insert into public.class_memberships(student_id,class_group_id) values(st.id,c.id) on conflict do nothing;
    end loop;

    perform public.generate_student_timetable(st.id);
  end loop;
end $$;

-- Exam windows on the system calendar.
insert into public.exam_windows(start_date,end_date,exam_type,year_group)
select date '2026-11-09',date '2026-11-13','Mock 2',11
where not exists(select 1 from public.exam_windows where exam_type='Mock 2' and year_group=11 and start_date='2026-11-09');

insert into public.exam_windows(start_date,end_date,exam_type,year_group)
select date '2027-02-08',date '2027-02-12','Mock 3',11
where not exists(select 1 from public.exam_windows where exam_type='Mock 3' and year_group=11 and start_date='2027-02-08');

-- Example community announcement.
insert into public.community_posts(community_id,title,body)
select c.id,'Welcome to OneEducation','Check your timetable and community notices regularly.'
from public.communities c
join public.tutor_groups tg on c.type='tutor' and c.ref_id=tg.id
where tg.code in ('11GLK','11TRS','11RJN')
and not exists(select 1 from public.community_posts p where p.community_id=c.id and p.title='Welcome to OneEducation');

-- Useful calendar entries.
insert into public.calendar_events(title,event_date,end_date,category,details)
select 'Year 11 Mock 2','2026-11-09','2026-11-13','exam','Year 11 mock examination week'
where not exists(select 1 from public.calendar_events where title='Year 11 Mock 2' and event_date='2026-11-09');

insert into public.calendar_events(title,event_date,end_date,category,details)
select 'Year 11 Mock 3','2027-02-08','2027-02-12','exam','Year 11 mock examination week'
where not exists(select 1 from public.calendar_events where title='Year 11 Mock 3' and event_date='2027-02-08');
