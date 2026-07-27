import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  workspaceWorkingDays,
  workspaceWorkflowStages,
  type GuidedWorkspaceSetupDraftValues,
  type GuidedWorkspaceSetupField,
  type GuidedWorkspaceSetupUncertainty,
  type WorkspaceWorkingDay,
  type WorkspaceWorkflowStage,
} from "@/lib/operations-agent-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const setupFields = [
  "businessType",
  "workflowStages",
  "commonOwners",
  "workingDays",
  "dailyBriefingEnabled",
  "immediateFailureAlertsEnabled",
  "opportunityAlertsEnabled",
] as const satisfies readonly GuidedWorkspaceSetupField[];

const setupFieldSet = new Set<string>(setupFields);

const nullableText = {
  anyOf: [
    {
      type: "string",
      maxLength: 5000,
    },
    {
      type: "null",
    },
  ],
} as const;

const nullableBoolean = {
  anyOf: [
    {
      type: "boolean",
    },
    {
      type: "null",
    },
  ],
} as const;

const guidedWorkspaceSetupSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "values",
    "missingFields",
    "uncertainFields",
    "clarificationQuestions",
  ],
  properties: {
    values: {
      type: "object",
      additionalProperties: false,
      required: [...setupFields, "summary"],
      properties: {
        businessType: nullableText,
        workflowStages: {
          type: "array",
          maxItems: workspaceWorkflowStages.length,
          items: {
            type: "string",
            enum: workspaceWorkflowStages,
          },
        },
        commonOwners: {
          type: "array",
          maxItems: 10,
          items: {
            type: "string",
            minLength: 1,
            maxLength: 80,
          },
        },
        workingDays: {
          type: "array",
          maxItems: workspaceWorkingDays.length,
          items: {
            type: "string",
            enum: workspaceWorkingDays,
          },
        },
        dailyBriefingEnabled: nullableBoolean,
        immediateFailureAlertsEnabled: nullableBoolean,
        opportunityAlertsEnabled: nullableBoolean,
        summary: {
          type: "string",
          minLength: 1,
          maxLength: 2000,
        },
      },
    },
    missingFields: {
      type: "array",
      maxItems: setupFields.length,
      items: {
        type: "string",
        enum: setupFields,
      },
    },
    uncertainFields: {
      type: "array",
      maxItems: setupFields.length,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "reason"],
        properties: {
          field: {
            type: "string",
            enum: setupFields,
          },
          reason: {
            type: "string",
            minLength: 2,
            maxLength: 500,
          },
        },
      },
    },
    clarificationQuestions: {
      type: "array",
      maxItems: setupFields.length,
      items: {
        type: "string",
        minLength: 3,
        maxLength: 500,
      },
    },
  },
} as const;

type SetupResponse = {
  values: GuidedWorkspaceSetupDraftValues;
  missingFields: GuidedWorkspaceSetupField[];
  uncertainFields: GuidedWorkspaceSetupUncertainty[];
  clarificationQuestions: string[];
};

type RunRow = {
  id: string;
  workspace_id: string;
  initiated_by: string;
  capability: string;
  mode: string;
  objective: string;
  state: string;
  updated_at: string;
};

type RouteInput = {
  workspaceId?: unknown;
  runId?: unknown;
  expectedUpdatedAt?: unknown;
};

type OpenAiResponse = {
  id?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: {
      cached_tokens?: number;
    };
  };
};

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}

function extractResponseText(response: OpenAiResponse) {
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "refusal" && content.refusal) {
        throw new Error("The provider declined this setup request.");
      }

      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  throw new Error("The provider returned no structured setup draft.");
}

function normalizeNullableText(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("The provider returned an invalid setup field.");
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeStringList<T extends string>(
  value: unknown,
  maximumItems: number,
  allowedValues?: ReadonlySet<string>,
) {
  if (!Array.isArray(value)) {
    throw new Error("The provider returned an invalid setup list.");
  }

  const normalized = value.map((item) => {
    if (typeof item !== "string") {
      throw new Error("The provider returned an invalid setup list.");
    }

    const nextItem = item.trim();
    if (
      !nextItem ||
      nextItem.length > 80 ||
      (allowedValues && !allowedValues.has(nextItem))
    ) {
      throw new Error("The provider returned an invalid setup list.");
    }

    return nextItem as T;
  });

  return Array.from(new Set(normalized)).slice(0, maximumItems);
}

function normalizeNullableBoolean(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "boolean") {
    throw new Error("The provider returned an invalid preference.");
  }

  return value;
}

