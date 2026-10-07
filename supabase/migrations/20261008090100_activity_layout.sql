-- re_form platform · news articles laid out in blocks
-- An article is a list of blocks (headings, text, media, quotes, boxes, buttons, dividers) in any
-- order; media blocks point at the post's activity_media rows by position and say where they sit
-- (across the page, beside the text on the left or right, or side by side). Null = a post written
-- before blocks existed, shown as its text followed by its media. The format is in src/lib/article.ts.

alter table public.activities
  add column layout jsonb check (layout is null or (jsonb_typeof(layout) = 'object' and pg_column_size(layout) <= 262144));

comment on column public.activities.layout is 'Article blocks {v:1, blocks:[...]} (src/lib/article.ts); media blocks refer to activity_media.position.';
