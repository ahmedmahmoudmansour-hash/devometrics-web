"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExitInterview } from "@/lib/exitInterviews/actions";

export default function DeleteExitInterviewButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!confirm(label + "?")) return;
    startTransition(async () => {
      await deleteExitInterview(id);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={isPending}
      style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, cursor: "pointer", padding: 0 }}
    >
      {label}
    </button>
  );
}
