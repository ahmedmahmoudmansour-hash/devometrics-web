"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Certification } from "./types";

export async function listCertifications(): Promise<{ certifications: Certification[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { certifications: [] };

  const { data, error } = await supabase
    .from("certifications")
    .select("*")
    .eq("user_id", user.id)
    .order("expiry_date", { ascending: true, nullsFirst: false })
    .returns<Certification[]>();

  if (error) return { certifications: [], error: "not_migrated" };
  return { certifications: data ?? [] };
}

export async function createCertification(fields: {
  credentialName: string;
  issuer?: string | null;
  credentialId?: string | null;
  credentialUrl?: string | null;
  issuedDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const credentialName = fields.credentialName.trim();
  if (!credentialName) return { error: "Give the credential a name" };

  const { error } = await supabase.from("certifications").insert({
    user_id: user.id,
    credential_name: credentialName,
    issuer: fields.issuer?.trim() || null,
    credential_id: fields.credentialId?.trim() || null,
    credential_url: fields.credentialUrl?.trim() || null,
    issued_date: fields.issuedDate?.trim() || null,
    expiry_date: fields.expiryDate?.trim() || null,
    notes: fields.notes?.trim() || null,
  });
  if (error) {
    console.error("createCertification insert failed:", error);
    return { error: "Could not save — try again." };
  }

  revalidatePath("/dashboard/certifications");
  return { success: true };
}

export async function updateCertification(
  id: string,
  fields: Partial<{
    credentialName: string;
    issuer: string | null;
    credentialId: string | null;
    credentialUrl: string | null;
    issuedDate: string | null;
    expiryDate: string | null;
    notes: string | null;
  }>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (fields.credentialName !== undefined) patch.credential_name = fields.credentialName.trim();
  if (fields.issuer !== undefined) patch.issuer = fields.issuer?.trim() || null;
  if (fields.credentialId !== undefined) patch.credential_id = fields.credentialId?.trim() || null;
  if (fields.credentialUrl !== undefined) patch.credential_url = fields.credentialUrl?.trim() || null;
  if (fields.issuedDate !== undefined) patch.issued_date = fields.issuedDate?.trim() || null;
  if (fields.expiryDate !== undefined) patch.expiry_date = fields.expiryDate?.trim() || null;
  if (fields.notes !== undefined) patch.notes = fields.notes?.trim() || null;

  const { error } = await supabase.from("certifications").update(patch).eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Could not update — try again." };

  revalidatePath("/dashboard/certifications");
  return { success: true };
}

export async function deleteCertification(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("certifications").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Could not delete — try again." };

  revalidatePath("/dashboard/certifications");
  return { success: true };
}
