"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { importCareerProfileFromCV, updateCareerProfile } from "@/lib/profile/actions";
import type { JobHistoryEntry, QualificationEntry } from "@/lib/profile/extractCareerProfile";

const card: React.CSSProperties = {
  background: "var(--navy-mid)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 28,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
};

const smallButton: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
  cursor: "pointer",
};

export default function CareerProfileForm({
  initialJobHistory,
  initialSkills,
  initialQualifications,
  initialCareerAspirations,
}: {
  initialJobHistory: JobHistoryEntry[];
  initialSkills: string[];
  initialQualifications: QualificationEntry[];
  initialCareerAspirations: string;
}) {
  const t = useTranslations("careerProfileForm");
  const [jobHistory, setJobHistory] = useState<JobHistoryEntry[]>(initialJobHistory);
  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [qualifications, setQualifications] = useState<QualificationEntry[]>(initialQualifications);
  const [careerAspirations, setCareerAspirations] = useState(initialCareerAspirations);
  const [skillInput, setSkillInput] = useState("");
  const [isImporting, startImport] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleImport() {
    setError(null);
    startImport(async () => {
      const result = await importCareerProfileFromCV();
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.extracted) {
        setJobHistory(result.extracted.jobHistory);
        setSkills(result.extracted.skills);
        setQualifications(result.extracted.qualifications);
      }
    });
  }

  function addSkill() {
    const value = skillInput.trim();
    if (value && !skills.includes(value)) setSkills([...skills, value]);
    setSkillInput("");
  }

  function updateJobEntry(index: number, field: keyof JobHistoryEntry, value: string) {
    setJobHistory((prev) => prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  }

  function updateQualEntry(index: number, field: keyof QualificationEntry, value: string) {
    setQualifications((prev) => prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  }

  function handleSave() {
    setError(null);
    startSave(async () => {
      const result = await updateCareerProfile({ jobHistory, skills, qualifications, careerAspirations });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("title")}</h2>
        <button type="button" onClick={handleImport} disabled={isImporting} style={smallButton}>
          {isImporting ? t("readingCv") : t("importFromCv")}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        {t("description")}
      </p>
      {error && <p style={{ color: "#f87171", fontSize: 12, marginBottom: 16 }}>{error}</p>}

      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>{t("jobHistory")}</p>
        {jobHistory.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>{t("noRolesYet")}</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {jobHistory.map((entry, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  value={entry.title}
                  onChange={(e) => updateJobEntry(i, "title", e.target.value)}
                  placeholder={t("jobTitlePlaceholder")}
                  style={{ ...inputStyle, flex: "1 1 160px" }}
                />
                <input
                  value={entry.company}
                  onChange={(e) => updateJobEntry(i, "company", e.target.value)}
                  placeholder={t("companyPlaceholder")}
                  style={{ ...inputStyle, flex: "1 1 160px" }}
                />
                <input
                  value={entry.duration}
                  onChange={(e) => updateJobEntry(i, "duration", e.target.value)}
                  placeholder={t("durationPlaceholder")}
                  style={{ ...inputStyle, flex: "1 1 120px" }}
                />
              </div>
              <textarea
                value={entry.description}
                onChange={(e) => updateJobEntry(i, "description", e.target.value)}
                placeholder={t("roleDescriptionPlaceholder")}
                rows={2}
                style={{ ...inputStyle, resize: "vertical" }}
              />
              <button
                type="button"
                onClick={() => setJobHistory((prev) => prev.filter((_, idx) => idx !== i))}
                style={{ ...smallButton, alignSelf: "flex-start" }}
              >
                {t("remove")}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setJobHistory((prev) => [...prev, { title: "", company: "", duration: "", description: "" }])}
          style={{ ...smallButton, marginTop: 10 }}
        >
          {t("addRole")}
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>{t("skills")}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {skills.map((skill) => (
            <span
              key={skill}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(0,201,167,0.1)",
                border: "1px solid rgba(0,201,167,0.25)",
                borderRadius: 100,
                padding: "5px 10px",
                fontSize: 12,
                color: "var(--teal)",
              }}
            >
              {skill}
              <button
                type="button"
                onClick={() => setSkills((prev) => prev.filter((s) => s !== skill))}
                aria-label={t("removeSkillAriaLabel", { skill })}
                style={{ background: "none", border: "none", color: "var(--teal)", cursor: "pointer", fontSize: 12, padding: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addSkill();
              }
            }}
            placeholder={t("addSkillPlaceholder")}
            style={{ ...inputStyle, flex: "1 1 200px" }}
          />
          <button type="button" onClick={addSkill} style={smallButton}>
            {t("add")}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>{t("qualifications")}</p>
        {qualifications.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>{t("noneAddedYet")}</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {qualifications.map((entry, i) => (
            <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={entry.credential}
                onChange={(e) => updateQualEntry(i, "credential", e.target.value)}
                placeholder={t("credentialPlaceholder")}
                style={{ ...inputStyle, flex: "1 1 160px" }}
              />
              <input
                value={entry.institution}
                onChange={(e) => updateQualEntry(i, "institution", e.target.value)}
                placeholder={t("institutionPlaceholder")}
                style={{ ...inputStyle, flex: "1 1 160px" }}
              />
              <input
                value={entry.year}
                onChange={(e) => updateQualEntry(i, "year", e.target.value)}
                placeholder={t("yearPlaceholder")}
                style={{ ...inputStyle, flex: "0 1 90px" }}
              />
              <button
                type="button"
                onClick={() => setQualifications((prev) => prev.filter((_, idx) => idx !== i))}
                style={smallButton}
              >
                {t("remove")}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setQualifications((prev) => [...prev, { credential: "", institution: "", year: "" }])}
          style={{ ...smallButton, marginTop: 10 }}
        >
          {t("addQualification")}
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label htmlFor="career-aspirations" style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 8 }}>
          {t("careerAspirations")}
        </label>
        <textarea
          id="career-aspirations"
          value={careerAspirations}
          onChange={(e) => setCareerAspirations(e.target.value)}
          placeholder={t("careerAspirationsPlaceholder")}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        style={{
          background: saved ? "rgba(0,201,167,0.1)" : "var(--teal)",
          color: saved ? "var(--teal)" : "#0A0F1E",
          border: saved ? "1px solid rgba(0,201,167,0.3)" : "none",
          borderRadius: 8,
          padding: "10px 18px",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          opacity: isSaving ? 0.6 : 1,
        }}
      >
        {saved ? t("saved") : isSaving ? t("saving") : t("save")}
      </button>
    </div>
  );
}
