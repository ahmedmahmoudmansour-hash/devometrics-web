"use client";

import { useRef, useState } from "react";
import { updateAvatarUrl } from "@/app/dashboard/actions";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import type { Profile } from "@/lib/supabase/types";

const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3MB

function firstName(fullName: string | null | undefined): string | null {
  if (!fullName?.trim()) return null;
  return fullName.trim().split(/\s+/)[0];
}

export default function ProfileHeader({
  profile,
  membershipTitle,
  organizationName,
}: {
  profile: Profile | null;
  membershipTitle?: string | null;
  organizationName?: string | null;
}) {
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const name = firstName(profile?.full_name);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please choose an image file");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Image must be under 3MB");
      return;
    }

    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      const result = await updateAvatarUrl(publicUrl);
      if (result?.error) throw new Error(result.error);
      setAvatarUrl(publicUrl);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Could not upload image");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Avatar name={profile?.full_name ?? profile?.email ?? "?"} avatarUrl={avatarUrl} size={72} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
          aria-label="Change profile picture"
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "var(--teal)",
            border: "2px solid var(--navy)",
            color: "#0A0F1E",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          +
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          style={{ display: "none" }}
        />
      </div>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text)" }}>
          {name ? `Welcome back, ${name}` : "Welcome back"}
        </h1>
        {membershipTitle && (
          <p style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600, marginTop: 4 }}>
            {membershipTitle}
            {organizationName ? ` at ${organizationName}` : ""}
          </p>
        )}
        <p style={{ fontSize: 12, color: "var(--teal)", marginTop: 4 }}>
          {avatarUploading ? "Uploading…" : "Click the + to change your profile picture"}
        </p>
        {avatarError && <p style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>{avatarError}</p>}
      </div>
    </div>
  );
}
