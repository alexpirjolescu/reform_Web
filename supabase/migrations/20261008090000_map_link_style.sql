-- re_form platform · concept map: the linking phrase gets its own colours
-- The box with the linking words ("se rezolvă prin") can take a background and a text colour from
-- the brand palette; null keeps the theme's default look.

alter table public.board_map_links
  add column label_bg text check (label_bg is null or label_bg in ('teal', 'honey', 'lavender', 'vermilion', 'lime', 'pink', 'ink', 'white')),
  add column label_fg text check (label_fg is null or label_fg in ('teal', 'honey', 'lavender', 'vermilion', 'lime', 'pink', 'ink', 'white'));

comment on column public.board_map_links.label_bg is 'Background of the linking phrase (brand colour name); null = theme default.';
comment on column public.board_map_links.label_fg is 'Text colour of the linking phrase (brand colour name); null = theme default.';
