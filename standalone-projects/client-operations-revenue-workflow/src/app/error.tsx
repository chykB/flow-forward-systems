"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Workspace route failed", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#F7F8F6] px-6 py-16 text-[#17201C]">
      <section
        className="mx-auto max-w-3xl rounded-lg border border-[#D9DED8] bg-white p-6"
        role="alert"
      >
        <AlertTriangle
          aria-hidden="true"
          className="h-8 w-8 text-[#A13A2B]"
        />
        <h1 className="mt-4 text-3xl font-bold">
          The workspace could not be displayed
        </h1>
        <p className="mt-3 leading-7 text-[#5F6862]">
          Try loading this view again. No workflow change was made by this
          failed page load.
        </p>
        {error.digest ? (
          <p className="mt-3 text-sm font-semibold text-[#5F6862]">
            Reference: {error.digest}
          </p>
        ) : null}
        <button
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B]"
          onClick={() => unstable_retry()}
          type="button"
        >
          <RefreshCw aria-hidden="true" className="h-5 w-5" />
          Try again
        </button>
      </section>
    </main>
  );
}
