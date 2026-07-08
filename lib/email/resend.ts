// Thin wrapper around the Resend HTTP API — no SDK dependency needed, it's
// one fetch call. Resend over raw SMTP/nodemailer because it needs no
// mail server to run, has a generous free tier, and (once RESEND_FROM_EMAIL
// is on a verified devometrics.com domain) can send to any recipient, not
// just the account owner's own inbox like the sandbox sender.
//
// Deliberately throws instead of silently no-oping when unconfigured —
// callers must surface "email isn't set up yet" to the user rather than
// pretending a code was sent when it wasn't.
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Email sending isn't configured yet (missing RESEND_API_KEY / RESEND_FROM_EMAIL).");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Failed to send email (${res.status}): ${detail}`);
  }
}
