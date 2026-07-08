import LegalPageShell, { LegalSection } from "@/components/LegalPageShell";

export const metadata = { title: "Cookie Policy — Devometrics" };

export default function CookiesPage() {
  return (
    <LegalPageShell title="Cookie Policy" lastUpdated="July 3, 2026">
      <LegalSection title="What we use cookies for">
        <p>
          Devometrics uses only the cookies required to keep you signed in — set by our
          authentication provider, Supabase, to maintain your session between page loads. We don&apos;t
          use advertising, tracking, or analytics cookies.
        </p>
      </LegalSection>

      <LegalSection title="Local storage">
        <p>
          We store your theme preference (light/dark) in your browser&apos;s local storage so it
          persists between visits. This stays on your device and isn&apos;t sent to us.
        </p>
      </LegalSection>

      <LegalSection title="Third parties">
        <p>
          We don&apos;t embed third-party trackers, ad networks, or social-media widgets that set their
          own cookies on this site.
        </p>
      </LegalSection>

      <LegalSection title="Managing cookies">
        <p>
          Since the only cookies we set are required to keep you logged in, blocking them will
          prevent the dashboard from working. You can clear cookies for this site at any time
          through your browser settings — you&apos;ll just need to log in again afterward.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
