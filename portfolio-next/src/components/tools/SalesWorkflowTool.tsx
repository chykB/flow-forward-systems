"use client";

import { useState } from "react";

import { SectionList } from "@/components/tools/SectionList";
import {
  crmToolOptions,
  generateSalesWorkflowResult,
  initialSalesWorkflowValues,
  leadSourceOptions,
  monthlyLeadVolumeOptions,
  responseTimeOptions,
  salesBusinessTypes,
  salesGoalOptions,
  salesTeamSizeOptions,
  validateSalesWorkflow,
  type SalesWorkflowErrors,
  type SalesWorkflowResult,
  type SalesWorkflowValues,
} from "@/lib/tools/salesWorkflow";

export function SalesWorkflowTool() {
  const [values, setValues] = useState<SalesWorkflowValues>(
    initialSalesWorkflowValues,
  );
  const [errors, setErrors] = useState<SalesWorkflowErrors>({});
  const [result, setResult] = useState<SalesWorkflowResult | null>(null);
  const [message, setMessage] = useState("");

  function updateField(field: keyof SalesWorkflowValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));

    setResult(null);
    setMessage("");
  }

  function toggleLeadSource(source: string) {
    setValues((currentValues) => {
      const exists = currentValues.leadSources.includes(source);

      return {
        ...currentValues,
        leadSources: exists
          ? currentValues.leadSources.filter((item) => item !== source)
          : [...currentValues.leadSources, source],
      };
    });

    setErrors((currentErrors) => ({
      ...currentErrors,
      leadSources: undefined,
    }));

    setResult(null);
    setMessage("");
  }

  function toggleSalesGoal(goal: string) {
    setValues((currentValues) => {
      const exists = currentValues.mainSalesGoals.includes(goal);

      return {
        ...currentValues,
        mainSalesGoals: exists
          ? currentValues.mainSalesGoals.filter((item) => item !== goal)
          : [...currentValues.mainSalesGoals, goal],
      };
    });

    setErrors((currentErrors) => ({
      ...currentErrors,
      mainSalesGoals: undefined,
    }));

    setResult(null);
    setMessage("");
  }

  function generateSalesPlan() {
    const validationErrors = validateSalesWorkflow(values);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setMessage("Please fix the highlighted fields.");
      return;
    }

    setResult(generateSalesWorkflowResult(values));
    setMessage("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <form
        className="grid gap-5 rounded-lg border border-[#D9DED8] bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          generateSalesPlan();
        }}
      >
        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="sales-business-type">
            Business type
          </label>
          <select
            id="sales-business-type"
            value={values.businessType}
            onChange={(event) => updateField("businessType", event.target.value)}
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
          >
            <option value="">Choose a business type</option>
            {salesBusinessTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.businessType ? (
            <p className="text-sm font-semibold text-red-700">{errors.businessType}</p>
          ) : null}
        </div>

        {values.businessType === "Other" ? (
          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="sales-business-type-other">
              Describe your business type
            </label>
            <input
              id="sales-business-type-other"
              value={values.businessTypeOther}
              onChange={(event) =>
                updateField("businessTypeOther", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
              type="text"
            />
            {errors.businessTypeOther ? (
              <p className="text-sm font-semibold text-red-700">
                {errors.businessTypeOther}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3">
          <p className="font-bold text-[#17201C]">Lead sources</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {leadSourceOptions.map((source) => (
              <label
                key={source}
                className="flex items-center gap-2 rounded-md border border-[#D9DED8] bg-white p-3 text-[#17201C]"
              >
                <input
                  checked={values.leadSources.includes(source)}
                  type="checkbox"
                  onChange={() => toggleLeadSource(source)}
                />
                {source}
              </label>
            ))}
          </div>
          {errors.leadSources ? (
            <p className="text-sm font-semibold text-red-700">{errors.leadSources}</p>
          ) : null}
        </div>

        {values.leadSources.includes("Other") ? (
          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="sales-lead-sources-other">
              List other lead sources
            </label>
            <input
              id="sales-lead-sources-other"
              value={values.leadSourcesOther}
              onChange={(event) =>
                updateField("leadSourcesOther", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
              type="text"
            />
            {errors.leadSourcesOther ? (
              <p className="text-sm font-semibold text-red-700">
                {errors.leadSourcesOther}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="sales-monthly-lead-volume">
              Monthly lead volume
            </label>
            <select
              id="sales-monthly-lead-volume"
              value={values.monthlyLeadVolume}
              onChange={(event) =>
                updateField("monthlyLeadVolume", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
            >
              <option value="">Choose volume</option>
              {monthlyLeadVolumeOptions.map((volume) => (
                <option key={volume} value={volume}>
                  {volume}
                </option>
              ))}
            </select>
            {errors.monthlyLeadVolume ? (
              <p className="text-sm font-semibold text-red-700">
                {errors.monthlyLeadVolume}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="sales-team-size">
              Sales team size
            </label>
            <select
              id="sales-team-size"
              value={values.teamSize}
              onChange={(event) => updateField("teamSize", event.target.value)}
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
            >
              <option value="">Choose team size</option>
              {salesTeamSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="sales-response-time">
              Current response time
            </label>
            <select
              id="sales-response-time"
              value={values.currentResponseTime}
              onChange={(event) =>
                updateField("currentResponseTime", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
            >
              <option value="">Choose response time</option>
              {responseTimeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            {errors.currentResponseTime ? (
              <p className="text-sm font-semibold text-red-700">
                {errors.currentResponseTime}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="sales-crm-tool">
            CRM or lead tracker
          </label>
          <select
            id="sales-crm-tool"
            value={values.crmTool}
            onChange={(event) => updateField("crmTool", event.target.value)}
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
          >
            <option value="">Choose CRM or tracker</option>
            {crmToolOptions.map((tool) => (
              <option key={tool} value={tool}>
                {tool}
              </option>
            ))}
          </select>
          {errors.crmTool ? (
            <p className="text-sm font-semibold text-red-700">{errors.crmTool}</p>
          ) : null}
        </div>

        {values.crmTool === "Other" ? (
          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="sales-crm-tool-other">
              Name the CRM or tracker
            </label>
            <input
              id="sales-crm-tool-other"
              value={values.crmToolOther}
              onChange={(event) => updateField("crmToolOther", event.target.value)}
              className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
              type="text"
            />
            {errors.crmToolOther ? (
              <p className="text-sm font-semibold text-red-700">
                {errors.crmToolOther}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="sales-current-lead-process">
            Current lead process
          </label>
          <textarea
            id="sales-current-lead-process"
            value={values.currentLeadProcess}
            onChange={(event) =>
              updateField("currentLeadProcess", event.target.value)
            }
            className="min-h-32 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="Describe how leads are captured, assigned, and tracked today."
          />
          {errors.currentLeadProcess ? (
            <p className="text-sm font-semibold text-red-700">
              {errors.currentLeadProcess}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="sales-qualification-process">
            Qualification process
          </label>
          <textarea
            id="sales-qualification-process"
            value={values.qualificationProcess}
            onChange={(event) =>
              updateField("qualificationProcess", event.target.value)
            }
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="Optional: how do you decide whether a lead is a good fit?"
          />
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="sales-follow-up-process">
            Follow-up process
          </label>
          <textarea
            id="sales-follow-up-process"
            value={values.followUpProcess}
            onChange={(event) =>
              updateField("followUpProcess", event.target.value)
            }
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="Describe how follow-up happens after the first reply."
          />
          {errors.followUpProcess ? (
            <p className="text-sm font-semibold text-red-700">
              {errors.followUpProcess}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="sales-deal-tracking-process">
            Deal tracking process
          </label>
          <textarea
            id="sales-deal-tracking-process"
            value={values.dealTrackingProcess}
            onChange={(event) =>
              updateField("dealTrackingProcess", event.target.value)
            }
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="Optional: describe how stages, proposals, won/lost deals, or reports are tracked."
          />
        </div>

        <div className="grid gap-3">
          <p className="font-bold text-[#17201C]">Sales workflow goals</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {salesGoalOptions.map((goal) => (
              <label
                key={goal}
                className="flex items-center gap-2 rounded-md border border-[#D9DED8] bg-white p-3 text-[#17201C]"
              >
                <input
                  checked={values.mainSalesGoals.includes(goal)}
                  type="checkbox"
                  onChange={() => toggleSalesGoal(goal)}
                />
                {goal}
              </label>
            ))}
          </div>
          {errors.mainSalesGoals ? (
            <p className="text-sm font-semibold text-red-700">
              {errors.mainSalesGoals}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="sales-main-problem">
            Main sales workflow problem
          </label>
          <textarea
            id="sales-main-problem"
            value={values.mainSalesProblem}
            onChange={(event) =>
              updateField("mainSalesProblem", event.target.value)
            }
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="Example: leads are missed, follow-up is slow, CRM updates are inconsistent."
          />
          {errors.mainSalesProblem ? (
            <p className="text-sm font-semibold text-red-700">
              {errors.mainSalesProblem}
            </p>
          ) : null}
        </div>

        {message ? (
          <p className="rounded-md bg-[#EDF3EF] p-4 font-semibold text-red-700">
            {message}
          </p>
        ) : null}

        <button
          className="rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B]"
          type="submit"
        >
          Generate Sales Workflow Plan
        </button>
      </form>

      <div className="rounded-lg border border-[#D9DED8] bg-white p-5">
        {result ? (
          <div className="grid gap-6">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-[#5F6862]">
                Sales Workflow Status
              </p>
              <p className="mt-2 rounded-md bg-[#EDF3EF] p-3 font-bold text-[#17201C]">
                {result.salesWorkflowHealth.status}
              </p>
              <p className="mt-3 leading-7 text-[#5F6862]">
                {result.salesWorkflowHealth.reason}
              </p>
            </div>

            <div>
              <h4 className="text-xl font-bold text-[#17201C]">
                Sales Process Summary
              </h4>
              <p className="mt-3 leading-7 text-[#5F6862]">
                {result.workflowSummary}
              </p>
            </div>

            <SectionList title="Priority Outcomes" items={result.priorityOutcomes} />
            <SectionList title="Main Bottlenecks" items={result.mainBottlenecks} />
            <SectionList
              title="Lead Capture Recommendations"
              items={result.leadCaptureRecommendations}
            />
            <SectionList
              title="Speed-To-Lead Recommendations"
              items={result.speedToLeadRecommendations}
            />
            <SectionList
              title="Lead Qualification Questions"
              items={result.qualificationQuestions}
            />

            <div>
              <h4 className="font-bold text-[#17201C]">Follow-Up Sequence</h4>
              <div className="mt-3 grid gap-3">
                {result.followUpSequence.map((step) => (
                  <div
                    key={`${step.timing}-${step.action}`}
                    className="rounded-md bg-[#EDF3EF] p-3"
                  >
                    <p className="font-bold text-[#17201C]">{step.timing}</p>
                    <p className="mt-1 leading-7 text-[#5F6862]">{step.action}</p>
                  </div>
                ))}
              </div>
            </div>

            <SectionList title="CRM Fields To Track" items={result.crmFieldsToTrack} />
            <SectionList title="Suggested Deal Stages" items={result.suggestedDealStages} />
            <SectionList
              title="Sales Reporting Metrics"
              items={result.salesReportingMetrics}
            />
            <SectionList
              title="Automation Opportunities"
              items={result.automationOpportunities}
            />
            <SectionList title="Human Review Points" items={result.humanReviewPoints} />

            <div className="rounded-md bg-[#174F42] p-4 text-white">
              <h4 className="font-bold">Suggested Next Action</h4>
              <p className="mt-2 leading-7">{result.suggestedNextAction}</p>
            </div>

            <SectionList
              title="What A Future System Would Log"
              items={result.futureSystemLogPreview}
            />
            <SectionList
              title="What Not To Automate Yet"
              items={result.doNotAutomateYet}
            />
          </div>
        ) : (
          <div className="rounded-md bg-[#EDF3EF] p-5 leading-7 text-[#5F6862]">
            Add sales workflow details and generate a practical improvement
            plan. The result will show lead capture gaps, follow-up improvements,
            CRM fields, deal stages, reporting metrics, and automation
            opportunities.
          </div>
        )}
      </div>
    </div>
  );
}