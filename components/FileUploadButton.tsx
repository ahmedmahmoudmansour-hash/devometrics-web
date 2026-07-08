"use client";

import { useRef, useState } from "react";

export default function FileUploadButton({
  onExtracted,
  label = "Upload PDF, DOC, or DOCX instead",
}: {
  onExtracted: (text: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract-text", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to read file");
      }
      const { text } = await res.json();
      onExtracted(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={handleChange}
        id="cv-file-upload"
        style={{ display: "none" }}
      />
      <label
        htmlFor="cv-file-upload"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--teal)",
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        {loading ? "Reading file…" : fileName ? `${label} (${fileName})` : label}
      </label>
      {error && <p style={{ color: "#f87171", fontSize: 11, marginTop: 4 }}>{error}</p>}
    </div>
  );
}
