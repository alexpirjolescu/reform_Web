# reform_Web

Website and platform for re_form, a non-formal education academy that helps high school students communicate, plan and carry out projects.

- **Public news panel:** past and upcoming academy activities, open to parents, school boards, investors and anyone else. A post can carry photos, videos, audio, documents, links and posts from Instagram, Facebook, YouTube, Vimeo, TikTok, Spotify or Google Drive; players from other sites load only after the reader presses "show".
- **For students and staff (with an account):** a Trello-style workspace per school, a resource library, assessments (quizzes and hand-ins) and direct messages.
- **Three looks, chosen by each person:** white, dark and colour. The public pages (news panel, calendar, about) use the "white paper" newspaper layout (design B) on white, night or honey paper. Inside the platform, white and dark share the sidebar "studio" layout (design A), and colour keeps its sticker layout (design C). Visitors pick with a cookie; signed-in people keep the choice on their profile.

Product requirements and design directions are in [docs/](docs/).

## Stack

| Part | Choice |
| --- | --- |
| Front end and server code | [Next.js 16](https://nextjs.org) (App Router, Server Actions), TypeScript, Tailwind CSS 4 |
| Database, login, files, live updates | [Supabase](https://supabase.com): PostgreSQL with row level security, Auth, Storage, Realtime (EU region) |
| Hosting | [Vercel](https://vercel.com) |
| Languages | Romanian (default) and English with [next-intl](https://next-intl.dev); strings come from `scripts/messages-source.py` |
| Brand | Outfit, Lexend (stand-in for Stolzl) and Sour Gummy; colours and the three themes in `src/app/globals.css` |

## What works

| Module | Highlights |
| --- | --- |
| News panel (`/`, `/activities`, `/about`, `/privacy`) | Upcoming and past activities, filters by type, school and text, activity pages with gallery and `.ics` calendar file, newsletter sign-up, live stats |
| News editor (`/app/admin/news`, staff) | Create, schedule and publish activities; cover and gallery upload; photo-consent check before publishing; subscriber CSV for admins |
| Workspace (`/app/workspace`) | Boards per school, drag-and-drop columns and cards, labels, assignees, checklists, comments, history, attachments from the library, list and agenda views, live updates between people |
| Library (`/app/library`) | Shared re_form library plus one space per school, uploads up to 50 MB, links for long recordings (YouTube embeds), type filters, search, preview, attach to a task, copy link, trash with restore |
| Assessments (`/app/assessments`) | Quizzes (single, multiple, true/false, open) and hand-ins (files, link, text); autosave; automatic scoring; staff editor, results by student, school and question, marking with feedback, CSV export |
| Messages (`/app/messages`) | One-to-one conversations within a school and with the re_form team, live delivery, typing indicator, unread badges, image/PDF attachments, block and report |
| Admin (`/app/admin/users`, `/app/admin/reports`) | Invite people, change role or school, deactivate, add schools, remove demo content, read reported conversations (every read is logged) |

## Launch on Vercel

The Supabase project **reform-web** (`jdhxaatosmkedggzuiki`, Frankfurt) already has the migrations in `supabase/migrations/` and the demo content from `supabase/demo.sql`.

0. **Database.** The migrations in `supabase/migrations/` are applied to the reform-web project. If `supabase/remote-pending.sql` exists, paste it once into Supabase → SQL Editor and run it: it holds the parts the Supabase connector can't apply without a confirmation (SQL with `DELETE` or `DROP`). For another Supabase project: `npx supabase@2.119.0 link --project-ref <ref>` then `npx supabase@2.119.0 db push`.

1. **Import the repository** in Vercel (Add New → Project → `alexpirjolescu/reform_Web`). Framework: Next.js; keep the default build settings.
2. **Environment variables** (Settings → Environment Variables, for Production and Preview):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://jdhxaatosmkedggzuiki.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_llpsUSV5vkP4jVZmIHhN9Q_oI1-T6rr` (public by design; Supabase → Project Settings → API Keys) |
   | `SUPABASE_SECRET_KEY` | Supabase → API Keys → secret key (`sb_secret_…`). Server only; never share it |
   | `NEXT_PUBLIC_SITE_URL` | `https://reform-web-nine.vercel.app` (later your own domain). Links in invite and reset emails use it; if it is missing on Vercel, the production address is used |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | The address shown on the About page |
   | `CRON_SECRET` | Any long random string. Vercel Cron sends it to `/api/cron/purge-trash`, which empties the library trash after 30 days |

3. **Deploy.** Then set up Auth in the Supabase dashboard (Authentication):
   - **Sign In / Providers → Email:** keep the email provider *on*, and under **User Signups** turn *off* "Allow new users to sign up" (only invited people get accounts).
   - **URL Configuration:** Site URL = `https://reform-web-nine.vercel.app` (your `NEXT_PUBLIC_SITE_URL`); under Redirect URLs add `https://reform-web-nine.vercel.app/**` and `http://localhost:3000/**`. While the Site URL still says `http://localhost:3000`, invite emails point to localhost.
   - **Emails → Templates:** paste `supabase/templates/invite.html` into "Invite user" and `supabase/templates/recovery.html` into "Reset password". (The default templates work too: the app accepts both kinds of link.)
   - **Emails → SMTP:** connect your own email provider before inviting real people; the built-in sender is for testing and sends only a few emails per hour.
4. **Create the first admin** from your computer (needs the two Supabase values in `.env.local`):

   ```bash
   npm run admin:bootstrap -- you@example.com "Your Name"
   ```

   Open the invite email, choose a password and you land in `/app`.
5. **Invite everyone else** from **administration → invitations** (staff and admins; staff can't invite admins):
   - **Create invite link** makes a one-time link to this site that you send yourself (WhatsApp, your own email). It works without any Supabase email setup, and link previews in chat apps can't use it up (the token is only used when the person presses "accept").
   - **Send invite by email** uses Supabase's email: it needs the URL Configuration above, the templates, and custom SMTP for more than a few emails an hour.
   - Open invitations are listed with "new link", "resend email" and "withdraw". Set Supabase → Authentication → Providers → Email → *Email OTP Expiration* to `86400` so links stay valid for 24 hours (the default is 1 hour).
6. **Try it with the demo content**, marked "[demo]": two demo schools, a project board, library links, a quiz and an assignment, and seven activities on the news panel. Invite a test student into a "[demo]" school to see it as a student. When real content is ready, remove it all from **Accounts → demo content**.

## Run it locally

You need Node 22 and Docker.

```bash
npm install
npx supabase@2.119.0 start            # local Postgres, Auth, Storage, Realtime; loads supabase/demo.sql
cp .env.example .env.local            # fill in the local URL and keys printed by `supabase start`
node --env-file=.env.local scripts/dev-users.mjs   # one local account per role (password in the script)
npm run dev                           # http://localhost:3000
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` / `npm run typecheck` | ESLint; route types plus TypeScript |
| `npm run i18n:build` / `npm run i18n:check` | Rebuild `messages/*.json` from `scripts/messages-source.py`; check that every key used in the code exists |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from the local database |
| `npm run db:test` | 50 access-rule checks against the local database (rolled back afterwards) |
| `npm run test:unit` | Link recognition for embedded posts and videos (no database needed) |
| `node e2e/flows.mjs` | End-to-end flows against `npm start` + the local stack (board, upload, quiz and marking, hand-in, live message, publishing, access rules) |
| `node --env-file=.env.local e2e/invite.mjs` | Invitations: links by email and to copy, staff permissions |
| `node --env-file=.env.local e2e/media.mjs` | News posts with uploaded files and embedded posts |
| `node e2e/screens.mjs <dir>` | Screenshots of every module in all three themes |
| `npm run admin:bootstrap -- <email> "<name>"` | Invites the first admin (refuses if one exists) |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, the translation check and build on every push and pull request.

## Project layout

```
messages/                 ro.json, en.json (generated from scripts/messages-source.py)
src/proxy.ts              refreshes the Supabase session, guards /app
src/app/                  public pages, auth, and the private area under app/
src/components/           shells, news, workspace, library, assessments, messages (one layout per theme)
src/lib/                  data access per module, theme, formatting, Supabase clients
supabase/migrations/      schema, row level security, storage buckets and policies
supabase/demo.sql         demo content marked "[demo]"
supabase/tests/           access-rule tests
e2e/                      end-to-end checks and screenshots
docs/                     PRD, design directions, logos, mockups
```

## Security notes

- Row level security is the real access control; the UI only mirrors it. Every new table needs RLS and policies in its migration, and `npm run db:test` should cover it.
- Visitors can run only the four database functions the public panel needs (`supabase/migrations/*_function_grants.sql`).
- `SUPABASE_SECRET_KEY` bypasses row level security. Use it only in server code, after `requireAdmin()`.
- Answer keys live in a staff-only table; students see correctness only through `attempt_review()` and only when the assessment allows it.
- Direct messages are readable only by the two people in them. An admin can read a conversation only after it is reported, and each read is written to the audit log.
- Most users are minors: collect only what a feature needs, and see the privacy rules in [docs/PRD.md](docs/PRD.md). The privacy page is a draft until a legal adviser approves it.
