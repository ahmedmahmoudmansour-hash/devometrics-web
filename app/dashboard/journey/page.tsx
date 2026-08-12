import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildJourney, type JourneyEvent } from "@/lib/journey/aggregate";
import Mascot from "@/components/Mascot";

const TYPE_ICON: Record<JourneyEvent["type"], string> = {
  joined: "✦",
  discovery: "◈",
  "gap-analysis": "◎",
  assessment: "◆",
  resume: "▤",
  roleplay: "▲",
  milestone: "✓",
};

function monthLabel(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(locale === "ar" ? "ar-u-nu-latn" : "en-US", {
    month: "long",
    year: "numeric",
  });
}

export default async function JourneyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const locale = await getLocale();
  const [t, tPage, tCatalog, tBands, tScenarios] = await Promise.all([
    getTranslations("journeyEvents"),
    getTranslations("journeyPage"),
    getTranslations("assessmentCatalog"),
    getTranslations("scoreBands"),
    getTranslations("roleplayScenarios"),
  ]);
  const events = await buildJourney(t, tCatalog, tBands, tScenarios);

  const groups = new Map<string, JourneyEvent[]>();
  for (const e of events) {
    const key = monthLabel(e.date, locale);
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {tPage("back")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {tPage("title")}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            {tPage("description")}
          </p>
        </div>

        {events.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, textAlign: "center" }}>
            <Mascot size={72} className="float" />
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 12 }}>
              {tPage("empty")}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {Array.from(groups.entries()).map(([month, monthEvents]) => (
              <div key={month}>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--teal)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 12,
                  }}
                >
                  {month}
                </p>
                <div
                  style={{
                    background: "var(--navy-mid)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                >
                  {monthEvents.map((e, i) => {
                    const content = (
                      <div
                        style={{
                          display: "flex",
                          gap: 14,
                          padding: "16px 20px",
                          borderBottom: i === monthEvents.length - 1 ? "none" : "1px solid var(--border)",
                        }}
                      >
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 999,
                            background: "rgba(var(--teal-rgb),0.12)",
                            color: "var(--teal)",
                            fontSize: 13,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {TYPE_ICON[e.type]}
                        </span>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{e.title}</p>
                          {e.description && (
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{e.description}</p>
                          )}
                          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                            {new Date(e.date).toLocaleDateString(locale === "ar" ? "ar-u-nu-latn" : "en-US", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                    return e.href ? (
                      <Link key={i} href={e.href} style={{ textDecoration: "none", display: "block" }}>
                        {content}
                      </Link>
                    ) : (
                      <div key={i}>{content}</div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
