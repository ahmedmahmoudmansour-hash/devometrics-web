// A person's name in English and Arabic (0200). profiles.full_name is the
// English name; profiles.full_name_ar is the Arabic form, optional.

export type NameLocale = "en" | "ar";

// "Omar Khalil · عمر خليل". The person's name in the reader's language comes
// first; the other follows when it exists and differs. With only one name
// stored, that name is shown alone; with none, a dash.
export function bilingualName(
  english: string | null | undefined,
  arabic: string | null | undefined,
  locale: NameLocale = "en"
): string {
  const en = english?.trim() ?? "";
  const ar = arabic?.trim() ?? "";
  if (en && ar && en !== ar) return locale === "ar" ? `${ar} · ${en}` : `${en} · ${ar}`;
  return en || ar || "—";
}

// The language of the current request, for server code that builds display
// names. Falls back to English outside a request (cron jobs, scripts).
export async function currentNameLocale(): Promise<NameLocale> {
  try {
    const { getLocale } = await import("next-intl/server");
    return (await getLocale()) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}
