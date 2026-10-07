-- re_form platform · demo content, clearly marked "[demo]" (is_demo = true).
-- Lets the team try every module before real content exists. Safe to run more than once.
-- Remove it all from the app (Accounts → "remove demo content") or with: select public.remove_demo_content();
-- Run locally:  psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/demo.sql

begin;

-- Schools ----------------------------------------------------------------------
insert into public.schools (id, name, city) values
  ('de000000-0000-4000-8000-000000000001', '[demo] Liceul Teoretic „Exemplu”', 'București'),
  ('de000000-0000-4000-8000-000000000002', '[demo] Colegiul Național „Model”', 'Cluj-Napoca')
on conflict (id) do nothing;

-- News panel ---------------------------------------------------------------------
insert into public.activities (id, title, summary, body, category, starts_at, ends_at, location, status, publish_at, is_demo) values
  ('de000000-0000-4000-8000-000000000101', '[demo] Atelier: vorbitul în public, fără emoții',
   'Exersăm cum îți structurezi un mesaj, cum îți folosești vocea și cum răspunzi la întrebări grele. Deschis tuturor echipelor core.',
   E'## ce facem\n\n- cum îți construiești mesajul în trei pași\n- exerciții de voce și postură\n- simulare: răspunsuri la întrebări grele\n\n## ce aduci\n\nO idee de proiect pe care vrei s-o prezinți în două minute.\n\n*Conținut demonstrativ.*',
   'workshop', date_trunc('day', now()) + interval '7 days 13 hours', date_trunc('day', now()) + interval '7 days 15 hours', '[demo] Sala Mare, hub re_form', 'published', now() - interval '1 day', true),
  ('de000000-0000-4000-8000-000000000102', '[demo] Întâlnirea 4: bugetul unui proiect',
   'De unde vin banii, pe ce se duc și cum arăți asta într-un tabel simplu pe care îl înțelege oricine.',
   E'Lucrăm pe bugetele reale ale campaniilor voastre. După întâlnire urmează un quiz scurt.\n\n*Conținut demonstrativ.*',
   'meeting', date_trunc('day', now()) + interval '14 days 14 hours', null, '[demo] online', 'published', now() - interval '1 day', true),
  ('de000000-0000-4000-8000-000000000103', '[demo] Târgul de proiecte de toamnă',
   'Echipele core își prezintă campaniile în fața colegilor, a părinților și a partenerilor.',
   E'Fiecare echipă are un stand și cinci minute pe scenă. Intrarea e liberă.\n\n*Conținut demonstrativ.*',
   'event', date_trunc('day', now()) + interval '30 days 9 hours', date_trunc('day', now()) + interval '30 days 15 hours', '[demo] Aula liceului „Exemplu”', 'published', now() - interval '1 day', true),
  ('de000000-0000-4000-8000-000000000104', '[demo] Prezentări de proiect: campaniile de toamnă',
   'Ce au construit echipele în primele două luni: rezultate, greșeli și ce urmează.',
   E'*Conținut demonstrativ.*', 'showcase', date_trunc('day', now()) + interval '45 days 13 hours', null, '[demo] hub re_form', 'published', now() - interval '1 day', true),
  ('de000000-0000-4000-8000-000000000105', '[demo] Atelier: feedback care ajută',
   'Cum dai feedback concret și cum îl primești fără să te superi. Am lucrat pe exemple din proiectele voastre.',
   E'## ce am învățat\n\n1. spune ce ai observat, nu ce crezi despre persoană\n2. o singură sugestie, clară\n3. întreabă ce ar ajuta\n\n*Conținut demonstrativ.*',
   'workshop', date_trunc('day', now()) - interval '10 days' + interval '13 hours', null, '[demo] hub re_form', 'published', now() - interval '12 days', true),
  ('de000000-0000-4000-8000-000000000106', '[demo] Întâlnirea 3: comunicare în echipă',
   'Roluri, ședințe scurte și un canal în care nu se pierde nimic. Fiecare echipă și-a ales regulile.',
   E'*Conținut demonstrativ.*', 'meeting', date_trunc('day', now()) - interval '20 days' + interval '14 hours', null, '[demo] online', 'published', now() - interval '25 days', true),
  ('de000000-0000-4000-8000-000000000107', '[demo] Tabăra de început de an',
   'Două zile în care echipele core s-au cunoscut, și-au ales temele și au plecat cu un plan pe hârtie.',
   E'*Conținut demonstrativ.*', 'event', date_trunc('day', now()) - interval '40 days' + interval '8 hours', date_trunc('day', now()) - interval '39 days' + interval '16 hours', '[demo] Sinaia', 'published', now() - interval '45 days', true)
