import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityLog } from "@/lib/client-workflow-types";

type ActivityLogRow = {
  id: string;
  workspace_id: string;
  client_workflow_record_id: string;
  actor_id: string;
  action_type: string;
  note: string;
  created_at: string;
};

export type NewActivityLog = Pick<
  ActivityLog,
  "clientWorkflowRecordId" | "actionType" | "note"
> & {
  createdAt?: string;
};

function mapActivityLogRow(
  row: ActivityLogRow,
): ActivityLog {
  return {
    id: row.id,
    clientWorkflowRecordId:
      row.client_workflow_record_id,
    actionType: row.action_type,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function getWorkspaceActivityLogs(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "Supabase activity history load failed",
      error,
    );
    throw new Error(error.message);
  }

  return (data as ActivityLogRow[]).map(
    mapActivityLogRow,
  );
}

export async function createActivityLog(
  supabase: SupabaseClient,
  workspaceId: string,
  activity: NewActivityLog,
) {
  const actionType = activity.actionType.trim();
  const note = activity.note.trim();

  if (actionType.length < 2) {
    throw new Error("Enter a meaningful activity type.");
  }

  if (note.length < 5) {
    throw new Error("Enter a meaningful activity note.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error(
      "Supabase activity actor lookup failed",
      userError,
    );
    throw new Error(userError.message);
  }

  if (!user) {
    throw new Error(
      "Sign in again before recording activity.",
    );
  }

  const payload: {
    workspace_id: string;
    client_workflow_record_id: string;
    actor_id: string;
    action_type: string;
    note: string;
    created_at?: string;
  } = {
    workspace_id: workspaceId,
    client_workflow_record_id:
      activity.clientWorkflowRecordId,
    actor_id: user.id,
    action_type: actionType,
    note,
  };

  if (activity.createdAt) {
    payload.created_at = activity.createdAt;
  }

  const { data, error } = await supabase
    .from("activity_logs")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error(
      "Supabase activity history insert failed",
      error,
    );
    throw new Error(error.message);
  }

  return mapActivityLogRow(data as ActivityLogRow);
}