import { createClient } from "@/lib/supabase/server";
import type { RoleplayScenario } from "./scenarios";
import type { CustomScenario } from "@/lib/supabase/types";

// Adapts a user-authored scenario into the exact shape the built-in ones
// use, so RoleplayChat / the system prompt / the API route don't need to
// know or care which source a scenario came from. "level" and
// "competencyFocus" don't really apply to a custom scenario — they're only
// used elsewhere for level-based sectioning and assessment-linking, neither
// of which custom scenarios participate in.
export function toRoleplayScenario(row: CustomScenario): RoleplayScenario {
  return {
    slug: row.id,
    title: row.title,
    level: "Professional",
    competencyFocus: [],
    setup: row.setup,
    yourRole: row.your_role,
    openingMessage: row.opening_message,
  };
}

export async function getCustomScenario(id: string, userId: string): Promise<RoleplayScenario | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("custom_scenarios")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<CustomScenario>();
  return data ? toRoleplayScenario(data) : null;
}
