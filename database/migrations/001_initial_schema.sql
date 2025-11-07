-- Enable pgcrypto for UUID generation
create extension if not exists "pgcrypto";

-- Categories represent high-level learning areas (e.g., vocabulary, grammar)
create table if not exists categories (
  id text primary key,
  name text not null,
  description text
);

insert into categories (id, name)
values ('vocabulary', 'Vocabulary')
on conflict (id) do nothing;

-- Units correspond to levels such as A1-L1, A1-L2, etc.
create table if not exists units (
  id text primary key,
  category_id text references categories (id) on delete set null,
  title text not null,
  description text,
  order_index integer default 0,
  created_at timestamptz default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  category_id text references categories (id) on delete set null,
  unit_id text references units (id) on delete set null,
  german_word text not null,
  english_translation text not null,
  full_sentence text not null,
  blank_sentence text not null,
  english_sentence text not null,
  correct_answer text not null,
  created_at timestamptz default now()
);

create table if not exists user_progress (
  user_id uuid not null,
  question_id uuid not null references questions (id) on delete cascade,
  unit_id text references units (id) on delete set null,
  category_id text references categories (id) on delete set null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_attempted timestamptz,
  last_answer text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint user_progress_pk primary key (user_id, question_id)
);

create index if not exists idx_user_progress_user_id on user_progress (user_id);
create index if not exists idx_user_progress_unit_id on user_progress (unit_id);

create or replace function update_user_progress_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_progress_updated_at on user_progress;
create trigger trg_user_progress_updated_at
before update on user_progress
for each row
execute procedure update_user_progress_timestamp();

-- Optional helper view summarising progress per unit for each user
create or replace view unit_progress as
select
  u.user_id,
  q.unit_id,
  count(distinct q.id) as total_questions,
  coalesce(sum(case when u.status = 'passed' then 1 else 0 end), 0) as passed_questions,
  coalesce(sum(case when u.status = 'failed' then 1 else 0 end), 0) as failed_questions
from questions q
left join user_progress u on u.question_id = q.id
group by u.user_id, q.unit_id;

-- Optional helper view summarising progress per category for each user
create or replace view category_progress as
select
  up.user_id,
  q.category_id,
  count(distinct q.id) as total_questions,
  coalesce(sum(case when up.status = 'passed' then 1 else 0 end), 0) as passed_questions,
  coalesce(sum(case when up.status = 'failed' then 1 else 0 end), 0) as failed_questions
from questions q
left join user_progress up on up.question_id = q.id
group by up.user_id, q.category_id;

