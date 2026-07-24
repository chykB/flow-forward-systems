import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GuidedClientIntakeDraft,
  GuidedClientIntakeDraftValues,
  GuidedClientIntakeField,
  GuidedClientIntakeUncertainty,
} from "@/lib/operations-agent-types";

type GuidedClientIntakeDraftRow = {
  id: string;
  workspace_id: string;
  run_id: string;
  initiated_by: string;
  draft: GuidedClientIntakeDraftValues;
  missing_fields: GuidedClientIntakeField[] | null;
  uncertain_fields: GuidedClientIntakeUncertainty[] | null;
  clarification_questions: string[] | null;
  state: GuidedClientIntakeDraft["state"];
  provider: string | null;
  model: string | null;
  provider_response_id: string | null;
  approved_record: Record<string, unknown> | null;
  saved_client_workflow_record_id: string | null;
  created_at: string;
  updated_at: string;
};

export function mapGuidedClientIntakeDraft(
  row: GuidedClientIntakeDraftRow,
): GuidedClientIntakeDraft {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    runId: row.run_id,
    initiatedBy: row.initiated_by,
    values: row.draft,
    missingFields: row.missing_fields ?? [],
    uncertainFields: row.uncertain_fields ?? [],
    clarificationQuestions: row.clarification_questions ?? [],
    state: row.state,
    provider: row.provider ?? "",
    model: row.model ?? "",
    providerResponseId: row.provider_response_id ?? "",
    approvedRecord: row.approved_record ?? {},
    savedClientWorkflowRecordId:
      row.saved_client_workflow_record_id ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWorkspaceGuidedClientIntakeDrafts(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("operations_agent_client_intake_drafts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Supabase guided client intake draft load failed", error);
    throw error;
  }

  return ((data ?? []) as GuidedClientIntakeDraftRow[]).map(
    mapGuidedClientIntakeDraft,
  );
}
