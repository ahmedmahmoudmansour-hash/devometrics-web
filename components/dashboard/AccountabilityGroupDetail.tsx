"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import {
  postAccountabilityCheckin,
  deleteAccountabilityCheckin,
  postAccountabilityReply,
  deleteAccountabilityReply,
  createAccountabilityAttachment,
  deleteAccountabilityAttachment,
  getSignedAccountabilityFileUrl,
  leaveAccountabilityGroup,
} from "@/lib/accountability/actions";
import { askAccountabilityGroupAI } from "@/lib/accountability/ai";
import {
  ACCOUNTABILITY_FILES_BUCKET,
  ACCOUNTABILITY_FILE_MAX_BYTES,
  ACCOUNTABILITY_FILE_ALLOWED_MIME_TYPES,
} from "@/lib/accountability/constants";
import type { AccountabilityGroup, AccountabilityGroupMember, AccountabilityCheckin } from "@/lib/accountability/types";

// t is passed in rather than called via a hook here, since this is a plain
// function (hooks can only be called from component bodies) — the caller
// already has it from its own useTranslations("accountabilityGroups") call.
function timeAgo(iso: string, t: ReturnType<typeof useTranslations>, dateLocale: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return t("justNow");
  if (mins < 60) return t("minutesAgo", { mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("hoursAgo", { hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("daysAgo", { days });
  return new Date(iso).toLocaleDateString(dateLocale);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentList({
  checkin,
  groupId,
  currentUserId,
  t,
}: {
  checkin: AccountabilityCheckin;
  groupId: string;
  currentUserId: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    if (!(ACCOUNTABILITY_FILE_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError(t("fileTypeNotSupported"));
      return;
    }
    if (file.size > ACCOUNTABILITY_FILE_MAX_BYTES) {
      setError(t("fileTooLarge"));
      return;
    }

    setUploading(true);
    try {
      const storagePath = `${groupId}/${checkin.id}/${Date.now()}_${sanitizeFileName(file.name)}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from(ACCOUNTABILITY_FILES_BUCKET).upload(storagePath, file);
      if (uploadError) throw new Error(uploadError.message);

      const result = await createAccountabilityAttachment({
        checkinId: checkin.id,
        groupId,
        storagePath,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function openFile(attachmentId: string) {
    const result = await getSignedAccountabilityFileUrl(attachmentId);
    if ("url" in result) window.open(result.url, "_blank", "noopener,noreferrer");
    else setError(result.error);
  }

  function remove(attachmentId: string) {
    startTransition(async () => {
      await deleteAccountabilityAttachment(attachmentId, groupId);
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      {checkin.attachments.map((a) => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px" }}>
          <button
            type="button"
            onClick={() => openFile(a.id)}
            style={{ background: "none", border: "none", color: "var(--teal)", fontSize: 12.5, cursor: "pointer", padding: 0, textAlign: "start", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            📎 {a.file_name}
          </button>
          <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{formatFileSize(a.file_size_bytes)}</span>
          {a.uploaded_by === currentUserId && (
            <button
              type="button"
              onClick={() => remove(a.id)}
              style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 11, cursor: "pointer", padding: 0, flexShrink: 0 }}
            >
              {t("deleteButton")}
            </button>
          )}
        </div>
      ))}
      {checkin.user_id === currentUserId && (
        <label style={{ fontSize: 11.5, color: "var(--text-muted)", cursor: uploading ? "wait" : "pointer", width: "fit-content" }}>
          {uploading ? t("uploading") : t("attachFileButton")}
          <input
            type="file"
            onChange={handleFile}
            disabled={uploading}
            accept={(ACCOUNTABILITY_FILE_ALLOWED_MIME_TYPES as readonly string[]).join(",")}
            style={{ display: "none" }}
          />
        </label>
      )}
      {error && <p style={{ color: "var(--danger)", fontSize: 11.5 }}>{error}</p>}
    </div>
  );
}

function ReplyThread({
  checkin,
  groupId,
  currentUserId,
  t,
  dateLocale,
}: {
  checkin: AccountabilityCheckin;
  groupId: string;
  currentUserId: string;
  t: ReturnType<typeof useTranslations>;
  dateLocale: string;
}) {
  const router = useRouter();
  const [replyText, setReplyText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await postAccountabilityReply(checkin.id, groupId, replyText);
      if (result?.error) setError(result.error);
      else {
        setReplyText("");
        router.refresh();
      }
    });
  }

  function removeReply(replyId: string) {
    startTransition(async () => {
      await deleteAccountabilityReply(replyId, groupId);
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
      {checkin.replies.map((r) => (
        <div key={r.id} style={{ display: "flex", gap: 8 }}>
          <Avatar name={r.full_name ?? t("memberFallbackName")} avatarUrl={r.avatar_url} size={20} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{r.full_name ?? t("memberFallbackName")}</span>
              <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{timeAgo(r.created_at, t, dateLocale)}</span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text)", marginTop: 2, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{r.content}</p>
            {r.user_id === currentUserId && (
              <button
                type="button"
                onClick={() => removeReply(r.id)}
                style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 10.5, cursor: "pointer", padding: 0, marginTop: 2 }}
              >
                {t("deleteButton")}
              </button>
            )}
          </div>
        </div>
      ))}
      <form onSubmit={submitReply} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder={t("replyPlaceholder")}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 12.5,
            color: "var(--text)",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={isPending || !replyText.trim()}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "var(--teal)", cursor: "pointer", opacity: isPending || !replyText.trim() ? 0.6 : 1 }}
        >
          {t("replyButton")}
        </button>
      </form>
      {error && <p style={{ color: "var(--danger)", fontSize: 11.5 }}>{error}</p>}
    </div>
  );
}

function GroupAiAssistant({ groupId, t }: { groupId: string; t: ReturnType<typeof useTranslations> }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setError(null);
    setAnswer(null);
    startTransition(async () => {
      const result = await askAccountabilityGroupAI(groupId, question);
      if (result.error) setError(result.error);
      else setAnswer(result.answer ?? null);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "rgba(var(--teal-rgb),0.08)",
          border: "1px dashed rgba(var(--teal-rgb),0.3)",
          borderRadius: 12,
          padding: "12px 16px",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--teal)",
          cursor: "pointer",
          width: "100%",
          textAlign: "start",
        }}
      >
        {t("askAiButton")}
      </button>
    );
  }

  return (
    <div style={{ background: "rgba(var(--teal-rgb),0.06)", border: "1px solid rgba(var(--teal-rgb),0.2)", borderRadius: 12, padding: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)", marginBottom: 8 }}>{t("askAiTitle")}</p>
      <form onSubmit={ask} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("askAiPlaceholder")}
          style={{
            flex: "1 1 220px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 13,
            color: "var(--text)",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={isPending || !question.trim()}
          style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending || !question.trim() ? 0.6 : 1 }}
        >
          {isPending ? t("askAiThinking") : t("askAiSubmit")}
        </button>
      </form>
      {error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{error}</p>}
      {answer && (
        <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, marginTop: 12, whiteSpace: "pre-wrap" }}>{answer}</p>
      )}
    </div>
  );
}

export default function AccountabilityGroupDetail({
  group,
  members,
  checkins: initialCheckins,
  isCreator,
  currentUserId,
}: {
  group: AccountabilityGroup;
  members: AccountabilityGroupMember[];
  checkins: AccountabilityCheckin[];
  isCreator: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const t = useTranslations("accountabilityGroups");
  const locale = useLocale();
  const dateLocale = locale === "ar" ? "ar-u-nu-latn" : "en-US";
  const [checkins, setCheckins] = useState(initialCheckins);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await postAccountabilityCheckin(group.id, content);
      if (result?.error) setError(result.error);
      else {
        setContent("");
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteAccountabilityCheckin(id, group.id);
      if (!result?.error) setCheckins((prev) => prev.filter((c) => c.id !== id));
    });
  }

  function leave() {
    const prompt = isCreator
      ? t("leaveConfirmCreator", { name: group.name })
      : t("leaveConfirmMember", { name: group.name });
    if (!confirm(prompt)) return;
    startTransition(async () => {
      const result = await leaveAccountabilityGroup(group.id);
      if (!result?.error) router.push("/dashboard/accountability");
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 20, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <GroupAiAssistant groupId={group.id} t={t} />

        <form onSubmit={submit} style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("checkinPlaceholder")}
            style={{
              width: "100%",
              minHeight: 70,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13.5,
              color: "var(--text)",
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          {error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button
              type="submit"
              disabled={isPending || !content.trim()}
              style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending || !content.trim() ? 0.6 : 1 }}
            >
              {t("postCheckinButton")}
            </button>
          </div>
        </form>

        {checkins.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{t("noCheckinsYet")}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {checkins.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 10, background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                <Avatar name={c.full_name ?? t("memberFallbackName")} avatarUrl={c.avatar_url} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{c.full_name ?? t("memberFallbackName")}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{timeAgo(c.created_at, t, dateLocale)}</span>
                  </div>
                  <p style={{ fontSize: 13.5, color: "var(--text)", marginTop: 4, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{c.content}</p>
                  {c.user_id === currentUserId && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      style={{ marginTop: 6, background: "none", border: "none", color: "var(--danger)", fontSize: 11.5, cursor: "pointer", padding: 0 }}
                    >
                      {t("deleteButton")}
                    </button>
                  )}

                  <AttachmentList checkin={c} groupId={group.id} currentUserId={currentUserId} t={t} />
                  <ReplyThread checkin={c} groupId={group.id} currentUserId={currentUserId} t={t} dateLocale={dateLocale} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            {t("membersHeading", { count: members.length })}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {members.map((m) => (
              <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar name={m.full_name ?? t("memberFallbackName")} avatarUrl={m.avatar_url} size={22} />
                <span style={{ fontSize: 12.5, color: "var(--text)" }}>{m.full_name ?? t("memberFallbackName")}</span>
                {group.created_by === m.user_id && <span style={{ fontSize: 10, color: "var(--amber)" }}>{t("creatorBadge")}</span>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            {t("inviteCodeHeading")}
          </p>
          <p style={{ fontSize: 16, fontWeight: 800, color: "var(--teal)", letterSpacing: "0.06em" }}>{group.invite_code}</p>
        </div>

        <button
          type="button"
          onClick={leave}
          disabled={isPending}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "var(--danger)", cursor: "pointer" }}
        >
          {t("leaveGroupButton")}
        </button>
      </div>
    </div>
  );
}
