import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type {
  GuidedClientIntakeDraftValues,
  GuidedClientIntakeField,
  GuidedClientIntakeUncertainty,
} from "@/lib/operations-agent-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const intakeFields = [
  "name",
  "email",
  "businessName",
  "source",
  "interest",
  "clientType",
  "returningClientStatus",
  "lifecycleStage",
  "priority",
  "riskLevel",
  "nextAction",
  "nextFollowUpAt",
  "assignedTo",
  "message",
] as const satisfies readonly GuidedClientIntakeField[];

const intakeFieldSet = new Set<string>(intakeFields);

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

const nullableDate = {
  anyOf: [
    {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    },
    {
      type: "null",
    },
  ],
} as const;

function nullableEnum(values: readonly string[]) {
  return {
    anyOf: [
      {
        type: "string",
        enum: values,
      },
      {
        type: "null",
      },
    ],
  };
}

const guidedClientIntakeSchema = {
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
      required: [...intakeFields, "summary"],
      properties: {
        name: nullableText,
        email: nullableText,
        businessName: nullableText,
        source: nullableText,
        interest: nullableText,
        clientType: nullableEnum([
          "Lead",
          "New client",
          "Active client",
          "Returning client",
          "Past client",
        ]),
        returningClientStatus: nullableEnum([
          "Not returning",
          "Potential reactivation",
          "Repeat project opportunity",
          "Reactivated",
          "Dormant",
        ]),
        lifecycleStage: nullableEnum([
          "New lead",
          "Qualified lead",
          "Follow-up needed",
          "Discovery or call booked",
          "Proposal sent",
          "Won client",
          "Onboarding",
          "In delivery",
          "Waiting for approval",
          "Payment follow-up",
          "Completed",
          "Lost or inactive",
        ]),
        priority: nullableEnum(["High", "Medium", "Low"]),
        riskLevel: nullableEnum(["High", "Medium", "Low"]),
        nextAction: nullableText,
        nextFollowUpAt: nullableDate,
        assignedTo: nullableText,
        message: nullableText,
        summary: {
          type: "string",
          minLength: 1,
          maxLength: 2000,
        },
      },
    },
    missingFields: {
      type: "array",
      maxItems: intakeFields.length,
      uniqueItems: true,
      items: {
        type: "string",
        enum: intakeFields,
      },
    },
    uncertainFields: {
      type: "array",
      maxItems: intakeFields.length,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "reason"],
        properties: {
          field: {
            type: "string",
            enum: intakeFields,
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
      maxItems: intakeFields.length,
      items: {
        type: "string",
        minLength: 3,
        maxLength: 500,
      },
    },
  },
} as const;

type IntakeResponse = {
  values: GuidedClientIntakeDraftValues;
  missingFields: GuidedClientIntakeField[];
  uncertainFields: GuidedClientIntakeUncertainty[];
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
        throw new Error("The provider declined this intake request.");
      }

      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  throw new Error("The provider returned no structured intake draft.");
}

function normalizeNullableText(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("The provider returned an invalid intake field.");
  }

  const normalized = value.trim();
  return normalized || null;
}

