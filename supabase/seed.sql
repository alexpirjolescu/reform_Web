-- Local development only (supabase db reset). Never run against production.
insert into public.schools (name, city) values
  ('Liceul demo 1', null),
  ('Liceul demo 2', null)
on conflict (name) do nothing;
