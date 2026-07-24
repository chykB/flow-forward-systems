"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser-client";
import {
  createOwnedWorkspace,
  getOwnedWorkspace,
  type Workspace,
} from "@/lib/supabase/workspaces";

type GateStatus =
  | "checking-auth"
  | "signed-out"
  | "checking-workspace"
  | "needs-workspace"
  | "load-error"
  | "ready";

export type WorkspaceGateState = {
  mode: "sample" | "workspace";
  workspace: Workspace | null;
  userEmail: string | null;
  onSignOut: () => void;
  onCreateWorkspace: () => void;
  isCreatingWorkspace: boolean;
};

export function WorkspaceGate({
  children,
}: {
  children: (state: WorkspaceGateState) => ReactNode;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [status, setStatus] = useState<GateStatus>("checking-auth");
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("My Workspace");
  const [message, setMessage] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const allowSignUp = process.env.NEXT_PUBLIC_ALLOW_SIGN_UP === "true";

  const loadWorkspaceForUser = useCallback(
    async (currentUser: User) => {
      setStatus("checking-workspace");
      setMessage("");

      try {
        const ownedWorkspace = await getOwnedWorkspace(supabase, currentUser);
        setWorkspace(ownedWorkspace);
        setStatus(ownedWorkspace ? "ready" : "needs-workspace");
      } catch {
        setMessage(
          "Workspace access could not be checked. Check your connection and try again.",
        );
        setStatus("load-error");
      }
    },
    [supabase],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        setMessage(
          "Your session could not be checked. Check your connection and try again.",
        );
        setStatus("load-error");
        return;
      }

      const currentUser = data.session?.user ?? null;
      setUser(currentUser);

      if (!currentUser) {
        setWorkspace(null);
        setStatus("signed-out");
        return;
      }

      await loadWorkspaceForUser(currentUser);
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setWorkspace(null);
        setStatus("signed-out");
        return;
      }

      void loadWorkspaceForUser(nextUser);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadWorkspaceForUser, supabase]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingAuth(true);
    setMessage("");

    try {
      const result =
        authMode === "sign-up" && allowSignUp
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) {
        setMessage(result.error.message);
        return;
      }

      setMessage(
        authMode === "sign-up" && allowSignUp
          ? "Account created. Check your email if confirmation is required."
          : "Signed in successfully.",
      );
    } catch {
      setMessage(
        "The authentication service could not be reached. Check your connection and try again.",
      );
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setWorkspace(null);
    setStatus("signed-out");
    setMessage("Signed out.");
  }

  async function handleCreateWorkspace() {
    if (!user) {
      setStatus("signed-out");
      return;
    }

    const name = workspaceName.trim();

    if (name.length < 2) {
      setMessage("Enter a workspace name.");
      return;
    }

    setIsCreatingWorkspace(true);
    setMessage("");

    try {
      const createdWorkspace = await createOwnedWorkspace(supabase, user, name);
      setWorkspace(createdWorkspace);
      setStatus("ready");
    } catch {
      setMessage("Workspace could not be created. Please try again.");
    } finally {
      setIsCreatingWorkspace(false);
    }
  }

  if (status === "checking-auth" || status === "checking-workspace") {
    return (
      <main
        aria-busy="true"
        className="min-h-screen bg-[#F7F8F6] px-6 py-16"
      >
        <section className="mx-auto max-w-3xl rounded-lg border border-[#D9DED8] bg-white p-6">
          <h1 className="text-2xl font-bold text-[#17201C]">
            Loading workspace
          </h1>
          <p className="mt-3 text-[#5F6862]" role="status">
            Checking your account and workspace access.
          </p>
        </section>
      </main>
    );
  }

  if (status === "load-error") {
    return (
      <main className="min-h-screen bg-[#F7F8F6] px-6 py-16">
        <section
          className="mx-auto max-w-3xl rounded-lg border border-[#D9DED8] bg-white p-6"
          role="alert"
        >
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#5F6862]">
            Client Operations Workspace
          </p>
          <h1 className="mt-3 text-3xl font-bold text-[#17201C]">
            Workspace unavailable
          </h1>
          <p className="mt-3 leading-7 text-[#5F6862]">{message}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B]"
              onClick={() => window.location.reload()}
              type="button"
            >
              Try again
            </button>
            {user ? (
              <button
                className="rounded-md border border-[#174F42] px-5 py-3 font-bold text-[#174F42] hover:bg-[#EDF3EF]"
                onClick={() => void handleSignOut()}
                type="button"
              >
                Sign out
              </button>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  if (status === "signed-out") {
    return (
      <main className="min-h-screen bg-[#F7F8F6] px-6 py-16">
        <section className="mx-auto max-w-3xl rounded-lg border border-[#D9DED8] bg-white p-6">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#5F6862]">
            Client Operations Workspace
          </p>
          <h1 className="mt-3 text-3xl font-bold text-[#17201C]">
            Sign in to manage client workflow records
          </h1>
          <p className="mt-3 leading-7 text-[#5F6862]">
            Use a workspace to save client follow-ups, onboarding tasks, handoff
            notes, delivery updates, and activity history.
          </p>

          <form
            className="mt-6 grid gap-4"
            onSubmit={(event) => void handleAuthSubmit(event)}
          >
            <label className="font-bold text-[#17201C]" htmlFor="auth-email">
              Email
            </label>
            <input
              aria-describedby={message ? "auth-message" : undefined}
              autoCapitalize="none"
              autoComplete="email"
              className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
              id="auth-email"
              inputMode="email"
              name="email"
              required
              spellCheck={false}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label className="font-bold text-[#17201C]" htmlFor="auth-password">
              Password
            </label>
            <input
              aria-describedby={message ? "auth-message" : undefined}
              autoComplete={
                authMode === "sign-up" && allowSignUp
                  ? "new-password"
                  : "current-password"
              }
              className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
              id="auth-password"
              minLength={6}
              name="password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:opacity-70"
                disabled={isSubmittingAuth}
                type="submit"
              >
                {isSubmittingAuth
                  ? "Working..."
                  : authMode === "sign-up" && allowSignUp
                    ? "Create Account"
                    : "Sign In"}
              </button>

              {allowSignUp ? (
                <button
                  className="rounded-md border border-[#D9DED8] px-5 py-3 font-bold text-[#17201C] hover:bg-[#EDF3EF]"
                  type="button"
                  onClick={() => {
                    setMessage("");
                    setAuthMode((currentMode) =>
                      currentMode === "sign-in" ? "sign-up" : "sign-in",
                    );
                  }}
                >
                  {authMode === "sign-in"
                    ? "Create Account Instead"
                    : "Sign In Instead"}
                </button>
              ) : null}
            </div>

            {message ? (
              <p
                aria-live="polite"
                className="rounded-md bg-[#EDF3EF] p-4 font-semibold text-[#5F6862]"
                id="auth-message"
              >
                {message}
              </p>
            ) : null}
          </form>
        </section>
      </main>
    );
  }

  if (status === "needs-workspace") {
    return (
      <main className="min-h-screen bg-[#F7F8F6] px-6 py-10 text-[#17201C]">
        <section className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#5F6862]">
              Client Operations Workspace
            </p>

            <button
              className="rounded-md border border-[#174F42] bg-white px-4 py-2 font-bold text-[#174F42] hover:bg-[#174F42] hover:text-white"
              type="button"
              onClick={() => void handleSignOut()}
            >
              Sign Out
            </button>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-start">
            <div>
              <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
                Create your client operations workspace
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5F6862]">
                Set up one place to track leads, follow-ups, onboarding, delivery
                work, approvals, payment status, handoff notes, and client
                workflow activity.
              </p>

              <form
                className="mt-8 grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreateWorkspace();
                }}
              >
                <label
                  className="font-bold text-[#17201C]"
                  htmlFor="workspace-name"
                >
                  Workspace name
                </label>
                <input
                  aria-describedby={message ? "workspace-message" : undefined}
                  autoComplete="organization"
                  className="max-w-xl rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
                  id="workspace-name"
                  minLength={2}
                  name="workspace-name"
                  required
                  type="text"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                />

                <button
                  className="w-fit rounded-md bg-[#174F42] px-6 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={isCreatingWorkspace}
                >
                  {isCreatingWorkspace
                    ? "Creating Workspace..."
                    : "Create Workspace"}
                </button>

                {message ? (
                  <p
                    aria-live="polite"
                    className="max-w-xl rounded-md bg-[#EDF3EF] p-4 font-semibold text-[#5F6862]"
                    id="workspace-message"
                  >
                    {message}
                  </p>
                ) : null}
              </form>
            </div>

            <aside className="rounded-lg border border-[#D9DED8] bg-white p-6">
              <h2 className="text-2xl font-bold text-[#17201C]">
                What your workspace will help you manage
              </h2>

              <div className="mt-5 grid gap-3">
                {[
                  "Leads and clients in progress",
                  "Next actions and follow-up dates",
                  "Work items, blockers, and delivery tasks",
                  "Handoff notes between people or stages",
                  "Approvals, payment status, and client risk",
                  "Activity history for each client record",
                ].map((item) => (
                  <p
                    key={item}
                    className="rounded-md bg-[#EDF3EF] p-3 font-semibold text-[#174F42]"
                  >
                    {item}
                  </p>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </main>
    );
  }

  return children({
    mode: "workspace",
    workspace,
    userEmail: user?.email ?? null,
    onSignOut: handleSignOut,
    onCreateWorkspace: handleCreateWorkspace,
    isCreatingWorkspace,
  });
}
