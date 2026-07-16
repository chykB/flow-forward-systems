import type { SupabaseClient } from "@supabase/supabase-js";
import type { HandoffNote } from "@/lib/client-workflow-types";

type HandoffNoteRow = {
  id: string;
  workspace_id: string;
  client_workflow_record_id: string;
  title: string;
  note: string;
  owner: string;
  created_at: string;
};

export type NewHandoffNote = Omit<
  HandoffNote,
  "id" | "createdAt"
>;

function mapHandoffNoteRow(
  row: HandoffNoteRow,
): HandoffNote {
  return {
    id: row.id,
    clientWorkflowRecordId:
      row.client_workflow_record_id,
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

export async function createHandoffNote(
  supabase: SupabaseClient,
  workspaceId: string,
  handoffNote: NewHandoffNote,
) {
  const title = handoffNote.title.trim();
  const note = handoffNote.note.trim();
  const owner = handoffNote.owner.trim();

  if (title.length < 3) {
    throw new Error("Enter a short note title.");
  }

  if (note.length < 10) {
    throw new Error("Add the handoff context.");
  }

  if (owner.length < 2) {
    throw new Error("Enter who owns this note.");
  }

  const { data, error } = await supabase
    .from("handoff_notes")
    .insert({
      workspace_id: workspaceId,
      client_workflow_record_id:
        handoffNote.clientWorkflowRecordId,
      title,
      note,
      owner,
    })
    .select("*")
    .single();

  if (error) {
    console.error(
      "Supabase handoff note insert failed",
      error,
    );
    throw new Error(error.message);
  }

  return mapHandoffNoteRow(data as HandoffNoteRow);
}