on conflict (id) do nothing;

insert into public.activity_schools (activity_id, school_id)
select a.id, s.id
from public.activities a
cross join (values ('de000000-0000-4000-8000-000000000001'::uuid), ('de000000-0000-4000-8000-000000000002'::uuid)) as s (id)
where a.id::text like 'de000000-0000-4000-8000-0000000001%'
on conflict do nothing;

-- Workspace: one project board per demo school ----------------------------------
insert into public.boards (id, school_id, name, description, due_date, is_demo) values
  ('de000000-0000-4000-8000-000000000201', 'de000000-0000-4000-8000-000000000001', '[demo] Campania „Vocea elevilor”',
   'O campanie prin care elevii spun ce ar schimba în liceu, cu un sondaj, afișe și o dezbatere.', (now() + interval '24 days')::date, true),
  ('de000000-0000-4000-8000-000000000202', 'de000000-0000-4000-8000-000000000002', '[demo] Biblioteca de schimb',
   'Un raft în holul liceului unde elevii lasă și iau cărți.', (now() + interval '40 days')::date, true)
on conflict (id) do nothing;

insert into public.board_columns (id, board_id, name, position, is_done) values
  ('de000000-0000-4000-8000-000000000211', 'de000000-0000-4000-8000-000000000201', 'de făcut', 1, false),
  ('de000000-0000-4000-8000-000000000212', 'de000000-0000-4000-8000-000000000201', 'în lucru', 2, false),
  ('de000000-0000-4000-8000-000000000213', 'de000000-0000-4000-8000-000000000201', 'în revizuire', 3, false),
  ('de000000-0000-4000-8000-000000000214', 'de000000-0000-4000-8000-000000000201', 'gata', 4, true),
  ('de000000-0000-4000-8000-000000000221', 'de000000-0000-4000-8000-000000000202', 'de făcut', 1, false),
  ('de000000-0000-4000-8000-000000000222', 'de000000-0000-4000-8000-000000000202', 'în lucru', 2, false),
  ('de000000-0000-4000-8000-000000000223', 'de000000-0000-4000-8000-000000000202', 'gata', 3, true)
on conflict (id) do nothing;

insert into public.cards (id, board_id, column_id, title, description, due_date, position) values
  ('de000000-0000-4000-8000-000000000231', 'de000000-0000-4000-8000-000000000201', 'de000000-0000-4000-8000-000000000211', 'Întrebările pentru sondaj', 'Maximum 10 întrebări, toate cu variante de răspuns.', (now() + interval '3 days')::date, 1),
  ('de000000-0000-4000-8000-000000000232', 'de000000-0000-4000-8000-000000000201', 'de000000-0000-4000-8000-000000000211', 'Cerem sala pentru dezbatere', '', (now() + interval '10 days')::date, 2),
  ('de000000-0000-4000-8000-000000000233', 'de000000-0000-4000-8000-000000000201', 'de000000-0000-4000-8000-000000000212', 'Afișul campaniei, varianta 2', 'Titlul mai mare, logo-ul jos.', (now() - interval '1 day')::date, 1),
  ('de000000-0000-4000-8000-000000000234', 'de000000-0000-4000-8000-000000000201', 'de000000-0000-4000-8000-000000000212', 'Textul pentru afiș și postări', '', (now() + interval '2 days')::date, 2),
  ('de000000-0000-4000-8000-000000000235', 'de000000-0000-4000-8000-000000000201', 'de000000-0000-4000-8000-000000000213', 'Formularul online, gata de testat', '', now()::date, 1),
  ('de000000-0000-4000-8000-000000000236', 'de000000-0000-4000-8000-000000000201', 'de000000-0000-4000-8000-000000000214', 'Echipa și rolurile', '', null, 1),
  ('de000000-0000-4000-8000-000000000237', 'de000000-0000-4000-8000-000000000201', 'de000000-0000-4000-8000-000000000214', 'Acordul direcțiunii', '', null, 2),
  ('de000000-0000-4000-8000-000000000241', 'de000000-0000-4000-8000-000000000202', 'de000000-0000-4000-8000-000000000221', 'Găsim un raft', '', (now() + interval '5 days')::date, 1),
  ('de000000-0000-4000-8000-000000000242', 'de000000-0000-4000-8000-000000000202', 'de000000-0000-4000-8000-000000000222', 'Regulile bibliotecii, pe o pagină', '', (now() + interval '8 days')::date, 1),
  ('de000000-0000-4000-8000-000000000243', 'de000000-0000-4000-8000-000000000202', 'de000000-0000-4000-8000-000000000223', 'Strângem primele 50 de cărți', '', null, 1)
