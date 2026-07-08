"use client";

import { useRef, useState, useTransition } from "react";
import { updateOrganizationBranding } from "@/lib/organizations/actions";
import { createClient } from "@/lib/supabase/client";

const MAX_LOGO_BYTES = 3 * 1024 * 1024; // 3MB

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  display: "block",
  marginBottom: 6,
};

export default function OrganizationBrandingForm({
  organizationId,
  initial,
}: {
  organizationId: string;
  initial: { logoUrl: string | null; brandColor: string | null };
}) {
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [brandColor, setBrandColor] = useState(initial.brandColor ?? "#00C9A7");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateOrganizationBranding(organizationId, { logoUrl, brandColor });
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  // Either a pasted URL or an uploaded file works for the logo — uploading
  // just resolves to a real public URL in the same "org-logos" bucket used
  // by every workspace, then saves the same way the URL field would.
  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("Image must be under 3MB");
      return;
    }

    setLogoUploading(true);
    setError(null);
    setSaved(false);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const path = `${organizationId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from("org-logos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("org-logos").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      const result = await updateOrganizationBranding(organizationId, { logoUrl: publicUrl, brandColor });
      if (result?.error) throw new Error(result.error);
      setLogoUrl(publicUrl);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload logo");
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        Brand your workspace
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        Optional — your logo and accent color apply across every employee&apos;s dashboard in this
        workspace, not just this page.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Logo</label>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- user-uploaded or externally-hosted logo, not a static asset next/image can optimize meaningfully
              <img
                src={logoUrl}
                alt="Workspace logo preview"
                style={{ height: 40, width: "auto", maxWidth: 120, borderRadius: 6, background: "rgba(255,255,255,0.05)" }}
              />
            )}
            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => {
                  setLogoUrl(e.target.value);
                  setSaved(false);
                }}
                placeholder="https://yourcompany.com/logo.png"
                style={inputStyle}
              />
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 12,
                    color: "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  {logoUploading ? "Uploading…" : "Or upload an image"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFile}
                  style={{ display: "none" }}
                />
              </div>
            </div>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Accent color</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#00C9A7"}
              onChange={(e) => {
                setBrandColor(e.target.value);
                setSaved(false);
              }}
              aria-label="Pick accent color"
              style={{ width: 44, height: 36, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, background: "none", cursor: "pointer", padding: 2 }}
            />
            <input
              type="text"
              value={brandColor}
              onChange={(e) => {
                setBrandColor(e.target.value);
                setSaved(false);
              }}
              placeholder="#00C9A7"
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

        <button
          type="submit"
          disabled={isPending || logoUploading}
          style={{
            alignSelf: "flex-start",
            background: saved ? "rgba(0,201,167,0.1)" : "var(--teal)",
            color: saved ? "var(--teal)" : "#0A0F1E",
            border: saved ? "1px solid rgba(0,201,167,0.3)" : "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {saved ? "Saved" : "Save"}
        </button>
      </form>
    </div>
  );
}
