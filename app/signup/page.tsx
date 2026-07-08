import { Suspense } from "react";
import AuthShell from "@/components/AuthShell";
import AuthForm from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Free to start — map your gap and get a development plan in minutes."
    >
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </AuthShell>
  );
}
