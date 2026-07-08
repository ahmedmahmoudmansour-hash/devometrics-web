import { Suspense } from "react";
import AuthShell from "@/components/AuthShell";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Set a new password" subtitle="Choose a new password for your account.">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
