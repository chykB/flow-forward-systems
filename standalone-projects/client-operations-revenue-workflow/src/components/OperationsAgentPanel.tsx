"use client";

import { useState } from "react";
import {
  BriefcaseBusiness,
  CalendarClock,
  Gauge,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { GuidedClientIntakePanel } from "@/components/GuidedClientIntakePanel";
import { GuidedWorkspaceSetupPanel } from "@/components/GuidedWorkspaceSetupPanel";
import { OperationsAgentApprovalQueue } from "@/components/OperationsAgentApprovalQueue";
import { OperationsAgentReliabilityPanel } from "@/components/OperationsAgentReliabilityPanel";
import { NextActionUpdatePanel } from "@/components/NextActionUpdatePanel";
import type {
  GuidedClientIntakeCommandResult,
  WorkspaceApplicationApi,
} from "@/lib/application/workspace-api";

type OperationsAgentPanelProps = {
  onClientCreated: (
    result: GuidedClientIntakeCommandResult,
  ) => void | Promise<void>;
  workspaceApi: WorkspaceApplicationApi;
  workspaceId: string;
};

type AgentTask =
  | "workspace-setup"
  | "client-intake"
  | "next-actions"
  | "approvals"
  | "reliability";

export function OperationsAgentPanel({
  onClientCreated,
  workspaceApi,
  workspaceId,
}: OperationsAgentPanelProps) {
  const [activeTask, setActiveTask] =
    useState<AgentTask>("workspace-setup");

  return (
    <div>
      <div
        aria-label="Operations Agent task"
        className="mb-8 flex flex-wrap gap-2 border-b border-[#D9DED8] pb-5"
        role="group"
      >
        <button
          aria-pressed={activeTask === "workspace-setup"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 font-bold ${
            activeTask === "workspace-setup"
              ? "bg-[#174F42] text-white"
              : "bg-[#EDF3EF] text-[#174F42] hover:bg-[#DDE9E2]"
          }`}
          onClick={() => setActiveTask("workspace-setup")}
          type="button"
        >
          <BriefcaseBusiness aria-hidden="true" className="size-5" />
          Workspace setup
        </button>
        <button
          aria-pressed={activeTask === "client-intake"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 font-bold ${
            activeTask === "client-intake"
              ? "bg-[#174F42] text-white"
              : "bg-[#EDF3EF] text-[#174F42] hover:bg-[#DDE9E2]"
          }`}
          onClick={() => setActiveTask("client-intake")}
          type="button"
        >
          <UserPlus aria-hidden="true" className="size-5" />
          Client intake
        </button>
        <button
          aria-pressed={activeTask === "next-actions"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 font-bold ${
            activeTask === "next-actions"
              ? "bg-[#174F42] text-white"
              : "bg-[#EDF3EF] text-[#174F42] hover:bg-[#DDE9E2]"
          }`}
          onClick={() => setActiveTask("next-actions")}
          type="button"
        >
          <CalendarClock aria-hidden="true" className="size-5" />
          Next actions
        </button>
        <button
          aria-pressed={activeTask === "approvals"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 font-bold ${
            activeTask === "approvals"
              ? "bg-[#174F42] text-white"
              : "bg-[#EDF3EF] text-[#174F42] hover:bg-[#DDE9E2]"
          }`}
          onClick={() => setActiveTask("approvals")}
          type="button"
        >
          <ShieldCheck aria-hidden="true" className="size-5" />
          Approvals
        </button>
        <button
          aria-pressed={activeTask === "reliability"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 font-bold ${
            activeTask === "reliability"
              ? "bg-[#174F42] text-white"
              : "bg-[#EDF3EF] text-[#174F42] hover:bg-[#DDE9E2]"
          }`}
          onClick={() => setActiveTask("reliability")}
          type="button"
        >
          <Gauge aria-hidden="true" className="size-5" />
          Usage & reliability
        </button>
      </div>

      {activeTask === "workspace-setup" ? (
        <GuidedWorkspaceSetupPanel
          workspaceApi={workspaceApi}
          workspaceId={workspaceId}
        />
      ) : activeTask === "client-intake" ? (
        <GuidedClientIntakePanel
          onClientCreated={onClientCreated}
          workspaceApi={workspaceApi}
          workspaceId={workspaceId}
        />
      ) : activeTask === "next-actions" ? (
        <NextActionUpdatePanel
          onPrepared={() => setActiveTask("approvals")}
          workspaceApi={workspaceApi}
          workspaceId={workspaceId}
        />
      ) : activeTask === "approvals" ? (
        <OperationsAgentApprovalQueue
          workspaceApi={workspaceApi}
          workspaceId={workspaceId}
        />
      ) : (
        <OperationsAgentReliabilityPanel
          workspaceApi={workspaceApi}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}
