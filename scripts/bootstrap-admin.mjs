// Creates the first admin account (there is no public sign-up, so someone has to be first).
//
// Usage:  npm run admin:bootstrap -- you@example.com "Your Name"
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and NEXT_PUBLIC_SITE_URL in .env.local.
// Sends a normal invite email; the link lets the new admin choose a password.

import { createClient } from "@supabase/supabase-js";

const [email, fullName] = process.argv.slice(2);
if (!email || !fullName) {
  console.error('Usage: npm run admin:bootstrap -- you@example.com "Your Name"');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
if (!url || !secretKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.");
  process.exit(1);
}

const supabase = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
if (count && count > 0) {
  console.error("An admin already exists. Invite more people from /app/admin/invites instead.");
  process.exit(1);
}

const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
  data: { full_name: fullName },
  redirectTo: `${siteUrl}/auth/set-password`,
});
if (error || !data.user) {
  console.error("Invite failed:", error?.message);
  process.exit(1);
}

const { error: profileError } = await supabase
  .from("profiles")
  .insert({ id: data.user.id, full_name: fullName, role: "admin", school_id: null });
if (profileError) {
  await supabase.auth.admin.deleteUser(data.user.id);
  console.error("Profile insert failed:", profileError.message);
  process.exit(1);
}

await supabase.from("audit_log").insert({
  actor_id: null,
  action: "admin.bootstrapped",
  target_type: "user",
  target_id: data.user.id,
});

console.log(`Invite sent to ${email}. Open the email, choose a password, then go to ${siteUrl}/app.`);
