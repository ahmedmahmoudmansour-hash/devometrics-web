"use client";

import { useEffect, useRef, useState } from "react";

// Standardizes the "medium-stakes destructive action" confirmation pattern
// across the admin UI — no browser confirm() popup, no modal. First click
// arms the button (caller swaps its label to a confirm prompt); a second
// click within resetMs runs the action; otherwise it silently re-arms to
// the original state. Reserved for actions like revoking an invite or
// removing an assignment — DeleteCompanyButton's heavier type-the-name
// flow stays separate for genuinely irreversible, org-wide actions.
export function useConfirmClick(onConfirm: () => void, resetMs = 3000) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  function handleClick() {
    if (confirming) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setConfirming(false);
      onConfirm();
      return;
    }
    setConfirming(true);
    timerRef.current = setTimeout(() => setConfirming(false), resetMs);
  }

  return { confirming, handleClick };
}
