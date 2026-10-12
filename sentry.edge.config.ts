import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "@/lib/monitoring/sentryOptions";

// The Next.js middleware (session refresh for /dashboard) runs on the edge.
Sentry.init(sharedSentryOptions());
