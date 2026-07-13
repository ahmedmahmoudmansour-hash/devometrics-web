import LegalPageShell, { LegalSection } from "@/components/LegalPageShell";

export const metadata = { title: "Privacy Policy — Devometrics" };

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" lastUpdated="July 3, 2026">
      <LegalSection title="1. What we collect">
        <p>
          Account info you provide directly: name, email, and the profile details you choose to
          fill in (career stage, location, learning preference, accommodation, resource budget).
        </p>
        <p>
          Content you submit to use the product: your CV text, target job descriptions, discovery
          interview answers, assessment responses, AI Coach messages, and Interview Simulator
          conversation transcripts.
        </p>
        <p>
          We do not collect payment information today — there is no billing system active during
          the pilot phase.
        </p>
      </LegalSection>

      <LegalSection title="2. How we use it">
        <p>
          To generate your competency gap analysis, development plans, assessment results, resume
          analysis, and AI Coach and Interview Simulator responses. Your submitted content (CV text,
          job descriptions, assessment answers, coach messages) is sent to our AI provider,
          Anthropic, to generate these results — it is not used to train Anthropic&apos;s models under
          our current API agreement.
        </p>
      </LegalSection>

      <LegalSection title="3. Where it's stored">
        <p>
          In a Supabase-hosted PostgreSQL database, protected by row-level security policies that
          restrict each account to its own data. We don&apos;t sell your data or share it with
          advertisers.
        </p>
      </LegalSection>

      <LegalSection title="4. Who else sees it">
        <p>
          Anthropic (our AI provider, to generate responses), Supabase (our database and
          authentication provider), and — only for the small pilot-cohort admin view used to
          monitor pilot engagement — Empiric Consultancy staff administering the pilot. We don&apos;t
          share your data with any other third party.
        </p>
      </LegalSection>

      <LegalSection title="5. Your rights">
        <p>
          You can export everything stored about your account at any time from your dashboard&apos;s
          Data &amp; privacy section, or delete your app data (plans, analyses, assessment results,
          coach and scenario history) the same way. Deleting app data doesn&apos;t delete your login —
          contact us if you want your account itself removed.
        </p>
      </LegalSection>

      <LegalSection title="6. Retention">
        <p>
          We retain your data for as long as your account is active, or until you delete it.
        </p>
        <p>
          Deleting your app data or your company workspace does not remove it immediately. It
          schedules removal after a <strong>30-day grace period</strong>, during which everything
          keeps working normally and the deletion can be cancelled — this window exists solely to
          recover from an accidental deletion. Once the 30 days pass, the data is permanently and
          irreversibly deleted, and we are no longer able to retrieve it for any reason, except
          where we&apos;re required to retain records for legal reasons.
        </p>
      </LegalSection>

      <LegalSection title="7. Children">
        <p>Devometrics is not directed at children under 16, and we don&apos;t knowingly collect their data.</p>
      </LegalSection>

      <LegalSection title="8. Changes">
        <p>We&apos;ll update the date at the top of this page if this policy changes materially.</p>
      </LegalSection>

      <LegalSection title="Questions">
        <p>
          Contact us at{" "}
          <a href="mailto:support@devometrics.com" style={{ color: "var(--teal)" }}>
            support@devometrics.com
          </a>{" "}
          about your data or this policy.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
