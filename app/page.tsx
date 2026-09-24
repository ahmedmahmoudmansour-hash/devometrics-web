import { redirect } from "next/navigation";

// 2026-09-23: the individual-consumer track (AudiencePicker's fork, the
// tabbed how-it-works/pricing/etc. content) is hidden per Ahmed's
// enterprise-only strategy decision — new visitors to "/" now land
// directly in the Enterprise track instead of the individual homepage.
// Deliberately just a redirect, not a deletion: every individual-track
// component and route (/login, /signup, /pricing, /dashboard) is
// untouched and still fully functional for existing individual accounts,
// just no longer the front door. The previous Home component is in git
// history if this ever needs reverting.
export default function Home() {
  redirect("/enterprise");
}
