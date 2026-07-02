import type { SupabaseClient, User } from "@supabase/supabase-js";

export type Workspace = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export async function getOwnedWorkspace(
  supabase: SupabaseClient,
  user: User,
) {
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Workspace | null;
}

export async function createOwnedWorkspace(
  supabase: SupabaseClient,
  user: User,
  name: string,
) {
  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      owner_id: user.id,
      name,
    })
    .select("*")
    .single();

  if (!error) {
    return data as Workspace;
  }

  if (error.code === "23505") {
    const existingWorkspace = await getOwnedWorkspace(supabase, user);

    if (existingWorkspace) {
      return existingWorkspace;
    }
  }

  throw error;
}