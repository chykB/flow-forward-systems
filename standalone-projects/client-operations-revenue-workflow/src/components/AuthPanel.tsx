"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser-client";

export function AuthPanel() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (isMounted) {
        setUser(data.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit() {
    setIsSubmitting(true);
    setMessage("");

    const result =
      mode === "sign-up"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setIsSubmitting(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage(
      mode === "sign-up"
        ? "Account created. Check your email if confirmation is required."
        : "Signed in successfully.",
    );
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMessage("Signed out.");
  }

  if (user) {
    return (
      <section className="rounded-lg border border-[#D9DED8] bg-white p-5">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#5F6862]">
          Workspace Access
        </p>
        <h2 className="mt-3 text-2xl font-bold text-[#17201C]">
          Signed in
        </h2>
        <p className="mt-2 text-[#5F6862]">{user.email}</p>
        <button
          className="mt-5 rounded-md border border-[#D9DED8] px-5 py-3 font-bold text-[#17201C] hover:bg-[#EDF3EF]"
          type="button"
          onClick={handleSignOut}
        >
          Sign Out
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[#D9DED8] bg-white p-5">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#5F6862]">
        Workspace Access
      </p>
      <h2 className="mt-3 text-2xl font-bold text-[#17201C]">
        Sign in to save workspace records
      </h2>
      <p className="mt-2 leading-7 text-[#5F6862]">
        The sample workspace still works locally. Sign in is the first step toward
        saving real client workflow records securely.
      </p>

      <div className="mt-5 grid gap-4">
        <input
          className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:opacity-70"
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting
              ? "Working..."
              : mode === "sign-in"
                ? "Sign In"
                : "Create Account"}
          </button>

          <button
            className="rounded-md border border-[#D9DED8] px-5 py-3 font-bold text-[#17201C] hover:bg-[#EDF3EF]"
            type="button"
            onClick={() =>
              setMode((currentMode) =>
                currentMode === "sign-in" ? "sign-up" : "sign-in",
              )
            }
          >
            {mode === "sign-in" ? "Create Account Instead" : "Sign In Instead"}
          </button>
        </div>

        {message ? (
          <p className="rounded-md bg-[#EDF3EF] p-4 font-semibold text-[#5F6862]">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}