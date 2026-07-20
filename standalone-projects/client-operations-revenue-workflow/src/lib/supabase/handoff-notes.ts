import type { SupabaseClient } from "@supabase/supabase-js";
import type { HandoffNote } from "@/lib/client-workflow-types";

export type HandoffNoteRow = {
  id: string;
  workspace_id: string;
  client_workflow_record_id: string;
  client_engagement_id: string;
  title: string;
  note: string;
  owner: string;
  created_at: string;
};

export function mapHandoffNoteRow(
  row: HandoffNoteRow,
): HandoffNote {
  return {
    id: row.id,
    clientWorkflowRecordId:
      row.client_workflow_record_id,
    clientEngagementId: row.client_engagement_id,
    title: row.title,
    note: row.note,
    owner: row.owner,
    createdAt: row.created_at,
  };
}

export async function getWorkspaceHandoffNotes(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("handoff_notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "Supabase handoff notes load failed",
      error,
    );
    throw new Error(error.message);
  }

  return (data as HandoffNoteRow[]).map(
    mapHandoffNoteRow,
  );
}
