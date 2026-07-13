import LegalPageShell, { LegalSection } from "@/components/LegalPageShell";

export const metadata = { title: "Data Ethics — Devometrics" };

export default function DataEthicsPage() {
  return (
    <LegalPageShell title="Data Ethics" lastUpdated="July 6, 2026">
      <LegalSection title="Why this page exists">
        <p>
          Devometrics scores people using AI. That comes with real responsibility, and we&apos;d
          rather state our principles plainly than let them be assumed. This page describes how we
          try to hold ourselves to them — it&apos;s a statement of intent, not a legal contract (see our{" "}
          <a href="/terms" style={{ color: "var(--teal)" }}>Terms of Service</a> for that).
        </p>
      </LegalSection>

      <LegalSection title="We show our uncertainty, not just a score">
        <p>
          Every competency the AI extracts carries a visible Confidence Score. When the model is
          inferring from limited signal, that&apos;s shown next to the number — not hidden behind a
          single clean-looking figure.
        </p>
      </LegalSection>

      <LegalSection title="Guidance, not diagnosis">
        <p>
          Assessment results, gap analyses, and AI Coach feedback are self-report tools and
          AI-generated guidance — not certified psychometric evaluation, clinical assessment, or a
          guarantee of any career outcome. We say this directly in the product, not just in fine
          print.
        </p>
      </LegalSection>

      <LegalSection title="No pseudoscience dressed up as science">
        <p>
          We deliberately avoid building features on frameworks that sound authoritative but
          aren&apos;t supported by research — for example, we don&apos;t frame anything around
          &quot;learning styles&quot; (visual/auditory/kinesthetic), since that model has been repeatedly
          tested and hasn&apos;t held up. Where we can&apos;t back a claim with real evidence, we don&apos;t make
          it.
        </p>
      </LegalSection>

      <LegalSection title="Your content isn't used to train anyone's model">
        <p>
          The CV text, job descriptions, and messages you submit are sent to our AI provider only
          to generate your results, under an API agreement that excludes that data from model
          training.
        </p>
      </LegalSection>

      <LegalSection title="What your employer can and can't see">
        <p>
          If you join Devometrics through a company workspace, your organization&apos;s admins can see
          your Career Health Score, capability pyramid, and any milestones they&apos;ve assigned you.
          They cannot see your day-to-day task list, your personal productivity tracking, or any
          individual survey answer — ever. Survey results only ever reach admins as anonymous
          aggregates, and only once at least 3 people have responded; below that, the results simply
          don&apos;t show. This is enforced in the database itself, not just hidden in the interface.
        </p>
      </LegalSection>

      <LegalSection title="You can see and remove what we hold">
        <p>
          Full data export and deletion are built into the product itself (dashboard → Data &amp;
          privacy), not locked behind a support request. Deletion has a 30-day grace period so a
          mistaken click can be undone — after that window closes, it&apos;s permanent and we can no
          longer retrieve it.
        </p>
      </LegalSection>

      <LegalSection title="Human decisions stay human">
        <p>
          Devometrics is designed as an input to your own judgment about your career, not a
          replacement for it. We don&apos;t make hiring, promotion, or compensation decisions, and we&apos;d
          push back on any use of the platform that tried to make it do so unilaterally.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
