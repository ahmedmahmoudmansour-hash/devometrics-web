import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "@/lib/monitoring/sentryOptions";

Sentry.init(sharedSentryOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
