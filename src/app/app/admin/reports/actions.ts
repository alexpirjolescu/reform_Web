"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function resolveReport(formData: FormData) {
  const admin = await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase
    .from("message_reports")
    .update({ status: "reviewed", reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("id", id.data);
  revalidatePath("/app/admin/reports");
}
