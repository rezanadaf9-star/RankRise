-- Optional manual setup for the RankRise student photo bucket.
-- Run in Supabase SQL Editor for the SAME project used by the website.
-- The Edge Function now also attempts to create this bucket automatically.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-photos',
  'student-photos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
