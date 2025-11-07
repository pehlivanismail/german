-- Drop any foreign key tying user_progress.user_id to public.users
-- When using Supabase Auth, user IDs live in auth.users, so this
-- constraint can prevent inserting progress records for authenticated users.

alter table user_progress
  drop constraint if exists user_progress_user_id_fkey;

