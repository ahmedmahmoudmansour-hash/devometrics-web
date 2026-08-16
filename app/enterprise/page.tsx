import { redirect } from "next/navigation";

// /enterprise itself has no content of its own anymore — Decisions is the
// first section in the original scroll order, so it's the canonical
// landing point for the section-nav's default state.
export default function EnterprisePage() {
  redirect("/enterprise/decisions");
}