on conflict (id) do nothing;

insert into public.card_labels (id, card_id, name, color) values
  ('de000000-0000-4000-8000-000000000251', 'de000000-0000-4000-8000-000000000231', 'sondaj', 'lavender'),
  ('de000000-0000-4000-8000-000000000252', 'de000000-0000-4000-8000-000000000233', 'design', 'pink'),
  ('de000000-0000-4000-8000-000000000253', 'de000000-0000-4000-8000-000000000234', 'comunicare', 'teal'),
  ('de000000-0000-4000-8000-000000000254', 'de000000-0000-4000-8000-000000000235', 'sondaj', 'lavender'),
  ('de000000-0000-4000-8000-000000000255', 'de000000-0000-4000-8000-000000000232', 'logistică', 'honey'),
  ('de000000-0000-4000-8000-000000000256', 'de000000-0000-4000-8000-000000000242', 'comunicare', 'teal')
on conflict (id) do nothing;

insert into public.checklist_items (id, card_id, label, done, position) values
  ('de000000-0000-4000-8000-000000000261', 'de000000-0000-4000-8000-000000000231', 'ciornă cu toată echipa', true, 1),
  ('de000000-0000-4000-8000-000000000262', 'de000000-0000-4000-8000-000000000231', 'verificat de mentor', false, 2),
  ('de000000-0000-4000-8000-000000000263', 'de000000-0000-4000-8000-000000000231', 'testat pe 5 colegi', false, 3),
  ('de000000-0000-4000-8000-000000000264', 'de000000-0000-4000-8000-000000000233', 'titlu mai mare', true, 1),
  ('de000000-0000-4000-8000-000000000265', 'de000000-0000-4000-8000-000000000233', 'logo jos', false, 2)
on conflict (id) do nothing;

-- The demo project's story map: tasks in their steps, the team's statements, two ideas of its own
update public.cards set stage = v.stage
from (values
  ('de000000-0000-4000-8000-000000000231'::uuid, 'need'),
  ('de000000-0000-4000-8000-000000000235'::uuid, 'need'),
  ('de000000-0000-4000-8000-000000000237'::uuid, 'solution'),
  ('de000000-0000-4000-8000-000000000236'::uuid, 'build'),
  ('de000000-0000-4000-8000-000000000233'::uuid, 'build'),
  ('de000000-0000-4000-8000-000000000234'::uuid, 'build'),
  ('de000000-0000-4000-8000-000000000232'::uuid, 'deliver'),
  ('de000000-0000-4000-8000-000000000241'::uuid, 'build'),
  ('de000000-0000-4000-8000-000000000242'::uuid, 'solution'),
  ('de000000-0000-4000-8000-000000000243'::uuid, 'deliver')
) as v (id, stage)
where cards.id = v.id;

update public.board_map_nodes set label = v.label
from (values
  ('need', 'Elevii nu au un loc unde să spună ce ar schimba în liceu.'),
  ('solution', 'O campanie: un sondaj online, afișe și o dezbatere cu direcțiunea.'),
  ('build', 'Scriem întrebările, facem afișele și formularul, împărțim rolurile.'),
  ('deliver', 'Dezbaterea din sala festivă, deschisă tuturor elevilor.'),
  ('impact', 'Cel puțin 200 de răspunsuri și 3 schimbări discutate cu direcțiunea.')
) as v (stage, label)
where board_map_nodes.board_id = 'de000000-0000-4000-8000-000000000201' and board_map_nodes.kind = 'stage' and board_map_nodes.stage = v.stage;

