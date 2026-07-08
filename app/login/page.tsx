import { Suspense } from "react";
import AuthShell from "@/components/AuthShell";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Log in to pick up right where you left off.">
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </AuthShell>
  );
}
