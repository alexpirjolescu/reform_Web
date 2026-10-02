// Local development only: creates one account per role on the LOCAL Supabase stack
// (supabase start), attached to the demo schools from supabase/demo.sql.
// Usage: node --env-file=.env.local scripts/dev-users.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url?.startsWith("http://127.0.0.1") && !url?.startsWith("http://localhost")) {
  console.error("Refusing to run: NEXT_PUBLIC_SUPABASE_URL is not a local stack.");
  process.exit(1);
}

const password = "reform-dev-2026";
const school1 = "de000000-0000-4000-8000-000000000001";
const school2 = "de000000-0000-4000-8000-000000000002";
const people = [
  { email: "admin@reform.test", full_name: "Ioana Admin", role: "admin", school_id: null },
  { email: "mentor@reform.test", full_name: "Andrei Mentor", role: "staff", school_id: null },
  { email: "ana@reform.test", full_name: "Ana Popescu", role: "core_lead", school_id: school1 },
  { email: "matei@reform.test", full_name: "Matei Toma", role: "student", school_id: school1 },
  { email: "elena@reform.test", full_name: "Elena Stan", role: "student", school_id: school2 },
];

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 200 });
for (const person of people) {
  let user = existing.users.find((u) => u.email === person.email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({ email: person.email, password, email_confirm: true });
    if (error) throw error;
    user = data.user;
  }
  const { error } = await supabase.from("profiles").upsert({ id: user.id, full_name: person.full_name, role: person.role, school_id: person.school_id });
  if (error) throw error;
  console.log(`${person.role.padEnd(10)} ${person.email}`);
}
console.log(`password for all: ${password}`);
