"use client";

import { useState, useTransition } from "react";
import {
  createCertification,
  updateCertification,
  deleteCertification,
  listCertifications,
} from "@/lib/certifications/actions";
import { expiryStatus, type Certification, type ExpiryStatus } from "@/lib/certifications/types";

const STATUS_STYLE: Record<ExpiryStatus, { color: string; label: string }> = {
  expired: { color: "248,113,113", label: "Expired" },
  soon: { color: "240,184,64", label: "Expiring soon" },
  ok: { color: "0,201,167", label: "Valid" },
  none: { color: "148,163,184", label: "No expiry" },
};

function inputStyle(): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    color: "var(--text)",
    outline: "none",
    width: "100%",
  };
}

function labelStyle(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" };
}

function AddCertificationForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [credentialName, setCredentialName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [credentialUrl, setCredentialUrl] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setCredentialName("");
    setIssuer("");
    setCredentialUrl("");
    setIssuedDate("");
    setExpiryDate("");
    setOpen(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCertification({ credentialName, issuer, credentialUrl, issuedDate, expiryDate });
      if (result?.error) setError(result.error);
      else {
        reset();
        onAdded();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "rgba(0,201,167,0.1)",
          border: "1px solid rgba(0,201,167,0.3)",
          borderRadius: 10,
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--teal)",
          cursor: "pointer",
        }}
      >
        + Add certification
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle()}>Credential name *</label>
          <input style={inputStyle()} value={credentialName} onChange={(e) => setCredentialName(e.target.value)} required autoFocus placeholder="AWS Solutions Architect — Associate" />
        </div>
        <div>
          <label style={labelStyle()}>Issuer</label>
          <input style={inputStyle()} value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Amazon Web Services" />
        </div>
        <div>
          <label style={labelStyle()}>Credential URL</label>
          <input style={inputStyle()} value={credentialUrl} onChange={(e) => setCredentialUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label style={labelStyle()}>Issued date</label>
          <input type="date" style={inputStyle()} value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle()}>Expiry date</label>
          <input type="date" style={inputStyle()} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </div>
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={isPending}
          style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={reset}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function CertificationCard({ cert, onChanged }: { cert: Certification; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [credentialId, setCredentialId] = useState(cert.credential_id ?? "");
  const [notes, setNotes] = useState(cert.notes ?? "");
  const [expiryDate, setExpiryDate] = useState(cert.expiry_date ?? "");
  const [isPending, startTransition] = useTransition();
  const status = expiryStatus(cert.expiry_date);
  const style = STATUS_STYLE[status];

  function saveDetails() {
    startTransition(async () => {
      await updateCertification(cert.id, { credentialId, notes, expiryDate });
      onChanged();
    });
  }

  function remove() {
    if (!confirm(`Remove ${cert.credential_name}?`)) return;
    startTransition(async () => {
      await deleteCertification(cert.id);
      onChanged();
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>{cert.credential_name}</p>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
            {cert.issuer || "Issuer not set"}
            {cert.expiry_date ? ` · expires ${new Date(cert.expiry_date).toLocaleDateString()}` : ""}
          </p>
          {cert.credential_url && (
            <a href={cert.credential_url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--teal)" }}>
              View credential ↗
            </a>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              background: `rgba(${style.color},0.12)`,
              border: `1px solid rgba(${style.color},0.35)`,
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 700,
              color: `rgb(${style.color})`,
              whiteSpace: "nowrap",
            }}
          >
            {style.label}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}
          >
            {expanded ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle()}>Credential ID</label>
              <input style={inputStyle()} value={credentialId} onChange={(e) => setCredentialId(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle()}>Expiry date</label>
              <input type="date" style={inputStyle()} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle()}>Notes</label>
            <textarea
              style={{ ...inputStyle(), minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Renewal process, CE hours needed…"
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={saveDetails}
              disabled={isPending}
              style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
            >
              {isPending ? "Saving…" : "Save details"}
            </button>
            <button type="button" onClick={remove} disabled={isPending} style={{ background: "none", border: "none", color: "#f87171", fontSize: 12, cursor: "pointer" }}>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CertificationsView({ initial }: { initial: Certification[] }) {
  const [certifications, setCertifications] = useState(initial);
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await listCertifications();
      setCertifications(result.certifications);
    });
  }

  const expiredCount = certifications.filter((c) => expiryStatus(c.expiry_date) === "expired").length;
  const soonCount = certifications.filter((c) => expiryStatus(c.expiry_date) === "soon").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", minWidth: 120 }}>
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{certifications.length}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Tracked</p>
        </div>
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", minWidth: 120 }}>
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--amber)" }}>{soonCount}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Expiring soon</p>
        </div>
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", minWidth: 120 }}>
          <p style={{ fontSize: 20, fontWeight: 800, color: "#f87171" }}>{expiredCount}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Expired</p>
        </div>
      </div>

      <AddCertificationForm onAdded={refresh} />

      {certifications.length === 0 ? (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No certifications tracked yet — add your first one above.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {certifications.map((cert) => (
            <CertificationCard key={cert.id} cert={cert} onChanged={refresh} />
          ))}
        </div>
      )}
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
        Private to you. If a credential has an expiry date within 30 days, you&apos;ll get an email
        reminder — at most one every few days, not a daily nag.
      </p>
    </div>
  );
}
