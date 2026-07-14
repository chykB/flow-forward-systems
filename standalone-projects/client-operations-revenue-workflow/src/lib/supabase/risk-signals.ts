import type { SupabaseClient } from "@supabase/supabase-js";
import type { RiskSignal } from "@/lib/client-workflow-types";

export type RiskSignalRow = {
  id: string;
  workspace_id: string;
  client_workflow_record_id: string;
  signal_key: string;
  source_type: RiskSignal["sourceType"];
  source_record_id: string;
  risk_type: string;
  severity: RiskSignal["severity"];
  reason: string;
  recommended_action: string;
  status: RiskSignal["status"];
  last_detected_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
};

export type RiskSignalStatusUpdate = {
  status: RiskSignal["status"];
  resolutionNote?: string;
};

export function mapRiskSignalRow(
  row: RiskSignalRow,
): RiskSignal {
  return {
    id: row.id,
    clientWorkflowRecordId:
      row.client_workflow_record_id,
    signalKey: row.signal_key,
    sourceType: row.source_type,
    sourceRecordId: row.source_record_id,
    riskType: row.risk_type,
    severity: row.severity,
    reason: row.reason,
    recommendedAction: row.recommended_action,
    status: row.status,
    lastDetectedAt: row.last_detected_at,
    resolvedAt: row.resolved_at ?? "",
    resolutionNote: row.resolution_note ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWorkspaceRiskSignals(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("risk_signals")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase risk signals load failed", error);
    throw new Error(error.message);
  }

  return (data as RiskSignalRow[]).map(mapRiskSignalRow);
}

export async function updateRiskSignalStatus(
  supabase: SupabaseClient,
  workspaceId: string,
  riskSignalId: string,
  update: RiskSignalStatusUpdate,
) {
  const isClosing =
    update.status === "Resolved" ||
    update.status === "Dismissed";
  const resolutionNote = update.resolutionNote?.trim() ?? "";

  if (isClosing && resolutionNote.length < 5) {
    throw new Error(
      "Add a short note explaining how this risk signal was closed.",
    );
  }

  const { data, error } = await supabase
    .from("risk_signals")
    .update({
      status: update.status,
      resolution_note: isClosing ? resolutionNote : null,
    })
    .eq("workspace_id", workspaceId)
    .eq("id", riskSignalId)
    .select("*")
    .single();

  if (error) {
    console.error(
      "Supabase risk signal status update failed",
      error,
    );
    throw new Error(error.message);
  }

  return mapRiskSignalRow(data as RiskSignalRow);
}