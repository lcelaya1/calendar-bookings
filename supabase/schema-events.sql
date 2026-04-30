-- Run in Supabase SQL editor:

-- Events table
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_desc text default '',
  assignment_method text not null default 'round_robin',
  is_open boolean not null default false,
  duration_minutes integer not null default 45,
  created_at timestamptz default now()
);

-- Junction: which reviewers participate in which event + their language
create table event_reviewers (
  event_id uuid references events(id) on delete cascade,
  reviewer_id uuid references reviewers(id) on delete cascade,
  language text, -- null for round_robin events, 'en'/'es' for language events
  primary key (event_id, reviewer_id)
);

-- Add event_id to existing tables
alter table slots add column if not exists event_id uuid references events(id);
alter table bookings add column if not exists event_id uuid references events(id);

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
  v_booking_id uuid;
begin
  select id, reviewer_id into v_slot_id, v_reviewer_id
  from slots
  where date = p_date
    and time = p_time
    and booked = false
    and (p_reviewer_id is null or reviewer_id = p_reviewer_id)
    and (p_event_id is null or event_id = p_event_id)
  limit 1
  for update skip locked;

  if v_slot_id is null then
    return json_build_object('error', 'No available slot at this time');
  end if;

  update slots set booked = true where id = v_slot_id;

  insert into bookings (slot_id, reviewer_id, leinner_name, leinner_email, leinner_project, date, time, event_id)
  values (v_slot_id, v_reviewer_id, p_leinner_name, p_leinner_email, p_leinner_project, p_date, p_time, p_event_id)
  returning id into v_booking_id;

  return json_build_object('booking_id', v_booking_id, 'reviewer_id', v_reviewer_id);
end;
$$;
