"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { removeKnowledgeHubAssignment } from "@/lib/knowledgeHub/actions";
import { useConfirmClick } from "@/lib/ui/useConfirmClick";

export default function RemoveKnowledgeHubAssignmentButton({
  assignmentId,
  contentId,
}: {
  assignmentId: string;
  contentId: string;
}) {
  const t = useTranslations("removeKnowledgeHubAssignmentButton");
  const tConfirm = useTranslations("confirmActions");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const { confirming, handleClick } = useConfirmClick(() => {
    startTransition(async () => {
      await removeKnowledgeHubAssignment(assignmentId, contentId);
      router.refresh();
    });
  });

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      style={{
        background: "none",
        border: "none",
        color: "var(--text-muted)",
        fontSize: 12,
        cursor: "pointer",
        opacity: isPending ? 0.5 : 1,
      }}
    >
      {confirming ? tConfirm("clickAgainToConfirm") : t("remove")}
    </button>
  );
}
