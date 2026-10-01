# reform_Web

Website and platform for re_form, a non-formal education academy that helps high school students communicate, plan and carry out projects.

- **Public news panel:** past and upcoming academy activities, open to parents, school boards, investors and anyone else.
- **For students and staff (with an account):** a Trello-style workspace per school, a resource library, assessments (quizzes and file tasks) and direct messages.

Product requirements and design directions are in [docs/](docs/).

## Stack

| Part | Choice |
| --- | --- |
| Front end and server code | [Next.js 16](https://nextjs.org) (App Router, Server Actions), TypeScript, Tailwind CSS 4 |
| Database, login, files, live updates | [Supabase](https://supabase.com): PostgreSQL with row level security, Auth, Storage, Realtime, hosted in an EU region |
| Languages | Romanian (default) and English with [next-intl](https://next-intl.dev); strings live in `messages/` |
| Brand | Outfit, Lexend (stand-in for Stolzl) and Sour Gummy; colours in `src/app/globals.css` |

## What works today (phase 0)

- Public home page (news panel shell) in Romanian and English
- Invite-only accounts: admins invite people from **/app/admin/users**; the invite email leads to "choose a password"
- Log in, log out, forgot password
- Roles (student, core lead, staff, admin) and schools, enforced in the database with row level security
- Private area at **/app** with placeholders for the workspace, library, assessments and messages

## Run it locally

You need Node 22 and a Supabase account.

1. **Create a Supabase project** in an EU region (for example Central EU, Frankfurt).
2. **Install and configure**

   ```bash
   npm install
   cp .env.example .env.local   # then fill in the four values
   ```

3. **Create the database tables**

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push          # applies supabase/migrations/*
   ```

4. **Set up Auth in the Supabase dashboard** (Authentication settings)
   - Turn off public sign-ups: only invited people get accounts.
   - Site URL: `http://localhost:3000` for now (your real domain later); add it to the redirect URLs too.
   - Email templates: paste `supabase/templates/invite.html` into "Invite user" and `supabase/templates/recovery.html` into "Reset password". Their links go to `/auth/confirm`, which this app needs.
   - Supabase's built-in email sender is only meant for testing and is heavily rate-limited. Connect your own SMTP provider before inviting real users.

5. **Add schools** to the `schools` table (Table Editor or SQL).
6. **Create the first admin**

   ```bash
   npm run admin:bootstrap -- you@example.com "Your Name"
   ```

   Open the invite email, choose a password, and you land in `/app`. Invite everyone else from `/app/admin/users`.

7. **Start the app:** `npm run dev`, then open http://localhost:3000.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types, then runs TypeScript |
| `npm run admin:bootstrap -- <email> "<name>"` | Invites the first admin (refuses if one exists) |

CI (`.github/workflows/ci.yml`) runs lint, typecheck and build on every push and pull request.

## Project layout

```
messages/                 ro.json, en.json: every UI string
src/proxy.ts              refreshes the Supabase session, guards /app
src/lib/supabase/         clients: browser, server, proxy, admin (secret key, server only)
src/lib/auth.ts           getSession, requireProfile, requireAdmin
src/app/page.tsx          public news panel
src/app/auth/             login, forgot password, invite/reset confirm, set password
src/app/app/              private area; admin/users invites people
supabase/migrations/      database schema and row level security
supabase/templates/       invite and reset emails
docs/                     PRD, design directions, logos
```

## Security notes

- Row level security is the real access control; the UI only mirrors it. Every new table needs RLS and policies in its migration.
- `SUPABASE_SECRET_KEY` bypasses row level security. Use it only in server code, after `requireAdmin()`.
- Most users are minors: collect only what a feature needs, and see the privacy rules in [docs/PRD.md](docs/PRD.md).
