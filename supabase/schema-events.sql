-- Run in Supabase SQL editor:

-- Events table
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_desc text default '',
  assignment_method text not null default 'round_robin',
  is_open boolean not null default false,
  duration_minutes integer not null default 45,
  break_minutes integer not null default 10,
  min_notice_hours integer not null default 4,
  form_fields jsonb not null default '[
    {"id":"full_name","label":"Full name","type":"text","placeholder":"Your full name","required":true,"system":"name"},
    {"id":"email","label":"Email address","type":"email","placeholder":"you@example.com","required":true,"system":"email"},
    {"id":"project","label":"Proyecto al que perteneces","type":"text","placeholder":"Nombre de tu proyecto","required":true,"system":"project"}
  ]'::jsonb,
  calendar_title_template text not null default '[ONLINE] {reviewer_first_name} - {event_name} ({leinner_name})',
  created_at timestamptz default now()
);

-- Junction: which reviewers participate in which event + their language
create table event_reviewers (
  event_id uuid references events(id) on delete cascade,
  reviewer_id uuid references reviewers(id) on delete cascade,
  language text, -- null for round_robin events, 'en'/'es' for language events
  primary key (event_id, reviewer_id)
);

-- Saved availability editor state per reviewer/event
create table if not exists event_reviewer_availability (
  event_id uuid references events(id) on delete cascade,
  reviewer_id uuid references reviewers(id) on delete cascade,
  mode text not null default 'weekly',
  date_from date,
  date_to date,
  weekly_schedule jsonb not null default '{}'::jsonb,
  once_entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  primary key (event_id, reviewer_id)
);

-- If RLS is enabled in your Supabase project, allow the app to manage saved
-- availability editor state the same way it manages event slots.
alter table event_reviewer_availability enable row level security;

drop policy if exists "Public can read event reviewer availability" on event_reviewer_availability;
create policy "Public can read event reviewer availability"
on event_reviewer_availability
for select
using (true);

drop policy if exists "Public can insert event reviewer availability" on event_reviewer_availability;
create policy "Public can insert event reviewer availability"
on event_reviewer_availability
for insert
with check (true);

drop policy if exists "Public can update event reviewer availability" on event_reviewer_availability;
create policy "Public can update event reviewer availability"
on event_reviewer_availability
for update
using (true)
with check (true);

drop policy if exists "Public can delete event reviewer availability" on event_reviewer_availability;
create policy "Public can delete event reviewer availability"
on event_reviewer_availability
for delete
using (true);

-- Add event_id to existing tables
alter table slots add column if not exists event_id uuid references events(id);
alter table bookings add column if not exists event_id uuid references events(id);
alter table events add column if not exists break_minutes integer not null default 10;
alter table events add column if not exists min_notice_hours integer not null default 4;
alter table events add column if not exists form_fields jsonb not null default '[
  {"id":"full_name","label":"Full name","type":"text","placeholder":"Your full name","required":true,"system":"name"},
  {"id":"email","label":"Email address","type":"email","placeholder":"you@example.com","required":true,"system":"email"},
  {"id":"project","label":"Proyecto al que perteneces","type":"text","placeholder":"Nombre de tu proyecto","required":true,"system":"project"}
]'::jsonb;
alter table bookings add column if not exists form_responses jsonb not null default '[]'::jsonb;
alter table events add column if not exists calendar_title_template text not null default '[ONLINE] {reviewer_first_name} - {event_name} ({leinner_name})';

-- Remove language from reviewers (it moved to event_reviewers)
alter table reviewers drop column if exists language;

-- Remove assignment_method from config (it moved to events)
alter table config drop column if exists assignment_method;

-- Updated book_slot function
create or replace function book_slot(
  p_date date,
  p_time time,
  p_leinner_name text,
  p_leinner_email text,
  p_leinner_project text default '',
  p_reviewer_id uuid default null,
  p_event_id uuid default null
) returns json language plpgsql as $$
declare
  v_slot_id uuid;
  v_reviewer_id uuid;
  v_duration_minutes integer;
  v_booking_id uuid;
begin
  select
    s.id,
    s.reviewer_id,
    coalesce(
      s.duration_minutes,
      (select duration_minutes from events where id = s.event_id),
      45
    )
  into v_slot_id, v_reviewer_id, v_duration_minutes
  from slots s
  where s.date = p_date
    and s.time = p_time
    and s.booked = false
    and (p_reviewer_id is null or s.reviewer_id = p_reviewer_id)
    and (p_event_id is null or s.event_id = p_event_id)
  limit 1
  for update skip locked;

  if v_slot_id is null then
    return json_build_object('error', 'No available slot at this time');
  end if;

  update slots set booked = true where id = v_slot_id;

  insert into bookings (slot_id, reviewer_id, leinner_name, leinner_email, leinner_project, date, time, duration_minutes, event_id)
  values (v_slot_id, v_reviewer_id, p_leinner_name, p_leinner_email, p_leinner_project, p_date, p_time, coalesce(v_duration_minutes, 45), p_event_id)
  returning id into v_booking_id;

  return json_build_object('booking_id', v_booking_id, 'reviewer_id', v_reviewer_id);
end;
$$;
