import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/billing/lemonsqueezy";

// Receives Lemon Squeezy subscription events and flips profiles.subscription_tier
// accordingly. Written from Lemon Squeezy's documented webhook payload shape
// (meta.event_name, meta.custom_data, data.attributes.status) — verify this
// against a real webhook delivery once credentials exist; this has not been
// tested against a live payload.
//
// Updates go through set_subscription_tier() (migration 0044), a
// security-definer function — not a plain .update() — because this route has
// no Supabase auth session (Lemon Squeezy calls this server-to-server, not a
// logged-in user), so RLS would silently block a direct update. The safety
// boundary here is the signature check above, not auth.uid().
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventName: string | undefined = payload?.meta?.event_name;
  const userId: string | undefined = payload?.meta?.custom_data?.user_id;
  const status: string | undefined = payload?.data?.attributes?.status;

  if (!userId) {
    return NextResponse.json({ error: "Missing user_id in custom_data" }, { status: 400 });
  }

  const supabase = await createClient();

  const activeEvents = new Set(["subscription_created", "subscription_updated", "subscription_payment_success"]);
  const inactiveStatuses = new Set(["cancelled", "expired", "unpaid"]);

  if (eventName && activeEvents.has(eventName) && status && !inactiveStatuses.has(status)) {
    await supabase.rpc("set_subscription_tier", { p_user_id: userId, p_tier: "premium" });
  } else if (status && inactiveStatuses.has(status)) {
    await supabase.rpc("set_subscription_tier", { p_user_id: userId, p_tier: "free" });
  }

  return NextResponse.json({ received: true });
}
