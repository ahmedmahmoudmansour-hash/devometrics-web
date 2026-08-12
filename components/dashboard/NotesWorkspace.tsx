"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { createNote, updateNote, deleteNote, analyzeNote } from "@/lib/notes/actions";
import { createTask } from "@/lib/tasks/actions";
import type { NoteInsight, PersonalNote } from "@/lib/supabase/types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
  fontFamily: "inherit",
};

function NoteEditor({
  note,
  onDone,
}: {
  note: PersonalNote | null; // null = creating a new note
  onDone: () => void;
}) {
  const t = useTranslations("notesWorkspace");
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = note ? await updateNote(note.id, title, content) : await createNote(title, content);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("titlePlaceholder")}
        aria-label={t("noteTitleAria")}
        style={inputStyle}
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t("contentPlaceholder")}
        aria-label={t("noteContentAria")}
        rows={8}
        style={{ ...inputStyle, resize: "vertical" }}
      />
      {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? t("savingButton") : t("saveNoteButton")}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={isPending}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          {t("cancelButton")}
        </button>
      </div>
    </div>
  );
}

function InsightPanel({ noteId, initialInsight }: { noteId: string; initialInsight: NoteInsight | null }) {
  const t = useTranslations("notesWorkspace");
  const [insight, setInsight] = useState<NoteInsight | null>(initialInsight);
  const [error, setError] = useState<string | null>(null);
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();

  function organize() {
    setError(null);
    startTransition(async () => {
      const result = await analyzeNote(noteId);
      if (result.error) setError(result.error);
      else if (result.insight) setInsight(result.insight);
    });
  }

  function addAsTask(item: string, index: number) {
    startTransition(async () => {
      const result = await createTask({ title: item, recurring: "none" });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setAddedItems((prev) => new Set(prev).add(index));
    });
  }

  if (!insight) {
    return (
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={organize}
          disabled={isPending}
          style={{
            background: "rgba(var(--teal-rgb),0.1)",
            border: "1px solid rgba(var(--teal-rgb),0.3)",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--teal)",
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? t("organizingButton") : t("organizeWithAiButton")}
        </button>
        {error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 12,
        background: "rgba(var(--teal-rgb),0.06)",
        border: "1px solid rgba(var(--teal-rgb),0.2)",
        borderRadius: 10,
        padding: 14,
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--teal)", textTransform: "uppercase", marginBottom: 6 }}>
        {t("aiSummaryLabel")}
      </p>
      <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>{insight.summary}</p>
      {insight.actionItems.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--teal)", textTransform: "uppercase", marginTop: 12, marginBottom: 6 }}>
            {t("actionItemsLabel")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {insight.actionItems.map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>— {item}</span>
                {addedItems.has(i) ? (
                  <span style={{ fontSize: 11, color: "var(--teal)", fontWeight: 700, whiteSpace: "nowrap" }}>{t("addedToTasks")}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => addAsTask(item, i)}
                    disabled={isPending}
                    style={{
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t("addAsTaskButton")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  );
}

export default function NotesWorkspace({ initialNotes }: { initialNotes: PersonalNote[] }) {
  const t = useTranslations("notesWorkspace");
  const locale = useLocale();
  const dateLocale = locale === "ar" ? "ar-u-nu-latn" : "en-US";
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function remove(id: string) {
    startTransition(async () => {
      await deleteNote(id);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {creating ? (
        <div style={{ background: "var(--navy-mid)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 16, padding: 20 }}>
          <NoteEditor note={null} onDone={() => setCreating(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 10,
            padding: "12px 20px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          {t("newNoteButton")}
        </button>
      )}

      {initialNotes.length === 0 && !creating && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
            {t("emptyState")}
          </p>
        </div>
      )}

      {initialNotes.map((note) => (
        <div key={note.id} style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
          {editingId === note.id ? (
            <NoteEditor note={note} onDone={() => setEditingId(null)} />
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                    {note.title || t("untitledNote")}
                  </h2>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {new Date(note.updated_at).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setEditingId(note.id)}
                    style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
                  >
                    {t("editButton")}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(note.id)}
                    disabled={isPending}
                    style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
                  >
                    {t("deleteButton")}
                  </button>
                </div>
              </div>
              {note.content && (
                <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.7, marginTop: 12, whiteSpace: "pre-wrap" }}>
                  {note.content}
                </p>
              )}
              <InsightPanel noteId={note.id} initialInsight={note.ai_insight} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
