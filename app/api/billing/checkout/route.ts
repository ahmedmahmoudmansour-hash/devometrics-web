import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutUrl, type Cadence } from "@/lib/billing/lemonsqueezy";
import { detectVisitorCountry } from "@/lib/billing/detectCountry";
import { tierForCountry } from "@/lib/billing/pricingTiers";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { searchParams, origin } = new URL(request.url);
  const cadenceParam = searchParams.get("cadence");
  const cadence: Cadence = cadenceParam === "annual" ? "annual" : "monthly";

  const country = await detectVisitorCountry();
  const region = tierForCountry(country);

  let checkoutUrl: string;
  try {
    checkoutUrl = await createCheckoutUrl({
      userId: user.id,
      email: user.email ?? "",
      region,
      cadence,
      redirectUrl: `${origin}/dashboard?upgraded=1`,
    });
  } catch (error) {
    // Surfaces as a plain-text error page rather than a silent redirect
    // failure — checkout not being configured yet is expected until Lemon
    // Squeezy credentials exist, but it should be obvious when it happens.
    const message = error instanceof Error ? error.message : "Could not start checkout";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  return NextResponse.redirect(checkoutUrl);
}