insert into public.board_map_nodes (id, board_id, kind, label, note, color, x, y, created_by) values
  ('de000000-0000-4000-8000-000000000271', 'de000000-0000-4000-8000-000000000201', 'concept', 'răspunsurile la sondaj', 'Le citim împreună și alegem 3 teme pentru dezbatere.', 'lavender', 1230, 420, null),
  ('de000000-0000-4000-8000-000000000272', 'de000000-0000-4000-8000-000000000201', 'concept', 'direcțiunea liceului', '', 'honey', 380, 470, null)
on conflict (id) do nothing;

insert into public.board_map_links (id, board_id, from_node, to_node, label, created_by)
select 'de000000-0000-4000-8000-000000000281', 'de000000-0000-4000-8000-000000000201', n.id, 'de000000-0000-4000-8000-000000000271', 'adună', null
from public.board_map_nodes n where n.card_id = 'de000000-0000-4000-8000-000000000235' and n.kind = 'card'
on conflict do nothing;
insert into public.board_map_links (id, board_id, from_node, to_node, label, created_by)
select 'de000000-0000-4000-8000-000000000282', 'de000000-0000-4000-8000-000000000201', n.id, 'de000000-0000-4000-8000-000000000272', 'are nevoie de sprijinul', null
from public.board_map_nodes n where n.card_id = 'de000000-0000-4000-8000-000000000237' and n.kind = 'card'
on conflict do nothing;
insert into public.board_map_links (id, board_id, from_node, to_node, label, created_by)
select 'de000000-0000-4000-8000-000000000283', 'de000000-0000-4000-8000-000000000201', 'de000000-0000-4000-8000-000000000271', n.id, 'măsoară', null
from public.board_map_nodes n where n.board_id = 'de000000-0000-4000-8000-000000000201' and n.kind = 'stage' and n.stage = 'impact'
on conflict do nothing;

-- Library: links in the shared re_form library ---------------------------------
insert into public.library_folders (id, space, school_id, name, is_demo) values
  ('de000000-0000-4000-8000-000000000301', 'shared', null, '[demo] întâlniri 2026', true),
  ('de000000-0000-4000-8000-000000000302', 'shared', null, '[demo] ghiduri', true),
  ('de000000-0000-4000-8000-000000000303', 'school', 'de000000-0000-4000-8000-000000000001', '[demo] documente echipă', true)
on conflict (id) do nothing;

insert into public.library_files (id, folder_id, name, description, mime_type, external_url, tags, is_demo) values
  ('de000000-0000-4000-8000-000000000311', 'de000000-0000-4000-8000-000000000302', '[demo] Ghid: vorbitul în public', 'Pagina de Wikipedia despre vorbitul în public, ca punct de plecare.', 'text/uri-list', 'https://ro.wikipedia.org/wiki/Oratorie', '{comunicare,atelier}', true),
  ('de000000-0000-4000-8000-000000000312', 'de000000-0000-4000-8000-000000000302', '[demo] Ghid: managementul proiectelor', 'Noțiunile de bază: obiectiv, pași, termene, roluri.', 'text/uri-list', 'https://ro.wikipedia.org/wiki/Managementul_proiectelor', '{proiect,planificare}', true),
  ('de000000-0000-4000-8000-000000000313', 'de000000-0000-4000-8000-000000000301', '[demo] Întâlnirea 3: comunicare în echipă (notițe)', 'Notițele întâlnirii, într-un document extern.', 'text/uri-list', 'https://ro.wikipedia.org/wiki/Comunicare', '{comunicare,întâlnire}', true),
  ('de000000-0000-4000-8000-000000000314', 'de000000-0000-4000-8000-000000000303', '[demo] Planul campaniei', 'Exemplu de link către un document al echipei.', 'text/uri-list', 'https://ro.wikipedia.org/wiki/Campanie_de_informare', '{campanie}', true)
on conflict (id) do nothing;

