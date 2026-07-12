const BRAND_TEAL = "#00C9A7";
const BRAND_NAVY = "#0A0F1E";

// Shared branded shell for every transactional email this app sends — a
// dark-navy header (matching the app's own brand), a white content card,
// and a consistent footer. Before this, each caller hand-rolled its own
// bare HTML with no logo, no footer, and no visual link back to the
// product — this is the one place that changes if the brand ever does.
//
// Inline styles only, no external stylesheet or webfonts: email clients
// (especially Outlook) strip <style> blocks and won't fetch remote CSS/
// fonts reliably, so anything that needs to render has to be inline.
export function renderEmail({
  preheader,
  bodyHtml,
  footerNote,
}: {
  // Hidden preview text shown next to the subject line in inbox lists
  // (Gmail, Apple Mail, etc.) — without one, clients fall back to grabbing
  // the first visible text in the body, which is usually an awkward
  // fragment of the heading.
  preheader?: string;
  bodyHtml: string;
  footerNote?: string;
}): string {
  return `
  <div style="background:#f4f6f8; padding:32px 16px; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>` : ""}
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e9ef;">
      <div style="background:${BRAND_NAVY};padding:22px 32px;">
        <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Devometrics</span>
      </div>
      <div style="padding:32px;color:#1a2236;">
        ${bodyHtml}
      </div>
      <div style="padding:20px 32px;border-top:1px solid #eef1f5;">
        <p style="font-size:12px;color:#8892a4;line-height:1.6;margin:0;">
          ${footerNote ?? "Devometrics — The Science of Career Growth."}
        </p>
        <p style="font-size:12px;color:#8892a4;line-height:1.6;margin:8px 0 0;">
          Questions? <a href="mailto:support@devometrics.com" style="color:${BRAND_TEAL};text-decoration:none;">support@devometrics.com</a>
        </p>
      </div>
    </div>
  </div>`;
}
