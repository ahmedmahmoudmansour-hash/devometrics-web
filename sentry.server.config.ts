import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "@/lib/monitoring/sentryOptions";

Sentry.init({
  ...sharedSentryOptions(),
  // Server actions here catch their own errors and log via console.error
  // (to degrade gracefully instead of throwing), so those handled failures
  // would never reach an error tracker on their own. Capture console.error;
  // everything passes through the scrubber first.
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});
