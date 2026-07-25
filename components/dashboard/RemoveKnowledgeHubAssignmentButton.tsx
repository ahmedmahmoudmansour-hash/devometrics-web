"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeKnowledgeHubAssignment } from "@/lib/knowledgeHub/actions";

export default function RemoveKnowledgeHubAssignmentButton({
  assignmentId,
  contentId,
}: {
  assignmentId: string;
  contentId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await removeKnowledgeHubAssignment(assignmentId, contentId);
          router.refresh();
        })
      }
      style={{
        background: "none",
        border: "none",
        color: "var(--text-muted)",
        fontSize: 12,
        cursor: "pointer",
        opacity: isPending ? 0.5 : 1,
      }}
    >
      Remove
    </button>
  );
}
