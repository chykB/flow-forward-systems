"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Plus, X } from "lucide-react";
import { ClientRecordCard } from "@/components/ClientRecordCard";
import {
  ClientRecordDetail,
  type DetailTab,
} from "@/components/ClientRecordDetail";
import { WorkspaceHealthQueue } from "@/components/WorkspaceHealthQueue";
import { WorkspaceActivity } from "@/components/WorkspaceActivity";
import {
  WorkspaceShell,
  type WorkspaceView,
} from "@/components/WorkspaceShell";
import { WorkspaceSnapshot } from "@/components/WorkspaceSnapshot";
import { ClientRecordForm } from "@/components/ClientRecordForm";
import { PriorityCard } from "@/components/PriorityCard";
import { PrioritySummaryRow } from "@/components/PrioritySummaryRow";
import { RecordFiltersBar } from "@/components/RecordFiltersBar";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import {
  createOperationRequestId,
  createWorkspaceApplicationApi,
  type CompleteFollowUpInput,
  type ClientWorkflowRecordUpdates,
  type NewClientWorkflowRecord,
  type NewHandoffNote,
  type NewProposalRecord,
  type NewWorkflowTask,
  type ProposalRecordUpdates,
  type WorkflowTaskStatusUpdate,
} from "@/lib/application/workspace-api";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser-client";
import { getProposalsNeedingAction } from "@/lib/proposal-dashboard";
import {
  createActivityLog,
  getWorkspaceActivityLogs,
  type NewActivityLog,
} from "@/lib/supabase/activity-logs";
import type {
  InvoiceWorkflowRecommendation as InvoiceRecommendationData,
} from "@/lib/invoice-workflow";
import {
  applyInvoiceWorkflowRecommendationTransaction,
  createInvoiceRecord,
  getWorkspaceInvoiceRecords,
  updateInvoiceRecord,
  type InvoiceRecordUpdates,
  type NewInvoiceRecord,
} from "@/lib/supabase/invoice-records";
import type {
  ProposalWorkflowRecommendation as ProposalWorkflowRecommendationData,
} from "@/lib/proposal-workflow";
import type {
  ActivityLog,
  ClientEngagement,
  ClientWorkflowRecord,
  EngagementFollowUp,
  HandoffNote,
  LifecycleStage,
  ProposalRecord,
  WorkflowTask,
  InvoiceRecord,
  RiskSignal,
} from "@/lib/client-workflow-types";
import {
  getDisputedInvoices,
  getInvoicesDueSoon,
  getInvoicesToPrepare,
  getOverdueInvoices,
} from "@/lib/invoice-dashboard";
import {
  getBlockedDeliveryTasks,
  getClientsWithActiveWorkflowRisk,
  getFollowUpsDueSoon,
  getOverdueFollowUps,
  getWaitingApprovals,
} from "@/lib/dashboard";
import {
  filterRecords,
  getRecordOwners,
  initialRecordFilters,
  type RecordFilters,
} from "@/lib/record-filters";
import {
  reconcileClientRiskSignals,
  updateRiskSignalStatus,
  type RiskSignalStatusUpdate,
} from "@/lib/supabase/risk-signals";
import {
  getInvoiceStatusLabel,
} from "@/lib/invoice-options";
function getRelatedClientRecords(
  records: ClientWorkflowRecord[],
  relatedItems: Array<{
    clientWorkflowRecordId: string;
  }>,
) {
  const relatedRecordIds = new Set(
    relatedItems.map(
      (item) => item.clientWorkflowRecordId,
    ),
  );

  return records.filter((record) =>
    relatedRecordIds.has(record.id),
  );
}

function buildPrioritySections(
  records: ClientWorkflowRecord[],
  tasks: WorkflowTask[],
  proposals: ProposalRecord[],
  invoices: InvoiceRecord[],
  riskSignals: RiskSignal[],
) {
  const currentDate = new Date();
  const overdueFollowUps = getOverdueFollowUps(
    records,
    currentDate,
  );
  const followUpsDueSoon = getFollowUpsDueSoon(
    records,
    currentDate,
  );
  const proposalsNeedingAction = getProposalsNeedingAction(
    proposals,
    currentDate,
  );
  const waitingApprovals = getWaitingApprovals(records);
  const invoicesToPrepare = getInvoicesToPrepare(invoices);
  const paymentsDueSoon = getInvoicesDueSoon(
    invoices,
    currentDate,
  );
  const overdueInvoices = getOverdueInvoices(
    invoices,
    currentDate,
  );
  const disputedInvoices = getDisputedInvoices(invoices);
  const blockedDeliveryTasks = getBlockedDeliveryTasks(tasks);
  const clientsWithActiveRisks =
    getClientsWithActiveWorkflowRisk(
      records,
      riskSignals,
    );

  return [
    {
      title: "Overdue Follow-Ups",
      description: "Leads or clients that should have been followed up already.",
      count: overdueFollowUps.length,
      clients: overdueFollowUps,
    },
    {
      title: "Follow-Ups Due Soon",
      description: "Upcoming follow-ups that need a clear next action.",
      count: followUpsDueSoon.length,
      clients: followUpsDueSoon,
    },
    {
      title: "Proposals Needing Action",
      description:
        "Proposals to prepare, revise, renew, or follow up.",
      count: proposalsNeedingAction.length,
      clients: getRelatedClientRecords(
        records,
        proposalsNeedingAction,
      ),
    },
    {
      title: "Approvals Waiting",
      description: "Client approvals that may block delivery progress.",
      count: waitingApprovals.length,
      clients: waitingApprovals,
    },
    {
      title: "Invoices To Prepare",
      description:
        "Draft invoices that still need to be prepared and sent.",
      count: invoicesToPrepare.length,
      clients: getRelatedClientRecords(
        records,
        invoicesToPrepare,
      ),
    },
    {
      title: "Payments Due Soon",
      description:
        "Outstanding invoices due within the next seven days.",
      count: paymentsDueSoon.length,
      clients: getRelatedClientRecords(
        records,
        paymentsDueSoon,
      ),
    },
    {
      title: "Overdue Invoices",
      description:
        "Unpaid invoices that have passed their due date.",
      count: overdueInvoices.length,
      clients: getRelatedClientRecords(
        records,
        overdueInvoices,
      ),
    },
    {
      title: "Payment Disputes",
      description:
        "Disputed payments that need human review before reminders continue.",
      count: disputedInvoices.length,
      clients: getRelatedClientRecords(
        records,
        disputedInvoices,
      ),
    },
    {
      title: "Blocked Delivery",
      description: "Delivery tasks that cannot move forward yet.",
      count: blockedDeliveryTasks.length,
      clients: getRelatedClientRecords(
        records,
        blockedDeliveryTasks,
      ),
    },
    {
      title: "Clients Needing Attention",
      description:
        "Clients with one or more open workflow issues.",
      count: clientsWithActiveRisks.length,
      clients: clientsWithActiveRisks,
    },
  ];
}

const workspaceViews = new Set<WorkspaceView>([
  "today",
  "workflow-snapshot",
  "client-records",
  "action-queue",
  "activity",
]);

function getWorkspaceViewFromHash(): WorkspaceView {
  const hashView = window.location.hash.slice(1);

  return workspaceViews.has(hashView as WorkspaceView)
    ? (hashView as WorkspaceView)
    : "today";
}