-- Assessments --------------------------------------------------------------------
insert into public.assessments (id, title, kind, instructions, activity_id, opens_at, closes_at, max_attempts, show_answers, allow_late, status, is_demo) values
  ('de000000-0000-4000-8000-000000000401', '[demo] Planificarea unui proiect', 'quiz',
   E'Patru întrebări despre ce am lucrat la întâlnire. Răspunsurile se salvează automat.\n\n*Conținut demonstrativ.*',
   'de000000-0000-4000-8000-000000000106', now() - interval '1 day', now() + interval '7 days', 2, 'after_submit', true, 'published', true),
  ('de000000-0000-4000-8000-000000000402', '[demo] Harta părților interesate', 'assignment',
   E'Desenează harta oamenilor de care depinde proiectul vostru: cine decide, cine ajută, cine e afectat.\n\nPredă o poză, un PDF sau un link.\n\n*Conținut demonstrativ.*',
   'de000000-0000-4000-8000-000000000105', now() - interval '1 day', now() + interval '10 days', 1, 'never', true, 'published', true)
on conflict (id) do nothing;

insert into public.assessment_schools (assessment_id, school_id)
select a.id, s.id
from (values ('de000000-0000-4000-8000-000000000401'::uuid), ('de000000-0000-4000-8000-000000000402'::uuid)) as a (id)
cross join (values ('de000000-0000-4000-8000-000000000001'::uuid), ('de000000-0000-4000-8000-000000000002'::uuid)) as s (id)
on conflict do nothing;

insert into public.questions (id, assessment_id, position, kind, prompt, points) values
  ('de000000-0000-4000-8000-000000000411', 'de000000-0000-4000-8000-000000000401', 1, 'single', 'Echipa ta are 4 săptămâni până la eveniment. Care este primul pas?', 1),
  ('de000000-0000-4000-8000-000000000412', 'de000000-0000-4000-8000-000000000401', 2, 'multiple', 'Ce trebuie să aibă fiecare sarcină din planul echipei?', 2),
  ('de000000-0000-4000-8000-000000000413', 'de000000-0000-4000-8000-000000000401', 3, 'true_false', 'Un termen fără responsabil e la fel de bun ca unul cu responsabil.', 1),
  ('de000000-0000-4000-8000-000000000414', 'de000000-0000-4000-8000-000000000401', 4, 'open', 'Descrie în 2–3 propoziții cum arată succesul pentru proiectul vostru.', 3)
on conflict (id) do nothing;

insert into public.question_choices (id, question_id, label, position) values
  ('de000000-0000-4000-8000-000000000421', 'de000000-0000-4000-8000-000000000411', 'Stabiliți obiectivul și cum arată succesul', 1),
  ('de000000-0000-4000-8000-000000000422', 'de000000-0000-4000-8000-000000000411', 'Faceți afișul, ca să atrageți atenția din timp', 2),
  ('de000000-0000-4000-8000-000000000423', 'de000000-0000-4000-8000-000000000411', 'Alegeți data și rezervați sala', 3),
  ('de000000-0000-4000-8000-000000000424', 'de000000-0000-4000-8000-000000000411', 'Cereți buget de la direcțiune', 4),
  ('de000000-0000-4000-8000-000000000425', 'de000000-0000-4000-8000-000000000412', 'un responsabil', 1),
  ('de000000-0000-4000-8000-000000000426', 'de000000-0000-4000-8000-000000000412', 'un termen', 2),
  ('de000000-0000-4000-8000-000000000427', 'de000000-0000-4000-8000-000000000412', 'o culoare preferată', 3),
  ('de000000-0000-4000-8000-000000000428', 'de000000-0000-4000-8000-000000000413', 'Adevărat', 1),
  ('de000000-0000-4000-8000-000000000429', 'de000000-0000-4000-8000-000000000413', 'Fals', 2)
on conflict (id) do nothing;

insert into public.choice_keys (choice_id, is_correct) values
  ('de000000-0000-4000-8000-000000000421', true),
  ('de000000-0000-4000-8000-000000000422', false),
  ('de000000-0000-4000-8000-000000000423', false),
  ('de000000-0000-4000-8000-000000000424', false),
  ('de000000-0000-4000-8000-000000000425', true),
  ('de000000-0000-4000-8000-000000000426', true),
  ('de000000-0000-4000-8000-000000000427', false),
  ('de000000-0000-4000-8000-000000000428', false),
  ('de000000-0000-4000-8000-000000000429', true)
on conflict (choice_id) do nothing;

commit;
