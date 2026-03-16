import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://c0c8119f78c66103aae65fbb526ba584@o4511056477945856.ingest.us.sentry.io/4511056479191040",
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration(),
  ],
});
