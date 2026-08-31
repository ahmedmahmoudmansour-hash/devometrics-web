"use client";

import { useEffect, useRef } from "react";
import { submitScormCompletion } from "@/lib/knowledgeHub/scorm/actions";

type CmiData = Record<string, string>;

declare global {
  interface Window {
    // The SCORM 1.2 runtime API surface — the content inside the iframe
    // discovers this by walking window.parent (then .parent.parent, ...)
    // looking for an object literally named "API". Only reachable because
    // the content is served same-origin via the scorm proxy route (see
    // that route's header comment) — a cross-origin iframe could never
    // read this property at all, sandbox attributes notwithstanding.
    API?: {
      LMSInitialize: (param: string) => string;
      LMSFinish: (param: string) => string;
      LMSGetValue: (element: string) => string;
      LMSSetValue: (element: string, value: string) => string;
      LMSCommit: (param: string) => string;
      LMSGetLastError: () => string;
      LMSGetErrorString: (errorCode: string) => string;
      LMSGetDiagnostic: (errorCode: string) => string;
    };
  }
}

// Implements just enough of the SCORM 1.2 Run-Time Environment to launch
// real content and capture its outcome — all 8 required API methods exist
// (some packages check for their presence even if they never call them),
// but the CMI data model behind LMSGetValue/LMSSetValue is a plain
// in-memory bag, not a full spec-compliant model: no real
// suspend-data/bookmark persistence across sessions, no sequencing. That
// matches this MVP's explicit scope (SCORM 1.2 only, no sequencing, no
// advanced suspend-data) — a content package that only needs
// initialize/set score/set status/finish (the overwhelming majority of
// simple training SCOs) works correctly; one that depends on resuming
// exactly where a previous session left off does not, yet.
export default function KnowledgeHubScormRuntime({
  contentId,
  launchUrl,
  title,
  studentName,
}: {
  contentId: string;
  launchUrl: string;
  title: string;
  studentName: string;
}) {
  // Refs, not state — this is the imperative SCORM API surface, called
  // synchronously by content running inside the iframe, entirely outside
  // React's render cycle. Nothing here should trigger a re-render.
  const cmiRef = useRef<CmiData>({
    "cmi.core.student_name": studentName,
    "cmi.core.student_id": "",
    "cmi.core.lesson_status": "not attempted",
    "cmi.core.credit": "credit",
    "cmi.core.entry": "ab-initio",
    "cmi.core.score.raw": "",
    "cmi.suspend_data": "",
    "cmi.core.lesson_location": "",
  });
  const initializedRef = useRef(false);
  const submittedRef = useRef(false);
  const lastErrorRef = useRef("0");

  useEffect(() => {
    async function submitOnce() {
      if (submittedRef.current) return;
      submittedRef.current = true;
      const scoreRawText = cmiRef.current["cmi.core.score.raw"];
      const lessonStatus = cmiRef.current["cmi.core.lesson_status"] || "incomplete";
      await submitScormCompletion(contentId, {
        scoreRaw: scoreRawText ? Number(scoreRawText) : null,
        lessonStatus,
        cmiData: cmiRef.current,
      });
    }

    window.API = {
      LMSInitialize: () => {
        initializedRef.current = true;
        lastErrorRef.current = "0";
        return "true";
      },
      LMSFinish: () => {
        lastErrorRef.current = "0";
        void submitOnce();
        return "true";
      },
      LMSGetValue: (element: string) => {
        lastErrorRef.current = "0";
        return cmiRef.current[element] ?? "";
      },
      LMSSetValue: (element: string, value: string) => {
        cmiRef.current[element] = value;
        lastErrorRef.current = "0";
        return "true";
      },
      LMSCommit: () => {
        // Deliberately a no-op beyond acknowledging success: persisting on
        // every Commit (which real content calls far more often than
        // Finish — once per slide/section is common) would flood
        // knowledge_hub_completions' append-only history with one row per
        // checkpoint instead of one row per real attempt. The actual
        // completion write happens once, on LMSFinish (or the pagehide
        // fallback below).
        lastErrorRef.current = "0";
        return "true";
      },
      LMSGetLastError: () => lastErrorRef.current,
      LMSGetErrorString: () => "No error",
      LMSGetDiagnostic: () => "",
    };

    // Fallback for the common real-world case of a learner closing the tab
    // or navigating away mid-course without the SCO ever calling
    // LMSFinish. Best-effort only — a fire-and-forget async call started
    // during pagehide has no guarantee of completing before the page is
    // actually gone, so a session that ends this way can still lose its
    // completion; a fully reliable version would need navigator.sendBeacon
    // against a plain HTTP endpoint rather than a Next.js server action,
    // which is more than this MVP's scope justifies.
    function handleUnload() {
      if (initializedRef.current && !submittedRef.current) void submitOnce();
    }
    window.addEventListener("pagehide", handleUnload);

    return () => {
      window.removeEventListener("pagehide", handleUnload);
      delete window.API;
    };
  }, [contentId]);

  return (
    <iframe
      src={launchUrl}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-forms"
      style={{ width: "100%", height: 600, border: "none", borderRadius: 8, background: "#fff" }}
    />
  );
}
