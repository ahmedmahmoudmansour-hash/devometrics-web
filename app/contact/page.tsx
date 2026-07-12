import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ContactForm from "@/components/ContactForm";

export const metadata = { title: "Contact — Devometrics" };

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main style={{ padding: "140px 24px 80px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              marginBottom: 12,
            }}
          >
            Get in touch
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 36 }}>
            Sales, support, or careers — pick what this is about and we&apos;ll get back to you at
            the email you provide.
          </p>
          <Suspense>
            <ContactForm />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}