function validateSetupResponse(value: unknown): SetupResponse {
  if (!value || typeof value !== "object") {
    throw new Error("The provider returned an invalid setup draft.");
  }

  const result = value as Partial<SetupResponse>;

  if (!result.values || typeof result.values !== "object") {
    throw new Error("The provider returned invalid workspace details.");
  }

  const sourceValues = result.values as Record<string, unknown>;
  const normalizedValues: GuidedWorkspaceSetupDraftValues = {
    businessType: normalizeNullableText(sourceValues.businessType),
    workflowStages: normalizeStringList<WorkspaceWorkflowStage>(
      sourceValues.workflowStages,
      workspaceWorkflowStages.length,
      new Set(workspaceWorkflowStages),
    ),
    commonOwners: normalizeStringList<string>(
      sourceValues.commonOwners,
      10,
    ),
    workingDays: normalizeStringList<WorkspaceWorkingDay>(
      sourceValues.workingDays,
      workspaceWorkingDays.length,
      new Set(workspaceWorkingDays),
    ),
    dailyBriefingEnabled: normalizeNullableBoolean(
      sourceValues.dailyBriefingEnabled,
    ),
    immediateFailureAlertsEnabled: normalizeNullableBoolean(
      sourceValues.immediateFailureAlertsEnabled,
    ),
    opportunityAlertsEnabled: normalizeNullableBoolean(
      sourceValues.opportunityAlertsEnabled,
    ),
    summary: "",
  };

  if (
    typeof sourceValues.summary !== "string" ||
    sourceValues.summary.trim().length < 1
  ) {
    throw new Error("The provider returned no setup summary.");
  }
  normalizedValues.summary = sourceValues.summary.trim();

  const declaredMissing = Array.isArray(result.missingFields)
    ? result.missingFields
    : [];
  const missingFields = Array.from(
    new Set([
      ...declaredMissing.filter(
        (field): field is GuidedWorkspaceSetupField =>
          typeof field === "string" && setupFieldSet.has(field),
      ),
      ...setupFields.filter(
        (field) =>
          normalizedValues[field] === null ||
          (Array.isArray(normalizedValues[field]) &&
            normalizedValues[field].length === 0),
      ),
    ]),
  );

  const uncertainFields = Array.isArray(result.uncertainFields)
    ? result.uncertainFields.map((uncertainty) => {
        if (
          !uncertainty ||
          typeof uncertainty !== "object" ||
          !setupFieldSet.has(
            String(
              (uncertainty as GuidedWorkspaceSetupUncertainty)
                .field,
            ),
          ) ||
          typeof (
            uncertainty as GuidedWorkspaceSetupUncertainty
          ).reason !== "string"
        ) {
          throw new Error(
            "The provider returned an invalid uncertainty.",
          );
        }

        return {
          field: (
            uncertainty as GuidedWorkspaceSetupUncertainty
          ).field,
          reason: (
            uncertainty as GuidedWorkspaceSetupUncertainty
          ).reason.trim(),
        };
      })
    : [];

  const clarificationQuestions = Array.isArray(
    result.clarificationQuestions,
  )
    ? result.clarificationQuestions
        .filter(
          (question): question is string =>
            typeof question === "string",
        )
        .map((question) => question.trim())
        .filter(Boolean)
    : [];

  return {
    values: {
      ...normalizedValues,
    },
    missingFields,
    uncertainFields,
    clarificationQuestions,
  };
}

function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
) {
  const rates =
    model === "gpt-5.6-luna"
      ? {
          input: 1,
          output: 6,
        }
      : {
          input: 5,
          output: 30,
        };

  return Number(
    (
      (inputTokens * rates.input +
        outputTokens * rates.output) /
      1_000_000
    ).toFixed(6),
  );
}

