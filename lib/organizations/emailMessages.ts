"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { EmailMessageType, EmailMessageOverride } from "./emailMessageTypes";

const MAX_SUBJECT_LENGTH = 150;
const MAX_MESSAGE_LENGTH = 1000;

export async function getOrganizationEmailMessages(
  organizationId: string
): Promise<Partial<Record<EmailMessageType, EmailMessageOverride>>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_email_messages")
    .select("email_type, custom_subject, custom_message")
    .eq("organization_id", organizationId)
    .returns<{ email_type: EmailMessageType; custom_subject: string | null; custom_message: string | null }[]>();

  const result: Partial<Record<EmailMessageType, EmailMessageOverride>> = {};
  for (const row of data ?? []) {
    result[row.email_type] = { subject: row.custom_subject ?? "", message: row.custom_message ?? "" };
  }
  return result;
}

// One save per email type — an empty subject AND message deletes the
// override entirely (reverts to the standard Devometrics copy) rather
// than storing an empty row, so "clear the field and save" is the
// documented way back to default. RLS (is_org_admin) is the actual
// enforcement here, same posture as updateOrganizationBranding/Profile —
// this app has no service-role key, so there's no privileged path that
// could write into an org this user doesn't admin even if this check were
// skipped entirely.
export async function updateOrganizationEmailMessage(
  organizationId: string,
  emailType: EmailMessageType,
  fields: { subject: string; message: string }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const subject = fields.subject.trim().slice(0, MAX_SUBJECT_LENGTH);
  const message = fields.message.trim().slice(0, MAX_MESSAGE_LENGTH);

  if (!subject && !message) {
    const { error } = await supabase
      .from("organization_email_messages")
      .delete()
      .eq("organization_id", organizationId)
      .eq("email_type", emailType);
    if (error) return { error: "Could not reset this email — try again." };
    revalidatePath("/dashboard/company");
    return { success: true };
  }

  const { error } = await supabase.from("organization_email_messages").upsert(
    {
      organization_id: organizationId,
      email_type: emailType,
      custom_subject: subject || null,
      custom_message: message || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,email_type" }
  );
  if (error) return { error: "Could not save this email — the database may need migration 0101 run first." };

  revalidatePath("/dashboard/company");
  return { success: true };
}