function validateIntakeResponse(value: unknown): IntakeResponse {
  if (!value || typeof value !== "object") {
    throw new Error("The provider returned an invalid intake draft.");
  }

  const result = value as Partial<IntakeResponse>;

  if (!result.values || typeof result.values !== "object") {
    throw new Error("The provider returned invalid client details.");
  }

  const sourceValues = result.values as Record<string, unknown>;
  const normalizedValues = {} as Record<
    GuidedClientIntakeField,
    string | null
  >;

  intakeFields.forEach((field) => {
    normalizedValues[field] = normalizeNullableText(
      sourceValues[field],
    );
  });

  if (
    typeof sourceValues.summary !== "string" ||
    sourceValues.summary.trim().length < 1
  ) {
    throw new Error("The provider returned no intake summary.");
  }

  const declaredMissing = Array.isArray(result.missingFields)
    ? result.missingFields
    : [];
  const missingFields = Array.from(
    new Set([
      ...declaredMissing.filter(
        (field): field is GuidedClientIntakeField =>
          typeof field === "string" && intakeFieldSet.has(field),
      ),
      ...intakeFields.filter(
        (field) => normalizedValues[field] === null,
      ),
    ]),
  );

  const uncertainFields = Array.isArray(result.uncertainFields)
    ? result.uncertainFields.map((uncertainty) => {
        if (
          !uncertainty ||
          typeof uncertainty !== "object" ||
          !intakeFieldSet.has(
            String(
              (uncertainty as GuidedClientIntakeUncertainty)
                .field,
            ),
          ) ||
          typeof (
            uncertainty as GuidedClientIntakeUncertainty
          ).reason !== "string"
        ) {
          throw new Error(
            "The provider returned an invalid uncertainty.",
          );
        }

        return {
          field: (
            uncertainty as GuidedClientIntakeUncertainty
          ).field,
          reason: (
            uncertainty as GuidedClientIntakeUncertainty
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
      summary: sourceValues.summary.trim(),
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
  const workerId = `guided-client-intake:${referenceId}`;
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
        error: "Sign in before starting guided client intake.",
        referenceId,
      });
    }

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey ||
      !openAiApiKey
    ) {
      console.error("Guided intake server configuration is incomplete", {
        referenceId,
      });
      return jsonResponse(503, {
        error:
          "Guided client intake is not configured. The manual client form remains available.",
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
        error: "The guided client intake request is incomplete.",
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
        error: "The Operations Agent run is unavailable.",
        referenceId,
      });
    }

    const run = runData as RunRow;

    if (
      run.initiated_by !== user.id ||
      run.capability !== "guided_client_intake" ||
      run.mode !== "suggest"
    ) {
      return jsonResponse(403, {
        error: "This Operations Agent run is unavailable.",
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
          "This Operations Agent run changed elsewhere. Refresh before trying again.",
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
            "You structure client intake for an operations workspace.",
            "Extract only facts stated in the user's intake.",
            "Never invent dates, owners, amounts, statuses, commitments, risk, priority, or relationship history.",
            "Use null for every missing field.",
            "If wording is ambiguous, preserve the safest literal value when possible and list the field under uncertainFields.",
            "A relative date such as next week is uncertain and must not be converted to an exact date.",
            "Keep summary factual and concise.",
            "Do not recommend or perform workflow changes.",
          ].join(" "),
          input: claimedRun.objective,
          max_output_tokens: 1800,
          text: {
            format: {
              type: "json_schema",
              name: "guided_client_intake",
              strict: true,
              schema: guidedClientIntakeSchema,
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

    const intake = validateIntakeResponse(
      JSON.parse(extractResponseText(openAiResponse)),
    );
    const resultHash = createHash("sha256")
      .update(
        JSON.stringify({
          intake,
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
        "agent_record_guided_client_intake_result",
        {
          p_workspace_id: input.workspaceId,
          p_run_id: input.runId,
          p_worker_id: workerId,
          p_result_hash: resultHash,
          p_draft: intake.values,
          p_missing_fields: intake.missingFields,
          p_uncertain_fields: intake.uncertainFields,
          p_clarification_questions:
            intake.clarificationQuestions,
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
    console.error("Guided client intake failed", {
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
            "agent_fail_guided_client_intake_run",
            {
              p_workspace_id: claimedRun.workspace_id,
              p_run_id: claimedRun.id,
              p_worker_id: workerId,
              p_failure_code: "guided_intake_failed",
              p_failure_message:
                "The provider did not produce a usable client intake draft.",
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
        console.error("Guided intake failure could not be recorded", {
          referenceId,
          failureRecordingError,
        });
      }
    }

    return jsonResponse(502, {
      error:
        "The Operations Agent could not prepare a client draft. The manual client form remains available.",
      referenceId,
    });
  }
}
