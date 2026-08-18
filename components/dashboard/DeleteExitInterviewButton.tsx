"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteExitInterview } from "@/lib/exitInterviews/actions";
import { useConfirmClick } from "@/lib/ui/useConfirmClick";

export default function DeleteExitInterviewButton({ id, label }: { id: string; label: string }) {
  const t = useTranslations("confirmActions");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { confirming, handleClick } = useConfirmClick(() => {
    startTransition(async () => {
      await deleteExitInterview(id);
      router.refresh();
    });
  });

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, cursor: "pointer", padding: 0 }}
    >
      {confirming ? t("clickAgainToConfirm") : label}
    </button>
  );
}
