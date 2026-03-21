"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Sentry Verification Page</h1>
      <p className="text-gray-500">Click a button to trigger a test error in Sentry.</p>

      <button
        className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        onClick={() => {
          // This will throw a ReferenceError: myUndefinedFunction is not defined
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error - intentional call to undefined function for Sentry test
          myUndefinedFunction();
        }}
      >
        Throw Client Error (myUndefinedFunction)
      </button>

      <button
        className="rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
        onClick={() => {
          Sentry.captureException(new Error("Manual Sentry test error"));
          alert("Sentry event sent! Check your Sentry dashboard.");
        }}
      >
        Send Manual Sentry Event
      </button>
    </div>
  );
}
