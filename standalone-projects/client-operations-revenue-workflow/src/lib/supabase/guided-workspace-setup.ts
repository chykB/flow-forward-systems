import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GuidedWorkspaceSetupDraft,
  GuidedWorkspaceSetupDraftValues,
  GuidedWorkspaceSetupField,
  GuidedWorkspaceSetupUncertainty,
  WorkspaceOperatingProfile,
  WorkspaceWorkingDay,
  WorkspaceWorkflowStage,
} from "@/lib/operations-agent-types";

export type GuidedWorkspaceSetupDraftRow = {
  id: string;
  workspace_id: string;
  run_id: string;
  initiated_by: string;
  draft: GuidedWorkspaceSetupDraftValues;
  missing_fields: GuidedWorkspaceSetupField[] | null;
  uncertain_fields: GuidedWorkspaceSetupUncertainty[] | null;
  clarification_questions: string[] | null;
  state: GuidedWorkspaceSetupDraft["state"];
  provider: string | null;
  model: string | null;
  provider_response_id: string | null;
  approved_configuration: Record<string, unknown> | null;
  saved_workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceOperatingProfileRow = {
  workspace_id: string;
  business_type: string;
  workflow_stages: WorkspaceWorkflowStage[];
  common_owners: string[];
  working_days: WorkspaceWorkingDay[];
  daily_briefing_enabled: boolean;
  immediate_failure_alerts_enabled: boolean;
  opportunity_alerts_enabled: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export function mapGuidedWorkspaceSetupDraft(
  row: GuidedWorkspaceSetupDraftRow,
): GuidedWorkspaceSetupDraft {
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
    approvedConfiguration: row.approved_configuration ?? {},
    savedWorkspaceId: row.saved_workspace_id ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWorkspaceOperatingProfile(
  row: WorkspaceOperatingProfileRow,
): WorkspaceOperatingProfile {
  return {
    workspaceId: row.workspace_id,
    businessType: row.business_type,
    workflowStages: row.workflow_stages,
    commonOwners: row.common_owners,
    workingDays: row.working_days,
    dailyBriefingEnabled: row.daily_briefing_enabled,
    immediateFailureAlertsEnabled:
      row.immediate_failure_alerts_enabled,
    opportunityAlertsEnabled: row.opportunity_alerts_enabled,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWorkspaceGuidedWorkspaceSetupDrafts(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("operations_agent_workspace_setup_drafts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error(
      "Supabase guided workspace setup draft load failed",
      error,
    );
    throw error;
  }

  return ((data ?? []) as GuidedWorkspaceSetupDraftRow[]).map(
    mapGuidedWorkspaceSetupDraft,
  );
}

export async function getWorkspaceOperatingProfile(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("workspace_operating_profiles")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("Supabase workspace operating profile load failed", error);
    throw error;
  }

  return data
    ? mapWorkspaceOperatingProfile(
        data as WorkspaceOperatingProfileRow,
      )
    : null;
}
