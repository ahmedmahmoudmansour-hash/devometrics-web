import crypto from "node:crypto";
import type { PricingRegion } from "./pricingTiers";

// Thin wrapper around Lemon Squeezy's hosted Checkouts API — one fetch call
// to get a checkout URL, no SDK dependency. This follows Lemon Squeezy's
// documented JSON:API Checkouts endpoint shape as of this writing; verify
// field names against their current API docs once real credentials exist —
// this has never been tested against the live API, only written from
// documented shape, and Lemon Squeezy's API can change.
//
// Deliberately throws instead of silently no-oping when unconfigured, same
// pattern as lib/email/resend.ts — callers must surface "checkout isn't set
// up yet" rather than pretending a checkout was created.

export type Cadence = "monthly" | "annual";

function variantIdFor(region: PricingRegion, cadence: Cadence): string | undefined {
  const key =
    region === "premium"
      ? cadence === "monthly"
        ? "LEMONSQUEEZY_VARIANT_PREMIUM_MONTHLY"
        : "LEMONSQUEEZY_VARIANT_PREMIUM_ANNUAL"
      : cadence === "monthly"
        ? "LEMONSQUEEZY_VARIANT_DEVELOPING_MONTHLY"
        : "LEMONSQUEEZY_VARIANT_DEVELOPING_ANNUAL";
  return process.env[key];
}

export async function createCheckoutUrl(params: {
  userId: string;
  email: string;
  region: PricingRegion;
  cadence: Cadence;
  redirectUrl: string;
}): Promise<string> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = variantIdFor(params.region, params.cadence);
  if (!apiKey || !storeId || !variantId) {
    throw new Error("Checkout isn't configured yet (missing Lemon Squeezy API key, store ID, or variant ID).");
  }

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: params.email,
            // Passed through to the webhook payload under meta.custom_data
            // — this is how we correlate "subscription activated" back to
            // the right Supabase user, since Lemon Squeezy has no idea our
            // user IDs exist.
            custom: { user_id: params.userId },
          },
          product_options: {
            redirect_url: params.redirectUrl,
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Failed to create checkout (${res.status}): ${detail}`);
  }

  const json = await res.json();
  const url = json?.data?.attributes?.url;
  if (!url) throw new Error("Lemon Squeezy did not return a checkout URL");
  return url;
}

// Lemon Squeezy signs webhook bodies with HMAC-SHA256 over the raw request
// body, sent in the X-Signature header — this must run against the raw
// (unparsed) body, not the parsed JSON, or the signature won't match.
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signatureHeader, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