function getSelectedRecordStorageKey(workspaceId: string) {
  return `client-operations:selected-record:${workspaceId}`;
}

function getPersistedSelectedRecordId(workspaceId: string) {
  return window.localStorage.getItem(
    getSelectedRecordStorageKey(workspaceId),
  );
}

function persistSelectedRecordId(
  workspaceId: string,
  recordId: string | undefined,
) {
  const storageKey = getSelectedRecordStorageKey(workspaceId);

  if (recordId) {
    window.localStorage.setItem(storageKey, recordId);
  } else {
    window.localStorage.removeItem(storageKey);
  }
}


type WorkspaceDashboardProps = {
  onSignOut: () => void;
  userEmail: string | null;
  workspaceId: string;
  workspaceName: string;
};

function WorkspaceDashboard({
  onSignOut,
  userEmail,
  workspaceId,
  workspaceName,
}: WorkspaceDashboardProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const workspaceApi = useMemo(
    () => createWorkspaceApplicationApi(supabase, workspaceId),
    [supabase, workspaceId],
  );
  const isSavingRecordRef = useRef(false);
  const updatingWorkflowTaskIdsRef =
  useRef(new Set<string>());
  const [records, setRecords] = useState<ClientWorkflowRecord[]>([]);
  const [engagements, setEngagements] =
    useState<ClientEngagement[]>([]);
  const [followUps, setFollowUps] =
    useState<EngagementFollowUp[]>([]);
  const [followUpsStatus, setFollowUpsStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [followUpsMessage, setFollowUpsMessage] = useState("");
  const [isSavingFollowUp, setIsSavingFollowUp] =
    useState(false);
  const [riskSignals, setRiskSignals] = useState<RiskSignal[]>([]);
  const [riskSignalsStatus, setRiskSignalsStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [riskSignalsMessage, setRiskSignalsMessage] =
    useState("");
  const [isSavingRiskSignal, setIsSavingRiskSignal] =
    useState(false);

  const [proposals, setProposals] = useState<ProposalRecord[]>([]);

  const [proposalsStatus, setProposalsStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [proposalsMessage, setProposalsMessage] = useState("");
  const [isSavingProposal, setIsSavingProposal] = useState(false);

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [invoicesStatus, setInvoicesStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [invoicesMessage, setInvoicesMessage] = useState("");
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [
    isApplyingInvoiceRecommendation,
    setIsApplyingInvoiceRecommendation,
  ] = useState(false);

  const [
    isApplyingProposalRecommendation,
    setIsApplyingProposalRecommendation,
  ] = useState(false);

  const [recordsStatus, setRecordsStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [recordsMessage, setRecordsMessage] = useState("");

  const [activityLogs, setActivityLogs] =
    useState<ActivityLog[]>([]);
  const [activityLogsStatus, setActivityLogsStatus] =
    useState<"loading" | "ready" | "error">("loading");
  const [activityLogsMessage, setActivityLogsMessage] =
    useState("");
  const [handoffNotes, setHandoffNotes] =
    useState<HandoffNote[]>([]);
  const [handoffNotesStatus, setHandoffNotesStatus] =
    useState<"loading" | "ready" | "error">("loading");
  const [isSavingHandoffNote, setIsSavingHandoffNote] =
    useState(false);
  const [handoffNotesMessage, setHandoffNotesMessage] =
    useState("");
  const [workflowTasks, setWorkflowTasks] =
  useState<WorkflowTask[]>([]);
  const [workflowTasksStatus, setWorkflowTasksStatus] =
    useState<"loading" | "ready" | "error">("loading");

  const [workflowTasksMessage, setWorkflowTasksMessage] =
    useState("");
  const [isSavingWorkflowTask, setIsSavingWorkflowTask] =
  useState(false);
  const [
  updatingWorkflowTaskId,
  setUpdatingWorkflowTaskId,
] = useState<string | null>(null);
  const [recordFilters, setRecordFilters] = useState(initialRecordFilters);
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] =
    useState<string>();
  const [selectedDetailTab, setSelectedDetailTab] =
  useState<DetailTab>("overview");
  const [activeWorkspaceView, setActiveWorkspaceView] =
    useState<WorkspaceView>("today");

  const filteredRecords = useMemo(
    () => filterRecords(records, recordFilters),
    [recordFilters, records],
  );

  const recordOwners = useMemo(() => getRecordOwners(records), [records]);

  const prioritySections = useMemo(
    () =>
      buildPrioritySections(
        records,
        workflowTasks,
        proposals,
        invoices,
        riskSignals,
      ),
    [
      invoices,
      proposals,
      records,
      riskSignals,
      workflowTasks,
    ],
  );
  const activePrioritySections = prioritySections.filter(
    (section) => section.count > 0,
  );
  const clearPrioritySections = prioritySections.filter(
    (section) => section.count === 0,
  );
  const isPriorityLoading =
    recordsStatus === "loading" ||
    workflowTasksStatus === "loading" ||
    proposalsStatus === "loading" ||
    invoicesStatus === "loading" ||
    riskSignalsStatus === "loading";

  const selectedRecord =
    filteredRecords.find((record) => record.id === selectedRecordId) ||
    filteredRecords[0] ||
    null;

  const selectedEngagement = useMemo(
    () =>
      selectedRecord
        ? engagements.find(
            (engagement) =>
              engagement.clientWorkflowRecordId ===
                selectedRecord.id && engagement.isPrimary,
          ) ?? null
        : null,
    [engagements, selectedRecord],
  );

  function getPrimaryEngagement(
    clientWorkflowRecordId: string,
  ) {
    const engagement = engagements.find(
      (candidate) =>
        candidate.clientWorkflowRecordId ===
          clientWorkflowRecordId && candidate.isPrimary,
    );

    if (!engagement) {
      throw new Error(
        "The client engagement could not be found. Refresh and try again.",
      );
    }

    return engagement;
  }

  const selectedRecordProposals = useMemo(
    () =>
      selectedRecord
        ? proposals.filter(
            (proposal) =>
              proposal.clientEngagementId ===
              selectedEngagement?.id,
          )
        : [],
    [proposals, selectedEngagement, selectedRecord],
  );
  const selectedRecordInvoices = useMemo(
    () =>
      selectedRecord
        ? invoices.filter(
            (invoice) =>
              invoice.clientEngagementId ===
              selectedEngagement?.id,
          )
        : [],
    [invoices, selectedEngagement, selectedRecord],
  );

  const selectedRecordRiskSignals = useMemo(
    () =>
      selectedRecord
        ? riskSignals.filter(
            (signal) =>
              signal.clientEngagementId ===
              selectedEngagement?.id,
          )
        : [],
    [riskSignals, selectedEngagement, selectedRecord],
  );

  const selectedRecordTasks = useMemo(
    () =>
      selectedEngagement
        ? workflowTasks.filter(
            (task) =>
              task.clientEngagementId === selectedEngagement.id,
          )
        : [],
    [selectedEngagement, workflowTasks],
  );

  const selectedRecordActivityLogs = useMemo(
    () =>
      selectedEngagement
        ? activityLogs.filter(
            (log) =>
              log.clientEngagementId === selectedEngagement.id,
          )
        : [],
    [activityLogs, selectedEngagement],
  );

  const selectedRecordHandoffNotes = useMemo(
    () =>
      selectedEngagement
        ? handoffNotes.filter(
            (note) =>
              note.clientEngagementId === selectedEngagement.id,
          )
        : [],
    [handoffNotes, selectedEngagement],
  );

  const selectedRecordFollowUps = useMemo(
    () =>
      selectedEngagement
        ? followUps.filter(
            (followUp) =>
              followUp.clientEngagementId ===
              selectedEngagement.id,
          )
        : [],
    [followUps, selectedEngagement],
  );

  useEffect(() => {
    function syncWorkspaceView() {
      setActiveWorkspaceView(getWorkspaceViewFromHash());
    }

    syncWorkspaceView();
    window.addEventListener("hashchange", syncWorkspaceView);
    window.addEventListener("popstate", syncWorkspaceView);

    return () => {
      window.removeEventListener(
        "hashchange",
        syncWorkspaceView,
      );
      window.removeEventListener("popstate", syncWorkspaceView);
    };
  }, []);

  function navigateWorkspaceView(view: WorkspaceView) {
    setActiveWorkspaceView(view);

    const nextHash = `#${view}`;

    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({
        behavior: "smooth",
        top: 0,
      });
    });
  }

  function changeWorkspaceView(view: WorkspaceView) {
    if (view === "client-records") {
      setSelectedDetailTab("overview");
    }

    navigateWorkspaceView(view);
  }

  function rememberSelectedRecord(recordId: string | undefined) {
    setSelectedRecordId(recordId);
    persistSelectedRecordId(workspaceId, recordId);
  }

  function changeRecordFilters(nextFilters: RecordFilters) {
    const nextVisibleRecords = filterRecords(records, nextFilters);

    setRecordFilters(nextFilters);

    if (
      nextVisibleRecords.length > 0 &&
      !nextVisibleRecords.some(
        (record) => record.id === selectedRecordId,
      )
    ) {
      rememberSelectedRecord(nextVisibleRecords[0].id);
    }
  }

  function selectClientRecord(recordId: string) {
    rememberSelectedRecord(recordId);
    setSelectedDetailTab("overview");
  }

  function openClientStage(stage: LifecycleStage) {
    const stageFilters: RecordFilters = {
      ...initialRecordFilters,
      stage,
    };
    const firstStageRecord = records.find(
      (record) => record.lifecycleStage === stage,
    );

    setRecordFilters(stageFilters);

    if (firstStageRecord) {
      rememberSelectedRecord(firstStageRecord.id);
    }

    setSelectedDetailTab("overview");
    navigateWorkspaceView("client-records");
  }

  function openClientRecord(recordId: string) {
    setRecordFilters(initialRecordFilters);
    rememberSelectedRecord(recordId);
    setSelectedDetailTab("overview");
    navigateWorkspaceView("client-records");
  }

  function reviewClientWorkflow(recordId: string) {
    setRecordFilters(initialRecordFilters);
    rememberSelectedRecord(recordId);
    setSelectedDetailTab("workflow-health");
    navigateWorkspaceView("client-records");
  }

  function openClientActivity(recordId: string) {
    setRecordFilters(initialRecordFilters);
    rememberSelectedRecord(recordId);
    setSelectedDetailTab("activity");
    navigateWorkspaceView("client-records");
  }

  useEffect(() => {
    let isMounted = true;

    async function loadRecords() {
      setRecordsStatus("loading");
      setRecordsMessage("");
      setRiskSignalsStatus("loading");
      setRiskSignalsMessage("");

      try {
        const [workspaceRecords, workspaceEngagements] =
          await Promise.all([
            workspaceApi.clientRecords.list(),
            workspaceApi.engagements.list(),
          ]);

        const reconciliationResults = await Promise.allSettled(
          workspaceEngagements.map((engagement) =>
            reconcileClientRiskSignals(
              supabase,
              workspaceId,
              engagement.clientWorkflowRecordId,
              engagement.id,
            ),
          ),
        );

        if (!isMounted) {
          return;
        }

        const reconciledRecords =
          new Map<string, ClientWorkflowRecord>();
        const reconciledEngagements =
          new Map<string, ClientEngagement>();
        const loadedRiskSignals: RiskSignal[] = [];
        let failedReconciliations = 0;

        reconciliationResults.forEach((result) => {
          if (result.status === "fulfilled") {
            if (result.value.clientEngagement.isPrimary) {
              reconciledRecords.set(
                result.value.clientRecord.id,
                result.value.clientRecord,
              );
            }
            reconciledEngagements.set(
              result.value.clientEngagement.id,
              result.value.clientEngagement,
            );
            loadedRiskSignals.push(
              ...result.value.riskSignals,
            );
          } else {
            failedReconciliations += 1;
            console.error(
              "Workflow health review failed",
              result.reason,
            );
          }
        });

        const currentRecords = workspaceRecords.map(
          (record) =>
            reconciledRecords.get(record.id) ?? record,
        );
        const persistedRecordId =
          getPersistedSelectedRecordId(workspaceId);
        const nextSelectedRecordId = currentRecords.some(
          (record) => record.id === persistedRecordId,
        )
          ? persistedRecordId ?? undefined
          : currentRecords[0]?.id;

        setRecords(currentRecords);
        setEngagements(
          workspaceEngagements.map(
            (engagement) =>
              reconciledEngagements.get(engagement.id) ??
              engagement,
          ),
        );
        setRiskSignals(loadedRiskSignals);
        setSelectedRecordId(nextSelectedRecordId);
        persistSelectedRecordId(
          workspaceId,
          nextSelectedRecordId,
        );
        setRecordsStatus("ready");

        if (failedReconciliations > 0) {
          setRiskSignalsStatus("error");
          setRiskSignalsMessage(
            "Some workflow health information could not be refreshed. Refresh and try again.",
          );
        } else {
          setRiskSignalsStatus("ready");
        }
      } catch (error) {
        console.error("Workspace records load failed", error);

        if (!isMounted) {
          return;
        }

        setRecordsStatus("error");
        setRecordsMessage(
          "Workspace records could not be loaded. Refresh and try again.",
        );
        setRiskSignalsStatus("error");
        setRiskSignalsMessage(
          "Workflow health could not be reviewed because the client records did not load.",
        );
      }
    }

    void loadRecords();

    return () => {
      isMounted = false;
    };
  }, [supabase, workspaceApi, workspaceId]);

    useEffect(() => {
    if (recordsStatus !== "ready") {
      return;
    }

    let isMounted = true;

    async function loadActivityHistory() {
      setActivityLogsStatus("loading");
      setActivityLogsMessage("");

      try {
        const workspaceActivityLogs =
          await getWorkspaceActivityLogs(
            supabase,
            workspaceId,
          );

        if (!isMounted) {
          return;
        }

        setActivityLogs(workspaceActivityLogs);
        setActivityLogsStatus("ready");
      } catch (error) {
        console.error(
          "Workspace activity history load failed",
          error,
        );

        if (!isMounted) {
          return;
        }

        setActivityLogsStatus("error");
        setActivityLogsMessage(
          "Activity history could not be loaded. Refresh and try again.",
        );
      }
    }

    void loadActivityHistory();

    return () => {
      isMounted = false;
    };
  }, [recordsStatus, supabase, workspaceId]);

  useEffect(() => {
    if (recordsStatus !== "ready") {
      return;
    }

    let isMounted = true;

    async function loadHandoffNotes() {
      setHandoffNotesStatus("loading");
      setHandoffNotesMessage("");

      try {
        const workspaceHandoffNotes =
          await workspaceApi.handoffNotes.list();

        if (!isMounted) {
          return;
        }

        setHandoffNotes(workspaceHandoffNotes);
        setHandoffNotesStatus("ready");
      } catch (error) {
        console.error(
          "Workspace handoff notes load failed",
          error,
        );

        if (!isMounted) {
          return;
        }

        setHandoffNotesStatus("error");
        setHandoffNotesMessage(
          "Handoff notes could not be loaded. Refresh and try again.",
        );
      }
    }

    void loadHandoffNotes();

    return () => {
      isMounted = false;
    };
  }, [recordsStatus, workspaceApi]);

  useEffect(() => {
    if (recordsStatus !== "ready") {
      return;
    }

    let isMounted = true;

    async function loadWorkflowTasks() {
      setWorkflowTasksStatus("loading");
      setWorkflowTasksMessage("");

      try {
        const workspaceWorkflowTasks =
          await workspaceApi.workItems.list();

        if (!isMounted) {
          return;
        }

        setWorkflowTasks(workspaceWorkflowTasks);
        setWorkflowTasksStatus("ready");
      } catch (error) {
        console.error(
          "Workspace work items load failed",
          error,
        );

        if (!isMounted) {
          return;
        }

        setWorkflowTasksStatus("error");
        setWorkflowTasksMessage(
          "Work items could not be loaded. Refresh and try again.",
        );
      }
    }

    void loadWorkflowTasks();

    return () => {
      isMounted = false;
    };
  }, [recordsStatus, workspaceApi]);

  useEffect(() => {
    let isMounted = true;

    async function loadProposals() {
      setProposalsStatus("loading");
      setProposalsMessage("");

      try {
        const workspaceProposals =
          await workspaceApi.proposals.list();

        if (!isMounted) {
          return;
        }

        setProposals(workspaceProposals);
        setProposalsStatus("ready");
      } catch (error) {
        console.error("Workspace proposals load failed", error);

        if (!isMounted) {
          return;
        }

        setProposalsStatus("error");
        setProposalsMessage(
          "Proposals and quotes could not be loaded. Refresh and try again.",
        );
      }
    }

    void loadProposals();

    return () => {
      isMounted = false;
    };
  }, [workspaceApi]);

  useEffect(() => {
    let isMounted = true;

    async function loadFollowUps() {
      setFollowUpsStatus("loading");
      setFollowUpsMessage("");

      try {
        const workspaceFollowUps =
          await workspaceApi.followUps.list();

        if (!isMounted) {
          return;
        }

        setFollowUps(workspaceFollowUps);
        setFollowUpsStatus("ready");
      } catch (error) {
        console.error(
          "Workspace completed follow-ups load failed",
          error,
        );

        if (!isMounted) {
          return;
        }

        setFollowUpsStatus("error");
        setFollowUpsMessage(
          "Completed follow-ups could not be loaded. Refresh and try again.",
        );
      }
    }

    void loadFollowUps();

    return () => {
      isMounted = false;
    };
  }, [workspaceApi]);

  useEffect(() => {
    let isMounted = true;

    async function loadInvoices() {
      setInvoicesStatus("loading");
      setInvoicesMessage("");

      try {
        const workspaceInvoices =
          await getWorkspaceInvoiceRecords(
            supabase,
            workspaceId,
          );

        if (!isMounted) {
          return;
        }

        setInvoices(workspaceInvoices);
        setInvoicesStatus("ready");
      } catch (error) {
        console.error("Workspace invoices load failed", error);

        if (!isMounted) {
          return;
        }

        setInvoicesStatus("error");
        setInvoicesMessage(
          "Invoices and payment details could not be loaded. Refresh and try again.",
        );
      }
    }

    void loadInvoices();

    return () => {
      isMounted = false;
    };
  }, [supabase, workspaceId]);

  async function addRecord(record: NewClientWorkflowRecord) {
    try {
      const result = await workspaceApi.clientRecords.create({
        commandId: createOperationRequestId(),
        record,
      });
      const savedRecord = result.clientRecord;

      setRecords((currentRecords) => [
        savedRecord,
        ...currentRecords,
      ]);
      setEngagements((currentEngagements) => [
        result.clientEngagement,
        ...currentEngagements,
      ]);
      applyRiskReconciliation(result.reconciliation);
      setRiskSignalsStatus("ready");
      setRiskSignalsMessage("");
      await refreshActivityHistory();

      setRecordFilters(initialRecordFilters);
      rememberSelectedRecord(savedRecord.id);
      setSelectedDetailTab("overview");
      setIsAddRecordOpen(false);
      setRecordsMessage("");
    } catch (error) {
      console.error(
        "Create client workflow record failed",
        error,
      );

      setRecordsMessage(
        error instanceof Error
          ? error.message
          : "The record could not be saved. Please try again.",
      );
    }
  }

  async function completeFollowUp(
    completion: CompleteFollowUpInput,
  ) {
    if (!selectedEngagement) {
      throw new Error(
        "The client engagement could not be found. Refresh and try again.",
      );
    }

    setIsSavingFollowUp(true);
    setFollowUpsMessage("");

    try {
      const result = await workspaceApi.followUps.complete({
        commandId: createOperationRequestId(),
        clientEngagementId: selectedEngagement.id,
        expectedUpdatedAt: selectedEngagement.updatedAt,
        completion,
      });

      setFollowUps((currentFollowUps) => [
        result.followUp,
        ...currentFollowUps.filter(
          (followUp) => followUp.id !== result.followUp.id,
        ),
      ]);
      applyRiskReconciliation(result.reconciliation);
      setFollowUpsStatus("ready");
      setRiskSignalsStatus("ready");
      setRiskSignalsMessage("");
      await refreshActivityHistory();
    } catch (error) {
      const followUpError =
        error instanceof Error
          ? error
          : new Error("The follow-up could not be completed.");

      setFollowUpsMessage(followUpError.message);
      throw followUpError;
    } finally {
      setIsSavingFollowUp(false);
    }
  }

  async function addHandoffNote(
    handoffNote: NewHandoffNote,
  ) {
    setIsSavingHandoffNote(true);
    setHandoffNotesMessage("");

    try {
      const engagement = getPrimaryEngagement(
        handoffNote.clientWorkflowRecordId,
      );
      const result = await workspaceApi.handoffNotes.create({
        commandId: createOperationRequestId(),
        clientEngagementId: engagement.id,
        note: handoffNote,
      });
      const savedHandoffNote = result.handoffNote;

      setHandoffNotes((currentNotes) => [
        savedHandoffNote,
        ...currentNotes,
      ]);

      await refreshActivityHistory();
    } catch (error) {
      const handoffError =
        error instanceof Error
          ? error
          : new Error(
              "The handoff note could not be saved.",
            );

      setHandoffNotesMessage(handoffError.message);
      throw handoffError;
    } finally {
      setIsSavingHandoffNote(false);
    }
  }

  async function addWorkflowTask(task: NewWorkflowTask) {
    setIsSavingWorkflowTask(true);
    setWorkflowTasksMessage("");

    try {
      const engagement = getPrimaryEngagement(
        task.clientWorkflowRecordId,
      );
      const result = await workspaceApi.workItems.create({
        commandId: createOperationRequestId(),
        clientEngagementId: engagement.id,
        task,
      });
      const savedTask = result.workItem;

      setWorkflowTasks((currentTasks) => [
        savedTask,
        ...currentTasks,
      ]);

      applyRiskReconciliation(result.reconciliation);
      setRiskSignalsStatus("ready");
      setRiskSignalsMessage("");
      await refreshActivityHistory();
    } catch (error) {
      const taskError =
        error instanceof Error
          ? error
          : new Error("The work item could not be saved.");

      setWorkflowTasksMessage(taskError.message);
      throw taskError;
    } finally {
      setIsSavingWorkflowTask(false);
    }
  }

  async function saveWorkflowTaskStatus(
    workflowTaskId: string,
    update: WorkflowTaskStatusUpdate,
  ) {
    const previousTask = workflowTasks.find(
      (task) => task.id === workflowTaskId,
    );

    if (!previousTask) {
      throw new Error("The work item could not be found.");
    }

    if (previousTask.status === update.status) {
      return;
    }

    if (
      updatingWorkflowTaskIdsRef.current.has(
        workflowTaskId,
      )
    ) {
      return;
    }

    updatingWorkflowTaskIdsRef.current.add(
      workflowTaskId,
    );
    setUpdatingWorkflowTaskId(workflowTaskId);
    setWorkflowTasksMessage("");

    try {
      const result =
        await workspaceApi.workItems.updateStatus({
          commandId: createOperationRequestId(),
          clientEngagementId:
            previousTask.clientEngagementId,
          workItemId: workflowTaskId,
          expectedStatus: previousTask.status,
          update,
        });
      const savedTask = result.workItem;

      setWorkflowTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === savedTask.id ? savedTask : task,
        ),
      );

      applyRiskReconciliation(result.reconciliation);
      setRiskSignalsStatus("ready");
      setRiskSignalsMessage("");
      await refreshActivityHistory();
    } catch (error) {
      const taskError =
        error instanceof Error
          ? error
          : new Error(
              "The work item status could not be saved.",
            );

      setWorkflowTasksMessage(taskError.message);
      throw taskError;
    } finally {
      updatingWorkflowTaskIdsRef.current.delete(
        workflowTaskId,
      );
      setUpdatingWorkflowTaskId((currentId) =>
        currentId === workflowTaskId ? null : currentId,
      );
    }
  }

  function updateSelectedRecord(
    updates: ClientWorkflowRecordUpdates,
    note: string,
  ) {
    void saveSelectedRecordUpdates(updates, note);
  }

    async function refreshActivityHistory() {
    try {
      const workspaceActivityLogs =
        await getWorkspaceActivityLogs(
          supabase,
          workspaceId,
        );

      setActivityLogs(workspaceActivityLogs);
      setActivityLogsStatus("ready");
      setActivityLogsMessage("");
    } catch (error) {
      console.error(
        "Workspace activity history refresh failed",
        error,
      );
      setActivityLogsStatus("error");
      setActivityLogsMessage(
        "Activity history could not be refreshed. Refresh and try again.",
      );
    }
  }

  async function recordActivity(
    activity: NewActivityLog,
  ) {
    try {
      const savedActivity = await createActivityLog(
        supabase,
        workspaceId,
        activity,
      );

      setActivityLogs((currentLogs) => [
        savedActivity,
        ...currentLogs.filter(
          (log) => log.id !== savedActivity.id,
        ),
      ]);
      setActivityLogsStatus("ready");
      setActivityLogsMessage("");
    } catch (error) {
      console.error(
        "Workspace activity history insert failed",
        error,
      );
      setActivityLogsStatus("error");
      setActivityLogsMessage(
        "The change was saved, but activity history could not be updated. Refresh and try again.",
      );
    }
  }
  function applyRiskReconciliation(
    result: Awaited<
      ReturnType<typeof reconcileClientRiskSignals>
    >,
  ) {
    setRecords((currentRecords) =>
      currentRecords.map((record) =>
        record.id === result.clientRecord.id
          ? result.clientRecord
          : record,
      ),
    );
    setEngagements((currentEngagements) =>
      currentEngagements.map((engagement) =>
        engagement.id === result.clientEngagement.id
          ? result.clientEngagement
          : engagement,
      ),
    );

    setRiskSignals((currentSignals) => [
      ...currentSignals.filter(
        (signal) =>
          signal.clientEngagementId !==
          result.clientEngagement.id,
      ),
      ...result.riskSignals,
    ]);
  }

  async function refreshRiskSignalsAfterChange(
    clientWorkflowRecordId: string,
    clientEngagementId: string,
  ) {
    try {
      const result = await reconcileClientRiskSignals(
        supabase,
        workspaceId,
        clientWorkflowRecordId,
        clientEngagementId,
      );

      applyRiskReconciliation(result);
      setRiskSignalsStatus("ready");
      setRiskSignalsMessage("");

      if (result.changed) {
        await refreshActivityHistory();
      }
    } catch (error) {
      console.error(
        "Workflow health refresh after record change failed",
        error,
      );
      setRiskSignalsStatus("error");
      setRiskSignalsMessage(
        "The change was saved, but workflow health could not be refreshed. Refresh and try again.",
      );
    }
  }

  async function saveRiskSignalStatus(
    riskSignalId: string,
    update: RiskSignalStatusUpdate,
  ) {
    const existingSignal = riskSignals.find(
      (signal) => signal.id === riskSignalId,
    );

    if (!existingSignal) {
      throw new Error("The risk item could not be found.");
    }

    setIsSavingRiskSignal(true);
    setRiskSignalsMessage("");

    try {
      const savedSignal = await updateRiskSignalStatus(
        supabase,
        workspaceId,
        riskSignalId,
        update,
      );

      setRiskSignals((currentSignals) =>
        currentSignals.map((signal) =>
          signal.id === savedSignal.id
            ? savedSignal
            : signal,
        ),
      );

      try {
        const result = await reconcileClientRiskSignals(
          supabase,
          workspaceId,
          savedSignal.clientWorkflowRecordId,
          savedSignal.clientEngagementId,
        );

        applyRiskReconciliation(result);
        setRiskSignalsStatus("ready");

        if (result.changed) {
          await refreshActivityHistory();
        }

        const reconciledSignal = result.riskSignals.find(
          (signal) => signal.id === savedSignal.id,
        );

        if (
          update.status === "Resolved" &&
          reconciledSignal?.status === "Open"
        ) {
          setRiskSignalsMessage(
            "This risk remains open because the underlying issue is still present. Complete the recommended next step before resolving it.",
          );
        }
      } catch (error) {
        console.error(
          "Workflow health refresh after review failed",
          error,
        );
        setRiskSignalsStatus("error");
        setRiskSignalsMessage(
          "The review was saved, but the health score could not be refreshed. Refresh and try again.",
        );
      }
    } catch (error) {
      const riskError =
        error instanceof Error
          ? error
          : new Error("The risk review could not be saved.");

      setRiskSignalsMessage(riskError.message);
      throw riskError;
    } finally {
      setIsSavingRiskSignal(false);
    }
  }
  async function saveSelectedRecordUpdates(
    updates: ClientWorkflowRecordUpdates,
    note: string,
  ) {
    if (!selectedRecord) {
      return false;
    }

    if (isSavingRecordRef.current) {
      return false;
    }

    const previousRecord = selectedRecord;
    const hasChanges = Object.entries(updates).some(
      ([key, value]) =>
        value !==
        previousRecord[key as keyof ClientWorkflowRecord],
    );

    if (!hasChanges) {
      setRecordsMessage("No workflow changes to save.");
      return false;
    }

    isSavingRecordRef.current = true;
    const now = new Date().toISOString();

    setRecords((currentRecords) =>
      currentRecords.map((record) =>
        record.id === selectedRecord.id
          ? {
              ...record,
              ...updates,
              updatedAt: now,
            }
          : record,
      ),
    );

    try {
      const result = await workspaceApi.clientRecords.update({
        commandId: createOperationRequestId(),
        clientRecordId: selectedRecord.id,
        expectedUpdatedAt: previousRecord.updatedAt,
        updates,
        activityNote: note,
      });
      const savedRecord = result.clientRecord;

      setRecords((currentRecords) =>
        currentRecords.map((record) =>
          record.id === savedRecord.id ? savedRecord : record,
        ),
      );
      setEngagements((currentEngagements) =>
        currentEngagements.map((engagement) =>
          engagement.id === result.clientEngagement.id
            ? result.clientEngagement
            : engagement,
        ),
      );
      applyRiskReconciliation(result.reconciliation);
      setRiskSignalsStatus("ready");
      setRiskSignalsMessage("");
      await refreshActivityHistory();

      setRecordsMessage("");
      return true;
    } catch (error) {
      console.error("Client workflow record update failed", error);

      setRecords((currentRecords) =>
        currentRecords.map((record) =>
          record.id === previousRecord.id ? previousRecord : record,
        ),
      );

      setRecordsMessage(
        error instanceof Error
          ? error.message
          : "The record could not be updated. Please try again.",
      );
    }finally {
      isSavingRecordRef.current = false;
    }

    return false;
  }


  async function addProposal(proposal: NewProposalRecord) {
    setIsSavingProposal(true);
    setProposalsMessage("");

    try {
      const engagement = getPrimaryEngagement(
        proposal.clientWorkflowRecordId,
      );
      const result = await workspaceApi.proposals.create({
        commandId: createOperationRequestId(),
        clientEngagementId: engagement.id,
        proposal,
      });
      const savedProposal = result.proposal;

      setProposals((currentProposals) => [
        savedProposal,
        ...currentProposals,
      ]);
      applyRiskReconciliation(result.reconciliation);
      setRiskSignalsStatus("ready");
      setRiskSignalsMessage("");
      await refreshActivityHistory();
    } catch (error) {
      const proposalError =
        error instanceof Error
          ? error
          : new Error("The proposal could not be saved.");

      setProposalsMessage(proposalError.message);
      throw proposalError;
    } finally {
      setIsSavingProposal(false);
    }
  }

  async function addInvoice(invoice: NewInvoiceRecord) {
    setIsSavingInvoice(true);
    setInvoicesMessage("");

    try {
      const savedInvoice = await createInvoiceRecord(
        supabase,
        workspaceId,
        getPrimaryEngagement(
          invoice.clientWorkflowRecordId,
        ).id,
        invoice,
      );

      setInvoices((currentInvoices) => [
        savedInvoice,
        ...currentInvoices,
      ]);

      await refreshRiskSignalsAfterChange(
        savedInvoice.clientWorkflowRecordId,
        savedInvoice.clientEngagementId,
      );

      const invoiceLabel =
        savedInvoice.status === "Not needed"
          ? "Invoice not needed"
          : savedInvoice.invoiceNumber
            ? `Invoice ${savedInvoice.invoiceNumber}`
            : "Invoice preparation";

        await recordActivity({
        clientWorkflowRecordId:
          savedInvoice.clientWorkflowRecordId,
        clientEngagementId:
          savedInvoice.clientEngagementId,
        actionType: "Invoice added",
        note: `${invoiceLabel} was added with status: ${getInvoiceStatusLabel(savedInvoice.status)}.`,
      });
    } catch (error) {
      const invoiceError =
        error instanceof Error
          ? error
          : new Error("The invoice could not be saved.");

      setInvoicesMessage(invoiceError.message);
      throw invoiceError;
    } finally {
      setIsSavingInvoice(false);
    }
  }

  async function saveInvoiceUpdates(
    invoiceId: string,
    updates: InvoiceRecordUpdates,
  ) {
    const previousInvoice = invoices.find(
      (invoice) => invoice.id === invoiceId,
    );

    setIsSavingInvoice(true);
    setInvoicesMessage("");

    try {
      const savedInvoice = await updateInvoiceRecord(
        supabase,
        workspaceId,
        invoiceId,
        updates,
      );

      setInvoices((currentInvoices) =>
        currentInvoices.map((invoice) =>
          invoice.id === savedInvoice.id ? savedInvoice : invoice,
        ),
      );
      await refreshRiskSignalsAfterChange(
        savedInvoice.clientWorkflowRecordId,
        savedInvoice.clientEngagementId,
      );
      const statusChanged =
        previousInvoice?.status !== savedInvoice.status;

      const disputeOpened =
        previousInvoice?.status !== "Disputed" &&
        savedInvoice.status === "Disputed";

      const disputeResolved =
        previousInvoice?.status === "Disputed" &&
        savedInvoice.status !== "Disputed" &&
        Boolean(savedInvoice.disputeResolvedAt);

      const invoiceReference = savedInvoice.invoiceNumber
        ? `Invoice ${savedInvoice.invoiceNumber}`
        : "The invoice";

      let actionType = "Invoice payment details updated";
      let activityNote =
        `${invoiceReference} payment details were updated.`;

      if (disputeResolved) {
        actionType = "Invoice dispute resolved";
        activityNote =
          `${invoiceReference} dispute was resolved. ` +
          `Resolution: ${savedInvoice.disputeResolutionOutcome}. ` +
          `${savedInvoice.disputeResolutionNote}`;
      } else if (disputeOpened) {
        actionType = "Invoice dispute opened";
        activityNote =
          `${invoiceReference} was marked as disputed. ` +
          `Reason: ${savedInvoice.disputeReason}`;
      } else if (statusChanged) {
        actionType = "Invoice status updated";
        activityNote =
          `${invoiceReference} changed from ` +
          `${
            previousInvoice
              ? getInvoiceStatusLabel(previousInvoice.status)
              : "its previous status"
          } to ${getInvoiceStatusLabel(savedInvoice.status)}.`;
      }

      await recordActivity({
        clientWorkflowRecordId:
          savedInvoice.clientWorkflowRecordId,
        clientEngagementId:
          savedInvoice.clientEngagementId,
        actionType,
        note: activityNote,
      });
    } catch (error) {
      const invoiceError =
        error instanceof Error
          ? error
          : new Error("The invoice could not be updated.");

      setInvoicesMessage(invoiceError.message);
      throw invoiceError;
    } finally {
      setIsSavingInvoice(false);
    }
  }

  async function applyInvoiceRecommendation(
    invoice: InvoiceRecord,
    recommendation: InvoiceRecommendationData,
  ) {
    if (
      !selectedRecord ||
      invoice.clientWorkflowRecordId !== selectedRecord.id
    ) {
      throw new Error(
        "The invoice is not linked to the selected client.",
      );
    }

    setIsApplyingInvoiceRecommendation(true);
    setInvoicesMessage("");

    try {
      const result =
        await applyInvoiceWorkflowRecommendationTransaction(
          supabase,
          workspaceId,
          invoice,
          recommendation.effectiveStatus,
          recommendation.updates,
        );

      setRecords((current) =>
        current.map((record) =>
          record.id === result.clientRecord.id
            ? result.clientRecord
            : record,
        ),
      );

      setInvoices((current) =>
        current.map((item) =>
          item.id === result.invoice.id
            ? result.invoice
            : item,
        ),
      );
      setEngagements(
        await workspaceApi.engagements.list(),
      );
      await refreshRiskSignalsAfterChange(
        result.invoice.clientWorkflowRecordId,
        result.invoice.clientEngagementId,
      );
      if (!result.alreadyApplied) {
        await recordActivity({
          clientWorkflowRecordId:
            result.invoice.clientWorkflowRecordId,
          clientEngagementId:
            result.invoice.clientEngagementId,
          actionType: "Invoice payment step applied",
          note: `${recommendation.title} was applied to the client workflow.`,
        });
      }
    } catch (error) {
      const invoiceError =
        error instanceof Error
          ? error
          : new Error(
              "The recommended payment step could not be applied.",
            );

      setInvoicesMessage(invoiceError.message);
      throw invoiceError;
    } finally {
      setIsApplyingInvoiceRecommendation(false);
    }
  }

  async function saveProposalUpdates(
    proposalId: string,
    updates: ProposalRecordUpdates,
  ) {
    const previousProposal = proposals.find(
      (proposal) => proposal.id === proposalId,
    );

    if (!previousProposal) {
      throw new Error(
        "The proposal is no longer available. Refresh and try again.",
      );
    }

    setIsSavingProposal(true);
    setProposalsMessage("");

    try {
      const result = await workspaceApi.proposals.update({
        commandId: createOperationRequestId(),
        clientEngagementId:
          previousProposal.clientEngagementId,
        proposalId,
        expectedUpdatedAt: previousProposal.updatedAt,
        updates,
      });
      const savedProposal = result.proposal;

      setProposals((currentProposals) =>
        currentProposals.map((proposal) =>
          proposal.id === savedProposal.id
            ? savedProposal
            : proposal,
        ),
      );
      applyRiskReconciliation(result.reconciliation);
      setRiskSignalsStatus("ready");
      setRiskSignalsMessage("");
      await refreshActivityHistory();
    } catch (error) {
      const proposalError =
        error instanceof Error
          ? error
          : new Error("The proposal could not be updated.");

      setProposalsMessage(proposalError.message);
      throw proposalError;
    } finally {
      setIsSavingProposal(false);
    }
  }

  async function applyProposalRecommendation(
    proposal: ProposalRecord,
    recommendation: ProposalWorkflowRecommendationData,
  ) {
    if (
      !selectedRecord ||
      proposal.clientWorkflowRecordId !== selectedRecord.id
    ) {
      throw new Error(
        "The proposal is not linked to the selected client.",
      );
    }

    if (proposal.workflowActionAppliedStatus === proposal.status) {
      return;
    }

    setIsApplyingProposalRecommendation(true);
    setProposalsMessage("");
    setRecordsMessage("");

    try {
      const result =
        await workspaceApi.proposals.applyRecommendation({
          commandId: createOperationRequestId(),
          clientEngagementId: proposal.clientEngagementId,
          proposalId: proposal.id,
          clientWorkflowRecordId:
            proposal.clientWorkflowRecordId,
          expectedStatus: proposal.status,
          updates: recommendation.updates,
        });

      setRecords((currentRecords) =>
        currentRecords.map((record) =>
          record.id === result.clientRecord.id
            ? result.clientRecord
            : record,
        ),
      );

      setProposals((currentProposals) =>
        currentProposals.map((currentProposal) =>
          currentProposal.id === result.proposal.id
            ? result.proposal
            : currentProposal,
        ),
      );
      setEngagements(
        await workspaceApi.engagements.list(),
      );
      applyRiskReconciliation(result.reconciliation);
      setRiskSignalsStatus("ready");
      setRiskSignalsMessage("");
      await refreshActivityHistory();
    } catch (error) {
      const applicationError =
        error instanceof Error
          ? error
          : new Error(
              "The recommended next step could not be applied.",
            );

      setProposalsMessage(applicationError.message);
      throw applicationError;
    } finally {
      setIsApplyingProposalRecommendation(false);
    }
  }

  return (
    <WorkspaceShell
      activeView={activeWorkspaceView}
      onSignOut={onSignOut}
      onViewChange={changeWorkspaceView}
      userEmail={userEmail}
      workspaceName={workspaceName}
    >
      {activeWorkspaceView === "today" ? (
        <div id="today">
          <section>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#5F6862]">
              Today&apos;s Priority View
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              What needs attention today
            </h2>
            <p className="mt-3 max-w-3xl leading-7 text-[#5F6862]">
              Review follow-ups, approvals, payments, delivery
              blockers, and workflow issues before moving into
              individual records.
            </p>
          </section>

          <section className="mt-7 pb-8" id="today-priorities">
            {isPriorityLoading ? (
              <p className="border-y border-[#D9DED8] py-5 font-semibold text-[#5F6862]">
                Reviewing today&apos;s priorities...
              </p>
            ) : (
              <>
                {activePrioritySections.length > 0 ? (
                  <div>
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                      <h3 className="text-xl font-bold text-[#17201C]">
                        Attention now
                      </h3>
                      <p className="text-sm font-semibold text-[#5F6862]">
                        {activePrioritySections.length === 1
                          ? "1 category needs attention"
                          : `${activePrioritySections.length} categories need attention`}
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                      {activePrioritySections.map((section) => (
                        <PriorityCard
                          clients={section.clients}
                          count={section.count}
                          description={section.description}
                          key={section.title}
                          title={section.title}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border-y border-[#D9DED8] py-5">
                    <h3 className="text-xl font-bold text-[#17201C]">
                      No priorities need attention today
                    </h3>
                    <p className="mt-1 text-sm text-[#5F6862]">
                      All monitored workflow categories are clear.
                    </p>
                  </div>
                )}

                {clearPrioritySections.length > 0 ? (
                  <div className="mt-8 border-t border-[#D9DED8] pt-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-bold text-[#17201C]">
                        Clear today
                      </h3>
                      <p className="text-sm text-[#5F6862]">
                        {clearPrioritySections.length} categories
                      </p>
                    </div>
                    <div className="mt-2 grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
                      {clearPrioritySections.map((section) => (
                        <PrioritySummaryRow
                          description={section.description}
                          key={section.title}
                          title={section.title}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : null}

      {activeWorkspaceView === "workflow-snapshot" ? (
        <WorkspaceSnapshot
          errorMessage={
            recordsMessage ||
            riskSignalsMessage ||
            workflowTasksMessage
          }
          isLoading={
            recordsStatus === "loading" ||
            riskSignalsStatus === "loading" ||
            workflowTasksStatus === "loading"
          }
          onOpenRecord={openClientRecord}
          onOpenStage={openClientStage}
          records={records}
          riskSignals={riskSignals}
          tasks={workflowTasks}
        />
      ) : null}

      {activeWorkspaceView === "action-queue" ? (
        <div id="action-queue">
          <WorkspaceHealthQueue
            errorMessage={riskSignalsMessage}
            isLoading={
              recordsStatus === "loading" ||
              riskSignalsStatus === "loading"
            }
            onReviewRecord={reviewClientWorkflow}
            records={records}
            riskSignals={riskSignals}
          />
        </div>
      ) : null}

      {activeWorkspaceView === "activity" ? (
        <WorkspaceActivity
          activityLogs={activityLogs}
          errorMessage={activityLogsMessage}
          isLoading={activityLogsStatus === "loading"}
          onOpenRecord={openClientActivity}
          records={records}
        />
      ) : null}

      {activeWorkspaceView === "client-records" ? (
        <div id="client-records">
          <section id="records">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#5F6862]">
                  Client Records
                </p>
                <h2 className="mt-3 text-3xl font-bold">
                  Leads and clients in progress
                </h2>
                <p className="mt-3 leading-7 text-[#5F6862]">
                  Select a record to review workflow status, work
                  items, handoff notes, and activity history.
                </p>
              </div>

              <button
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174F42]"
                onClick={() =>
                  setIsAddRecordOpen((isOpen) => !isOpen)
                }
                type="button"
              >
                {isAddRecordOpen ? (
                  <X aria-hidden="true" className="size-5" />
                ) : (
                  <Plus aria-hidden="true" className="size-5" />
                )}
                {isAddRecordOpen
                  ? "Close form"
                  : "Add lead or client"}
              </button>
            </div>

            {isAddRecordOpen ? (
              <div className="mt-6">
                <ClientRecordForm onAddRecord={addRecord} />
              </div>
            ) : null}

            {records.length > 0 ? (
              <div className="mt-7">
                <RecordFiltersBar
                  filters={recordFilters}
                  onChange={changeRecordFilters}
                  onReset={() =>
                    changeRecordFilters(initialRecordFilters)
                  }
                  owners={recordOwners}
                />
              </div>
            ) : null}
            {recordsMessage ? (
              <p className="mt-5 rounded-md bg-white p-4 font-semibold text-red-700">
                {recordsMessage}
              </p>
            ) : null}
            {recordsStatus === "loading" ? (
              <div className="mt-7 rounded-lg border border-[#D9DED8] bg-white p-6">
                <h3 className="text-2xl font-bold text-[#17201C]">
                  Loading client records
                </h3>
                <p className="mt-3 leading-7 text-[#5F6862]">
                  Checking this workspace for saved leads and
                  client workflow records.
                </p>
              </div>
            ) : records.length === 0 ? (
              <div className="mt-7 rounded-lg border border-[#D9DED8] bg-white p-6">
                <h3 className="text-2xl font-bold text-[#17201C]">
                  No client records yet
                </h3>
                <p className="mt-3 max-w-2xl leading-7 text-[#5F6862]">
                  Add your first lead or client to start tracking
                  follow-ups, work items, handoff notes, and
                  activity history.
                </p>
                <button
                  className="mt-5 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B]"
                  onClick={() => setIsAddRecordOpen(true)}
                  type="button"
                >
                  Add First Lead Or Client
                </button>
              </div>
            ) : filteredRecords.length === 0 ? (
              <p className="mt-6 rounded-md border border-[#D9DED8] bg-white p-5 text-[#5F6862]">
                No records match the current filters.
              </p>
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] lg:items-start">
                <div className="min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1">
                  <div className="lg:hidden">
                    <label
                      className="font-bold text-[#17201C]"
                      htmlFor="mobile-client-record"
                    >
                      Client
                    </label>
                    <select
                      className="mt-2 w-full rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
                      id="mobile-client-record"
                      onChange={(event) =>
                        selectClientRecord(event.target.value)
                      }
                      value={selectedRecord?.id ?? ""}
                    >
                      {filteredRecords.map((record) => (
                        <option key={record.id} value={record.id}>
                          {record.name}
                          {record.businessName
                            ? ` | ${record.businessName}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="hidden content-start gap-3 lg:grid">
                    <div className="flex items-baseline justify-between gap-3 px-1">
                      <h3 className="font-bold text-[#17201C]">
                        Clients
                      </h3>
                      <p className="text-sm text-[#5F6862]">
                        {filteredRecords.length}
                      </p>
                    </div>

                    {filteredRecords.map((record) => (
                      <ClientRecordCard
                        isSelected={
                          record.id === selectedRecord?.id
                        }
                        key={record.id}
                        onSelect={() =>
                          selectClientRecord(record.id)
                        }
                        record={record}
                      />
                    ))}
                  </div>
                </div>

                {selectedRecord ? (
                  <div className="min-w-0">
                    <ClientRecordDetail
                      activeTab={selectedDetailTab}
                      activityMessage={activityLogsMessage}
                      activityLogs={selectedRecordActivityLogs}
                      followUpMessage={followUpsMessage}
                      followUps={selectedRecordFollowUps}
                      handoffMessage={handoffNotesMessage}
                      handoffNotes={selectedRecordHandoffNotes}
                      invoiceMessage={invoicesMessage}
                      invoices={selectedRecordInvoices}
                      isActivityLoading={
                        activityLogsStatus === "loading"
                      }
                      isApplyingInvoiceRecommendation={
                        isApplyingInvoiceRecommendation
                      }
                      isApplyingProposalRecommendation={
                        isApplyingProposalRecommendation
                      }
                      isFollowUpLoading={
                        followUpsStatus === "loading"
                      }
                      isFollowUpSaving={isSavingFollowUp}
                      isHandoffLoading={
                        handoffNotesStatus === "loading"
                      }
                      isHandoffSaving={isSavingHandoffNote}
                      isInvoiceLoading={
                        invoicesStatus === "loading"
                      }
                      isInvoiceSaving={isSavingInvoice}
                      isProposalLoading={
                        proposalsStatus === "loading"
                      }
                      isProposalSaving={isSavingProposal}
                      isRiskSignalSaving={isSavingRiskSignal}
                      isRiskSignalsLoading={
                        riskSignalsStatus === "loading"
                      }
                      isTaskSaving={isSavingWorkflowTask}
                      isTasksLoading={
                        workflowTasksStatus === "loading"
                      }
                      onAddHandoffNote={addHandoffNote}
                      onAddInvoice={addInvoice}
                      onAddProposal={addProposal}
                      onAddTask={addWorkflowTask}
                      onCompleteFollowUp={completeFollowUp}
                      onApplyInvoiceRecommendation={
                        applyInvoiceRecommendation
                      }
                      onApplyProposalRecommendation={
                        applyProposalRecommendation
                      }
                      onTabChange={setSelectedDetailTab}
                      onUpdateInvoice={saveInvoiceUpdates}
                      onUpdateProposal={saveProposalUpdates}
                      onUpdateRecord={updateSelectedRecord}
                      onUpdateRiskSignalStatus={
                        saveRiskSignalStatus
                      }
                      onUpdateTaskStatus={
                        saveWorkflowTaskStatus
                      }
                      proposalMessage={proposalsMessage}
                      proposals={selectedRecordProposals}
                      record={selectedRecord}
                      riskSignalMessage={riskSignalsMessage}
                      riskSignals={selectedRecordRiskSignals}
                      tasks={selectedRecordTasks}
                      tasksMessage={workflowTasksMessage}
                      updatingTaskId={updatingWorkflowTaskId}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}

export default function Home() {
  return (
    <WorkspaceGate>
      {({ onSignOut, userEmail, workspace }) =>
        workspace ? (
          <WorkspaceDashboard
            key={workspace.id}
            onSignOut={onSignOut}
            userEmail={userEmail}
            workspaceId={workspace.id}
            workspaceName={workspace.name}
          />
        ) : null
      }
    </WorkspaceGate>
  );
}
