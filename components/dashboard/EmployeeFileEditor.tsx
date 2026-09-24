"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  saveMyEmployeeFile,
  saveEmployeeFileAsAdmin,
  addDependent,
  removeDependent,
  attachEmployeeDocument,
  getEmployeeDocumentUrl,
  removeEmployeeDocument,
  type EmployeeFileBundle,
} from "@/lib/employeeFile/actions";
import {
  EMPLOYEE_DOCUMENTS_BUCKET,
  EMPTY_EMPLOYEE_FILE,
  MARITAL_STATUSES,
  EMPLOYMENT_TYPES,
  DEPENDENT_RELATIONS,
  EMPLOYEE_DOC_TYPES,
  ALL_DOC_TYPES,
  type EmployeeFileData,
} from "@/lib/employeeFile/constants";

const cardStyle: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 };
const fieldStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
  width: "100%",
};
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" };
const titleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" };
const hintStyle: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px", lineHeight: 1.6 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 };
const btnPrimary: React.CSSProperties = { background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" };

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// One editor for both sides of the same record: `mode="self"` is the
// employee's own file (hiring/employment details shown read-only), `mode="hr"`
// is an admin editing someone's file (everything editable, contracts and offer
// letters can be added). Optional sections a company switched off are hidden.
export default function EmployeeFileEditor({
  mode,
  organizationId,
  userId,
  initial,
  disabledSections,
}: {
  mode: "self" | "hr";
  organizationId: string;
  userId: string;
  initial: EmployeeFileBundle;
  disabledSections: string[];
}) {
  const t = useTranslations("employeeFile");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const off = new Set(disabledSections);

  const [data, setData] = useState<EmployeeFileData>(initial.profile ?? EMPTY_EMPLOYEE_FILE);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dependents, setDependents] = useState(initial.dependents);
  const [depName, setDepName] = useState("");
  const [depRelation, setDepRelation] = useState("child");
  const [depDob, setDepDob] = useState("");
  const [depError, setDepError] = useState<string | null>(null);

  const [documents, setDocuments] = useState(initial.documents);
  const [docType, setDocType] = useState(mode === "hr" ? "contract" : "national_id");
  const [docTitle, setDocTitle] = useState("");
  const [docExpires, setDocExpires] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [docBusy, setDocBusy] = useState(false);

  const set = (key: keyof EmployeeFileData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSaved(false);
    setData((prev) => ({ ...prev, [key]: e.target.value }));
  };

  function field(key: keyof EmployeeFileData, label: string, type = "text", readOnly = false) {
    return (
      <div key={key}>
        <label style={labelStyle}>{label}</label>
        <input type={type} value={data[key]} onChange={set(key)} readOnly={readOnly} style={{ ...fieldStyle, opacity: readOnly ? 0.7 : 1 }} />
      </div>
    );
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = mode === "hr" ? await saveEmployeeFileAsAdmin(organizationId, userId, data) : await saveMyEmployeeFile(data);
      if ("error" in result) setError(result.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  function handleAddDependent(e: React.FormEvent) {
    e.preventDefault();
    setDepError(null);
    startTransition(async () => {
      const result = await addDependent(organizationId, userId, { fullName: depName, relation: depRelation, dateOfBirth: depDob, notes: "" });
      if ("error" in result) return setDepError(result.error);
      setDependents((prev) => [...prev, { id: result.id, fullName: depName.trim(), relation: depRelation, dateOfBirth: depDob, notes: "" }]);
      setDepName("");
      setDepDob("");
    });
  }

  function handleRemoveDependent(id: string) {
    startTransition(async () => {
      const result = await removeDependent(id);
      if (!("error" in result)) setDependents((prev) => prev.filter((d) => d.id !== id));
    });
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setDocError(null);
    if (!docFile) return setDocError(t("chooseFileError"));
    if (!docTitle.trim()) return setDocError(t("titleError"));
    setDocBusy(true);
    try {
      const supabase = createClient();
      const storagePath = `${organizationId}/${userId}/${crypto.randomUUID()}-${sanitizeFileName(docFile.name)}`;
      const { error: uploadError } = await supabase.storage.from(EMPLOYEE_DOCUMENTS_BUCKET).upload(storagePath, docFile);
      if (uploadError) {
        setDocError(t("uploadFailed"));
        return;
      }
      const result = await attachEmployeeDocument(organizationId, userId, { docType, title: docTitle, storagePath, fileName: docFile.name, expiresOn: docExpires });
      if ("error" in result) {
        setDocError(result.error);
        return;
      }
      setDocTitle("");
      setDocExpires("");
      setDocFile(null);
      router.refresh();
      setDocuments((prev) => [
        { id: `pending-${storagePath}`, docType, title: docTitle.trim(), fileName: docFile.name, expiresOn: docExpires, uploadedByHr: mode === "hr", createdAt: new Date().toISOString() },
        ...prev,
      ]);
    } finally {
      setDocBusy(false);
    }
  }

  function handleViewDocument(id: string) {
    startTransition(async () => {
      const result = await getEmployeeDocumentUrl(id);
      if ("url" in result) window.open(result.url, "_blank", "noopener,noreferrer");
      else setDocError(result.error);
    });
  }

  function handleRemoveDocument(id: string) {
    startTransition(async () => {
      const result = await removeEmployeeDocument(id);
      if ("error" in result) setDocError(result.error);
      else setDocuments((prev) => prev.filter((d) => d.id !== id));
    });
  }

  // Fixed at first render (a lazy initializer, not a render-time clock read):
  // "expiring soon" means within 60 days of when the page was opened.
  const [{ today, soon }] = useState(() => {
    const now = Date.now();
    return { today: new Date(now).toISOString().slice(0, 10), soon: new Date(now + 60 * 86400000).toISOString().slice(0, 10) };
  });
  const docTypes = mode === "hr" ? ALL_DOC_TYPES : EMPLOYEE_DOC_TYPES;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>{t("personalTitle")}</h2>
        <p style={hintStyle}>{mode === "hr" ? t("personalHintHr") : t("personalHintSelf")}</p>
        <div style={gridStyle}>
          {field("legalName", t("legalName"))}
          {field("dateOfBirth", t("dateOfBirth"), "date")}
          {field("gender", t("gender"))}
          {field("nationality", t("nationality"))}
          {field("nationalId", t("nationalId"))}
          <div>
            <label style={labelStyle}>{t("maritalStatus")}</label>
            <select value={data.maritalStatus} onChange={set("maritalStatus")} style={fieldStyle}>
              <option value="">{t("notSpecified")}</option>
              {MARITAL_STATUSES.map((m) => (
                <option key={m} value={m}>
                  {t(`marital_${m}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>{t("employmentTitle")}</h2>
        <p style={hintStyle}>{mode === "hr" ? t("employmentHintHr") : t("employmentHintSelf")}</p>
        <div style={gridStyle}>
          {field("hireDate", t("hireDate"), "date", mode !== "hr")}
          <div>
            <label style={labelStyle}>{t("employmentType")}</label>
            <select value={data.employmentType} onChange={set("employmentType")} disabled={mode !== "hr"} style={{ ...fieldStyle, opacity: mode !== "hr" ? 0.7 : 1 }}>
              <option value="">{t("notSpecified")}</option>
              {EMPLOYMENT_TYPES.map((m) => (
                <option key={m} value={m}>
                  {t(`type_${m}`)}
                </option>
              ))}
            </select>
          </div>
          {field("probationEndDate", t("probationEnd"), "date", mode !== "hr")}
        </div>
      </div>

      {!off.has("contact") && (
        <div style={cardStyle}>
          <h2 style={titleStyle}>{t("contactTitle")}</h2>
          <p style={hintStyle}>{t("contactHint")}</p>
          <div style={gridStyle}>
            {field("personalPhone", t("personalPhone"), "tel")}
            {field("personalEmail", t("personalEmail"), "email")}
            {field("addressLine1", t("addressLine1"))}
            {field("addressLine2", t("addressLine2"))}
            {field("city", t("city"))}
            {field("region", t("region"))}
            {field("postalCode", t("postalCode"))}
            {field("country", t("country"))}
          </div>
        </div>
      )}

      {!off.has("emergency") && (
        <div style={cardStyle}>
          <h2 style={titleStyle}>{t("emergencyTitle")}</h2>
          <p style={hintStyle}>{t("emergencyHint")}</p>
          <div style={gridStyle}>
            {field("emergencyContactName", t("emergencyName"))}
            {field("emergencyContactRelation", t("emergencyRelation"))}
            {field("emergencyContactPhone", t("emergencyPhone"), "tel")}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={handleSave} disabled={isPending} style={{ ...btnPrimary, opacity: isPending ? 0.6 : 1 }}>
          {isPending ? t("saving") : t("saveButton")}
        </button>
        {saved && <span style={{ color: "var(--teal)", fontSize: 13 }}>{t("saved")}</span>}
        {error && <span style={{ color: "var(--danger)", fontSize: 13 }}>{error}</span>}
      </div>

      {!off.has("family") && (
        <div style={cardStyle}>
          <h2 style={titleStyle}>{t("familyTitle")}</h2>
          <p style={hintStyle}>{t("familyHint")}</p>
          {dependents.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{t("noFamily")}</p>
          ) : (
            <div style={{ marginBottom: 14 }}>
              {dependents.map((d) => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                  <span style={{ color: "var(--text)" }}>
                    <strong>{d.fullName}</strong> <span style={{ color: "var(--text-muted)" }}>— {t(`relation_${d.relation}`)}{d.dateOfBirth ? ` · ${d.dateOfBirth}` : ""}</span>
                  </span>
                  <button type="button" disabled={isPending} onClick={() => handleRemoveDependent(d.id)} style={btnGhost}>
                    {t("remove")}
                  </button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleAddDependent}>
            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>{t("depName")}</label>
                <input value={depName} onChange={(e) => setDepName(e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t("depRelation")}</label>
                <select value={depRelation} onChange={(e) => setDepRelation(e.target.value)} style={fieldStyle}>
                  {DEPENDENT_RELATIONS.map((r) => (
                    <option key={r} value={r}>
                      {t(`relation_${r}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t("depDob")}</label>
                <input type="date" value={depDob} onChange={(e) => setDepDob(e.target.value)} style={fieldStyle} />
              </div>
            </div>
            <button type="submit" disabled={isPending} style={{ ...btnPrimary, marginTop: 12, opacity: isPending ? 0.6 : 1 }}>
              {t("addFamily")}
            </button>
            {depError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{depError}</p>}
          </form>
        </div>
      )}

      {!off.has("documents") && (
        <div style={cardStyle}>
          <h2 style={titleStyle}>{t("documentsTitle")}</h2>
          <p style={hintStyle}>{mode === "hr" ? t("documentsHintHr") : t("documentsHintSelf")}</p>
          {documents.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{t("noDocuments")}</p>
          ) : (
            <div style={{ marginBottom: 14 }}>
              {documents.map((d) => {
                const expired = d.expiresOn && d.expiresOn < today;
                const expiring = d.expiresOn && !expired && d.expiresOn <= soon;
                const canRemove = mode === "hr" || !d.uploadedByHr;
                return (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                    <span style={{ color: "var(--text)", minWidth: 0 }}>
                      <strong>{d.title}</strong> <span style={{ color: "var(--text-muted)" }}>— {t(`doc_${d.docType}`)}</span>
                      {d.expiresOn && (
                        <span style={{ marginInlineStart: 8, color: expired ? "var(--danger)" : expiring ? "var(--amber)" : "var(--text-muted)" }}>
                          {expired ? t("expired", { date: d.expiresOn }) : t("expires", { date: d.expiresOn })}
                        </span>
                      )}
                    </span>
                    <span style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                      {!d.id.startsWith("pending-") && (
                        <button type="button" disabled={isPending} onClick={() => handleViewDocument(d.id)} style={btnGhost}>
                          {t("view")}
                        </button>
                      )}
                      {canRemove && !d.id.startsWith("pending-") && (
                        <button type="button" disabled={isPending} onClick={() => handleRemoveDocument(d.id)} style={btnGhost}>
                          {t("remove")}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <form onSubmit={handleUpload}>
            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>{t("docType")}</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} style={fieldStyle}>
                  {docTypes.map((d) => (
                    <option key={d} value={d}>
                      {t(`doc_${d}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t("docTitle")}</label>
                <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t("docExpires")}</label>
                <input type="date" value={docExpires} onChange={(e) => setDocExpires(e.target.value)} style={fieldStyle} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13, color: "var(--text-muted)" }} aria-label={t("chooseFile")} />
              <button type="submit" disabled={docBusy} style={{ ...btnPrimary, opacity: docBusy ? 0.6 : 1 }}>
                {docBusy ? t("uploading") : t("uploadButton")}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{t("fileLimits")}</p>
            {docError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{docError}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
