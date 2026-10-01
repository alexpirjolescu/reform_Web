// Hand-written row types for the foundation tables (supabase/migrations/*_foundation.sql).
// Once the Supabase project is linked, replace with generated types:
//   npx supabase gen types typescript --linked > src/lib/database.types.ts

export const appRoles = ["student", "core_lead", "staff", "admin"] as const;
export type AppRole = (typeof appRoles)[number];

export type School = {
  id: string;
  name: string;
  city: string | null;
};

export type Profile = {
  id: string;
  full_name: string;
  role: AppRole;
  school_id: string | null;
  graduation_year: number | null;
  avatar_path: string | null;
  locale: "ro" | "en";
  deactivated_at: string | null;
};

export function isStaffRole(role: AppRole) {
  return role === "staff" || role === "admin";
}
