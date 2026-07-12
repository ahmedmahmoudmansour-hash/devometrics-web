"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml } from "@/lib/email/template";

export type InquiryType = "sales" | "support" | "careers";

const INQUIRY_INBOX: Record<InquiryType, string> = {
  sales: "sales@devometrics.com",
  support: "support@devometrics.com",
  careers: "careers@devometrics.com",
};

const MAX_MESSAGE_LENGTH = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same in-memory, per-process, IP-keyed rate limit pattern as
// lib/auth/inviteGate.ts — this is a public, unauthenticated form, so IP is
// the only identity available. Not a hardened bound, just enough to stop
// casual spam/abuse.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, number[]>();

async function isRateLimited(): Promise<boolean> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const now = Date.now();
  const timestamps = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  attempts.set(ip, timestamps);
  return timestamps.length > MAX_ATTEMPTS;
}

export async function submitContactInquiry(fields: {
  type: InquiryType;
  name: string;
  email: string;
  message: string;
  // Hidden form field a real visitor never fills in — a filled honeypot
  // means a bot, so we pretend success without actually sending anything,
  // rather than telling the bot its submission was rejected (which just
  // teaches it to adjust).
  honeypot?: string;
}): Promise<{ success?: boolean; error?: string }> {
  if (fields.honeypot) return { success: true };

  if (await isRateLimited()) {
    return { error: "Too many requests — please wait a while and try again." };
  }

  if (!["sales", "support", "careers"].includes(fields.type)) {
    return { error: "Invalid inquiry type." };
  }
  const name = fields.name.trim();
  const email = fields.email.trim();
  const message = fields.message.trim();
  if (!name || !email || !message) {
    return { error: "Please fill in your name, email, and message." };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { error: "That message is too long." };
  }

  const supabase = await createClient();
  const { error: insertError } = await supabase.from("contact_inquiries").insert({
    type: fields.type,
    name,
    email,
    message,
  });
  if (insertError) {
    console.error("contact_inquiries insert failed:", insertError);
  }

  try {
    await sendEmail(
      INQUIRY_INBOX[fields.type],
      `New ${fields.type} inquiry from ${name}`,
      renderEmail({
        preheader: message.slice(0, 120),
        footerNote: "Submitted via the Devometrics contact form.",
        bodyHtml: `
          <h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">New ${escapeHtml(fields.type)} inquiry</h2>
          <p style="font-size:14px;margin:0 0 4px;"><strong>From:</strong> ${escapeHtml(name)}</p>
          <p style="font-size:14px;margin:0 0 20px;"><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}" style="color:#00C9A7;">${escapeHtml(email)}</a></p>
          <p style="font-size:15px;line-height:1.7;white-space:pre-wrap;margin:0;">${escapeHtml(message)}</p>
        `,
      })
    );
  } catch (err) {
    console.error("contact inquiry email failed:", err);
    // The DB row (if it saved) is still a real record even if the email
    // notification failed — only report total failure when both did.
    if (insertError) {
      return { error: "Could not send your message — please try again or email us directly." };
    }
  }

  return { success: true };
}