export async function POST(request: Request) {
  const referenceId = randomUUID();
  const workerId = `guided-workspace-setup:${referenceId}`;
  let claimedRun: RunRow | null = null;
  const provider = "openai";
  const model =
    process.env.OPENAI_OPERATIONS_AGENT_MODEL?.trim() ||
    "gpt-5.6-luna";
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;

  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return jsonResponse(401, {
        error: "Sign in before preparing workspace setup.",
        referenceId,
      });
    }

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey ||
      !openAiApiKey
    ) {
      console.error(
        "Guided workspace setup server configuration is incomplete",
        { referenceId },
      );
      return jsonResponse(503, {
        error:
          "Guided workspace setup is not available right now.",
        referenceId,
      });
    }

    const input = (await request.json()) as RouteInput;

    if (
      typeof input.workspaceId !== "string" ||
      typeof input.runId !== "string" ||
      typeof input.expectedUpdatedAt !== "string"
    ) {
      return jsonResponse(400, {
        error: "The workspace setup request is incomplete.",
        referenceId,
      });
    }

    const userClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      },
    );
    const serviceClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(accessToken);

    if (userError || !user) {
      return jsonResponse(401, {
        error: "Your session is no longer valid. Sign in again.",
        referenceId,
      });
    }

    const { data: runData, error: runError } = await userClient
      .from("operations_agent_runs")
      .select(
        "id, workspace_id, initiated_by, capability, mode, objective, state, updated_at",
      )
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.runId)
      .maybeSingle();

    if (runError || !runData) {
      return jsonResponse(404, {
        error: "This workspace setup draft is no longer available.",
        referenceId,
      });
    }

    const run = runData as RunRow;

    if (
      run.initiated_by !== user.id ||
      run.capability !== "guided_workspace_setup" ||
      run.mode !== "suggest"
    ) {
      return jsonResponse(403, {
        error: "This workspace setup draft is no longer available.",
        referenceId,
      });
    }

    if (run.state === "waiting_for_approval") {
      return jsonResponse(200, {
        runId: run.id,
        state: run.state,
      });
    }

    if (
      run.state !== "queued" ||
      run.updated_at !== input.expectedUpdatedAt
    ) {
      return jsonResponse(409, {
        error:
          "This workspace setup draft changed elsewhere. Refresh before trying again.",
        referenceId,
      });
    }

    const { data: claimData, error: claimError } =
      await serviceClient.rpc(
        "agent_claim_operations_agent_run",
        {
          p_workspace_id: input.workspaceId,
          p_run_id: input.runId,
          p_expected_updated_at: input.expectedUpdatedAt,
          p_worker_id: workerId,
        },
      );

    if (claimError) {
      throw claimError;
    }

    claimedRun = (claimData as { run?: RunRow } | null)
      ?.run ?? null;

    if (!claimedRun) {
      throw new Error("The Operations Agent run could not be claimed.");
    }

    const { data: currentProfile, error: profileError } =
      await userClient
        .from("workspace_operating_profiles")
        .select(
          "business_type, workflow_stages, common_owners, working_days, daily_briefing_enabled, immediate_failure_alerts_enabled, opportunity_alerts_enabled",
        )
        .eq("workspace_id", input.workspaceId)
        .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const providerResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          store: false,
          reasoning: {
            effort: "low",
          },
          safety_identifier: createHash("sha256")
            .update(user.id)
            .digest("hex"),
          instructions: [
            "You prepare a reviewed operating setup for one workspace.",
            "Use only facts in the requested setup and any supplied current configuration.",
            "When a current configuration exists, preserve its values unless the requested setup explicitly changes them.",
            "Never invent owner roles, working days, workflow stages, or notification choices.",
            "Use null for a missing boolean or text choice and an empty array for a missing list.",
            "Use only the provided workflow stage and working-day values.",
            "If wording is ambiguous, leave the affected value empty and list it under uncertainFields.",
            "Keep summary factual and concise.",
            "Write the summary, uncertainty reasons, and clarification questions as plain user-facing copy for the person reviewing the draft.",
            "Address the reviewer directly when useful; do not say 'the user' or mention models, schemas, tools, confidence scores, inference, or internal system states.",
            "Do not claim that anything has already been saved.",
          ].join(" "),
          input: JSON.stringify({
            requestedSetup: claimedRun.objective,
            currentConfiguration: currentProfile ?? null,
          }),
          max_output_tokens: 1800,
          text: {
            format: {
              type: "json_schema",
              name: "guided_workspace_setup",
              strict: true,
              schema: guidedWorkspaceSetupSchema,
            },
          },
        }),
      },
    );

    if (!providerResponse.ok) {
      throw new Error(
        `The provider request failed with status ${providerResponse.status}.`,
      );
    }

    const openAiResponse =
      (await providerResponse.json()) as OpenAiResponse;
    inputTokens = openAiResponse.usage?.input_tokens ?? 0;
    outputTokens = openAiResponse.usage?.output_tokens ?? 0;
    cachedInputTokens =
      openAiResponse.usage?.input_tokens_details
        ?.cached_tokens ?? 0;

    const setup = validateSetupResponse(
      JSON.parse(extractResponseText(openAiResponse)),
    );
    const resultHash = createHash("sha256")
      .update(
        JSON.stringify({
          setup,
          provider,
          model,
          responseId: openAiResponse.id ?? "",
          inputTokens,
          outputTokens,
          cachedInputTokens,
        }),
      )
      .digest("hex");
    const estimatedCostUsd = estimateCost(
      model,
      inputTokens,
      outputTokens,
    );

    const { data: resultData, error: resultError } =
      await serviceClient.rpc(
        "agent_record_guided_workspace_setup_result",
        {
          p_workspace_id: input.workspaceId,
          p_run_id: input.runId,
          p_worker_id: workerId,
          p_result_hash: resultHash,
          p_draft: setup.values,
          p_missing_fields: setup.missingFields,
          p_uncertain_fields: setup.uncertainFields,
          p_clarification_questions:
            setup.clarificationQuestions,
          p_provider: provider,
          p_model: model,
          p_provider_response_id: openAiResponse.id ?? "",
          p_input_tokens: inputTokens,
          p_output_tokens: outputTokens,
          p_cached_input_tokens: cachedInputTokens,
          p_estimated_cost_usd: estimatedCostUsd,
          p_chargeable_cost_usd: estimatedCostUsd,
          p_step_idempotency_key: randomUUID(),
          p_usage_idempotency_key: randomUUID(),
        },
      );

    if (resultError) {
      throw resultError;
    }

    const recorded = resultData as {
      run?: {
        id?: string;
        state?: string;
      };
      draft?: {
        id?: string;
      };
    } | null;

    return jsonResponse(200, {
      runId: recorded?.run?.id ?? input.runId,
      state: recorded?.run?.state ?? "waiting_for_approval",
      draftId: recorded?.draft?.id ?? null,
    });
  } catch (error) {
    console.error("Guided workspace setup failed", {
      referenceId,
      error,
    });

    if (claimedRun) {
      try {
        const supabaseUrl =
          process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
        const serviceRoleKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

        if (supabaseUrl && serviceRoleKey) {
          const serviceClient = createClient(
            supabaseUrl,
            serviceRoleKey,
            {
              auth: {
                autoRefreshToken: false,
                detectSessionInUrl: false,
                persistSession: false,
              },
            },
          );

          await serviceClient.rpc(
            "agent_fail_guided_workspace_setup_run",
            {
              p_workspace_id: claimedRun.workspace_id,
              p_run_id: claimedRun.id,
              p_worker_id: workerId,
              p_failure_code: "guided_workspace_setup_failed",
              p_failure_message:
                "The provider did not produce a usable workspace setup draft.",
              p_provider: provider,
              p_model: model,
              p_input_tokens: inputTokens,
              p_output_tokens: outputTokens,
              p_cached_input_tokens: cachedInputTokens,
              p_step_idempotency_key: randomUUID(),
              p_usage_idempotency_key: randomUUID(),
            },
          );
        }
      } catch (failureRecordingError) {
        console.error(
          "Guided workspace setup failure could not be recorded",
          { referenceId, failureRecordingError },
        );
      }
    }

    return jsonResponse(502, {
      error:
        "The Operations Agent could not prepare a workspace setup draft.",
      referenceId,
    });
  }
}
