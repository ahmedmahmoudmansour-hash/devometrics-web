"use client";

import { useCallback, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";

export type ResumableUploadStatus = "idle" | "uploading" | "success" | "error";

// Wraps tus-js-client for Supabase Storage's resumable-upload endpoint.
// Every detail below is verified against Supabase's current docs, not
// assumed from a general TUS integration:
//   - chunkSize MUST be exactly 6MB — Supabase's own docs are explicit
//     ("it must be set to 6MB (for now), do not change it").
//   - The endpoint is reached through the regular project URL + the
//     /storage/v1/upload/resumable path (the same gateway the plain
//     supabase.storage.upload() call already goes through) rather than the
//     dedicated {projectId}.storage.supabase.co subdomain Supabase's docs
//     also mention — this avoids parsing a project ref out of the URL for
//     no behavioral difference; switch to the dedicated subdomain only if
//     the gateway path is ever observed to be slower/less reliable.
//   - onBeforeRequest fires before EVERY HTTP request the client makes
//     (including the very first, upload-creation request), so it alone —
//     not a static headers object — is the mechanism for the auth header.
//     This matters specifically for long uploads: a bearer token fetched
//     once at upload start (~1h lifetime) could outlive a 500MB upload on
//     a slow connection. Fetching a fresh session before every chunk means
//     an expired token gets transparently refreshed by Supabase's client
//     mid-upload instead of failing late with a confusing 401.
export function useResumableUpload() {
  const [status, setStatus] = useState<ResumableUploadStatus>("idle");
  const [progress, setProgress] = useState(0); // 0-100
  const [error, setError] = useState<string | null>(null);
  const uploadRef = useRef<tus.Upload | null>(null);

  const start = useCallback((bucket: string, path: string, file: File): Promise<void> => {
    setStatus("uploading");
    setProgress(0);
    setError(null);

    return new Promise((resolve, reject) => {
      const supabase = createClient();
      const endpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`;

      const upload = new tus.Upload(file, {
        endpoint,
        retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
        chunkSize: 6 * 1024 * 1024,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: bucket,
          objectName: path,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },
        onBeforeRequest: async (req) => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) req.setHeader("authorization", `Bearer ${session.access_token}`);
        },
        onError: (err) => {
          setStatus("error");
          setError(err instanceof Error ? err.message : String(err));
          reject(err instanceof Error ? err : new Error(String(err)));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          setProgress(bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0);
        },
        onSuccess: () => {
          setStatus("success");
          setProgress(100);
          resolve();
        },
      });
      uploadRef.current = upload;

      // Resume across a page reload mid-upload, not just a mid-session
      // network drop — findPreviousUploads() is Supabase's own documented
      // pattern for this (upload URLs stay valid ~24h).
      upload
        .findPreviousUploads()
        .then((previousUploads) => {
          if (previousUploads.length > 0) upload.resumeFromPreviousUpload(previousUploads[0]);
          upload.start();
        })
        .catch(() => upload.start());
    });
  }, []);

  // Retries after the built-in retryDelays are exhausted and onError has
  // fired — calling .start() again on the same Upload instance resumes
  // from the last acknowledged offset rather than restarting from zero.
  const retry = useCallback(() => {
    if (!uploadRef.current) return;
    setStatus("uploading");
    setError(null);
    uploadRef.current.start();
  }, []);

  const cancel = useCallback(() => {
    uploadRef.current?.abort();
    uploadRef.current = null;
    setStatus("idle");
    setProgress(0);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    uploadRef.current = null;
    setStatus("idle");
    setProgress(0);
    setError(null);
  }, []);

  return { status, progress, error, start, retry, cancel, reset };
}
