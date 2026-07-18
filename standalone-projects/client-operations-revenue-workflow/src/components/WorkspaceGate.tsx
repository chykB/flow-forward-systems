"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
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

  const loadWorkspaceForUser = useCallback(
    async (currentUser: User) => {
        setStatus("checking-workspace");

        const ownedWorkspace = await getOwnedWorkspace(supabase, currentUser);
        setWorkspace(ownedWorkspace);
        setStatus(ownedWorkspace ? "ready" : "needs-workspace");
    },
    [supabase],
    );

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      setUser(data.user);

      if (!data.user) {
        setWorkspace(null);
        setStatus("signed-out");
        return;
      }

      await loadWorkspaceForUser(data.user);
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

  async function handleAuthSubmit() {
    setIsSubmittingAuth(true);
    setMessage("");

    const result =
      authMode === "sign-up"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setIsSubmittingAuth(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage(
      authMode === "sign-up"
        ? "Account created. Check your email if confirmation is required."
        : "Signed in successfully.",
    );
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
      <main className="min-h-screen bg-[#F7F8F6] px-6 py-16">
        <section className="mx-auto max-w-3xl rounded-lg border border-[#D9DED8] bg-white p-6">
          <h1 className="text-2xl font-bold text-[#17201C]">
            Loading workspace
          </h1>
          <p className="mt-3 text-[#5F6862]">
            Checking your account and workspace access.
          </p>
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

          <div className="mt-6 grid gap-4">
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
                disabled={isSubmittingAuth}
                onClick={() => void handleAuthSubmit()}
              >
                {isSubmittingAuth
                  ? "Working..."
                  : authMode === "sign-in"
                    ? "Sign In"
                    : "Create Account"}
              </button>

              <button
                className="rounded-md border border-[#D9DED8] px-5 py-3 font-bold text-[#17201C] hover:bg-[#EDF3EF]"
                type="button"
                onClick={() =>
                  setAuthMode((currentMode) =>
                    currentMode === "sign-in" ? "sign-up" : "sign-in",
                  )
                }
              >
                {authMode === "sign-in"
                  ? "Create Account Instead"
                  : "Sign In Instead"}
              </button>
            </div>

            {message ? (
              <p className="rounded-md bg-[#EDF3EF] p-4 font-semibold text-[#5F6862]">
                {message}
              </p>
            ) : null}
          </div>
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

                <div className="mt-8 grid gap-4">
                <label
                    className="font-bold text-[#17201C]"
                    htmlFor="workspace-name"
                >
                    Workspace name
                </label>
                <input
                    id="workspace-name"
                    className="max-w-xl rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
                    type="text"
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                />

                <button
                    className="w-fit rounded-md bg-[#174F42] px-6 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:cursor-not-allowed disabled:opacity-70"
                    type="button"
                    disabled={isCreatingWorkspace}
                    onClick={() => void handleCreateWorkspace()}
                >
                    {isCreatingWorkspace ? "Creating Workspace..." : "Create Workspace"}
                </button>

                {message ? (
                    <p className="max-w-xl rounded-md bg-[#EDF3EF] p-4 font-semibold text-[#5F6862]">
                    {message}
                    </p>
                ) : null}
                </div>
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
