import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DurableProviderRun = {
  id: string;
  workspace_id: string;
  retry_count: number;
  max_retries: number;
  max_model_calls: number;
  execution_deadline_at: string;
  lease_expires_at: string | null;
  updated_at: string;
};

type DurableProviderRequest = {
  serviceClient: SupabaseClient;
  run: DurableProviderRun;
  workerId: string;
  apiKey: string;
  provider: string;
  model: string;
  body: Record<string, unknown>;
  onRunUpdated?: (run: DurableProviderRun) => void;
};

const retryableStatuses = new Set([408, 409, 425, 429]);
const maximumAttemptDurationMs = 45_000;

function isRetryableStatus(status: number) {
  return retryableStatuses.has(status) || status >= 500;
}

function remainingDurationMs(run: DurableProviderRun) {
  return Date.parse(run.execution_deadline_at) - Date.now();
}

function describeProviderFailure(
  response: Response | null,
  error: unknown,
) {
  if (response) {
    return `The provider returned status ${response.status}.`;
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return "The provider request timed out.";
  }

  return "The provider request could not be completed.";
}

async function waitForRetry(
  retryNumber: number,
  run: DurableProviderRun,
) {
  const delayMs = Math.min(2_000, 500 * retryNumber);
  const remainingMs = remainingDurationMs(run);

  if (remainingMs <= delayMs) {
    throw new Error(
      "The Operations Agent run reached its execution deadline.",
    );
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function fetchOpenAiWithDurableRetry({
  serviceClient,
  run: initialRun,
  workerId,
  apiKey,
  provider,
  model,
  body,
  onRunUpdated,
}: DurableProviderRequest): Promise<Response> {
  let run = initialRun;

  while (true) {
    const remainingMs = remainingDurationMs(run);

    if (remainingMs <= 0) {
      throw new Error(
        "The Operations Agent run reached its execution deadline.",
      );
    }

    let response: Response | null = null;
    let requestError: unknown = null;

    try {
      response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(
            Math.max(
              1,
              Math.min(maximumAttemptDurationMs, remainingMs),
            ),
          ),
        },
      );
    } catch (error) {
      requestError = error;
    }

    if (response?.ok) {
      return response;
    }

    const canRetry =
      run.retry_count < run.max_retries &&
      (!response || isRetryableStatus(response.status));

    if (!canRetry) {
      throw new Error(
        describeProviderFailure(response, requestError),
      );
    }

    const retryNumber = run.retry_count + 1;
    const { data, error } = await serviceClient.rpc(
      "agent_record_operations_agent_retry",
      {
        p_workspace_id: run.workspace_id,
        p_run_id: run.id,
        p_worker_id: workerId,
        p_retry_number: retryNumber,
        p_failure_code: response
          ? `provider_http_${response.status}`
          : "provider_network_failure",
        p_failure_message: describeProviderFailure(
          response,
          requestError,
        ),
        p_provider: provider,
        p_model: model,
        p_usage_idempotency_key: randomUUID(),
      },
    );

    if (error) {
      throw error;
    }

    const updatedRun = (data as { run?: DurableProviderRun } | null)
      ?.run;

    if (!updatedRun) {
      throw new Error(
        "The Operations Agent retry could not be recorded.",
      );
    }

    run = updatedRun;
    onRunUpdated?.(run);
    await waitForRetry(retryNumber, run);
  }
}
