import type { Database } from "@/lib/database.types";

// Row types come from the generated database types (npm run db:types).
type PublicSchema = Database["public"];
export type Row<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];

export const appRoles = ["student", "core_lead", "staff", "admin"] as const;
export type AppRole = PublicSchema["Enums"]["app_role"];

export type School = Pick<Row<"schools">, "id" | "name" | "city">;
export type Profile = Row<"profiles">;

export type ActivityCategory = PublicSchema["Enums"]["activity_category"];
export const activityCategories: ActivityCategory[] = ["workshop", "meeting", "event", "showcase"];

export const labelColors = ["teal", "honey", "lavender", "vermilion", "lime", "pink"] as const;
export type LabelColor = (typeof labelColors)[number];

export function isStaffRole(role: AppRole) {
  return role === "staff" || role === "admin";
}
