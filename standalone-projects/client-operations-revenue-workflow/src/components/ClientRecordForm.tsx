"use client";

import { useState } from "react";
import type {
  NewClientWorkflowRecord,
} from "@/lib/application/workspace-api";
import type {
  ClientType,
  LifecycleStage,
  PriorityLevel,
  ReturningClientStatus,
  RiskLevel,
} from "@/lib/client-workflow-types";
import { getLifecycleStageLabel } from "@/lib/client-workflow-display";

type ClientRecordFormProps = {
  description?: string;
  eyebrow?: string;
  initialRecord?: Partial<NewClientWorkflowRecord>;
  onAddRecord: (
    record: NewClientWorkflowRecord,
  ) => unknown | Promise<unknown>;
  submitLabel?: string;
  title?: string;
};

type FormValues = {
  name: string;
  email: string;
  businessName: string;
  source: string;
  interest: string;
  clientType: ClientType;
  returningClientStatus: ReturningClientStatus;
  lifecycleStage: LifecycleStage;
  priority: PriorityLevel;
  riskLevel: RiskLevel;
  nextAction: string;
  nextFollowUpAt: string;
  assignedTo: string;
  message: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const defaultValues: FormValues = {
  name: "",
  email: "",
  businessName: "",
  source: "",
  interest: "",
  clientType: "Lead",
  returningClientStatus: "Not returning",
  lifecycleStage: "New lead",
  priority: "Medium",
  riskLevel: "Low",
  nextAction: "",
  nextFollowUpAt: "",
  assignedTo: "",
  message: "",
};

function buildInitialValues(
  initialRecord?: Partial<NewClientWorkflowRecord>,
): FormValues {
  return {
    ...defaultValues,
    name: initialRecord?.name ?? defaultValues.name,
    email: initialRecord?.email ?? defaultValues.email,
    businessName:
      initialRecord?.businessName ?? defaultValues.businessName,
    source: initialRecord?.source ?? defaultValues.source,
    interest: initialRecord?.interest ?? defaultValues.interest,
    clientType:
      initialRecord?.clientType ?? defaultValues.clientType,
    returningClientStatus:
      initialRecord?.returningClientStatus ??
      defaultValues.returningClientStatus,
    lifecycleStage:
      initialRecord?.lifecycleStage ?? defaultValues.lifecycleStage,
    priority: initialRecord?.priority ?? defaultValues.priority,
    riskLevel: initialRecord?.riskLevel ?? defaultValues.riskLevel,
    nextAction:
      initialRecord?.nextAction ?? defaultValues.nextAction,
    nextFollowUpAt:
      initialRecord?.nextFollowUpAt ??
      defaultValues.nextFollowUpAt,
    assignedTo:
      initialRecord?.assignedTo ?? defaultValues.assignedTo,
    message: initialRecord?.message ?? defaultValues.message,
  };
}

const clientTypes: ClientType[] = [
  "Lead",
  "New client",
  "Active client",
  "Returning client",
  "Past client",
];

const returningClientStatuses: ReturningClientStatus[] = [
  "Potential reactivation",
  "Repeat project opportunity",
  "Reactivated",
  "Dormant",
];
const lifecycleStages: LifecycleStage[] = [
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
];

const priorities: PriorityLevel[] = ["High", "Medium", "Low"];
const risks: RiskLevel[] = ["High", "Medium", "Low"];

function validateForm(values: FormValues) {
  const errors: FormErrors = {};

  if (values.name.trim().length < 2) {
    errors.name = "Enter the lead or client name.";
  }

  if (
    values.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
  ) {
    errors.email = "Enter a valid email address.";
  }

  if (values.businessName.trim().length < 2) {
    errors.businessName = "Enter the business name.";
  }

  if (values.source.trim().length < 2) {
    errors.source = "Enter where this lead or client came from.";
  }

  if (values.interest.trim().length < 2) {
    errors.interest = "Enter what they are interested in.";
  }

  if (values.nextAction.trim().length < 5) {
    errors.nextAction = "Enter the next action.";
  }

  if (!values.nextFollowUpAt) {
    errors.nextFollowUpAt = "Choose a follow-up date.";
  }

  if (values.assignedTo.trim().length < 2) {
    errors.assignedTo = "Enter the owner.";
  }

  if (values.message.trim().length < 10) {
    errors.message = "Add a short context note.";
  }

  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm font-semibold text-red-700">{message}</p>;
}

export function ClientRecordForm({
  description = "Add a workflow record with the next action, follow-up date, owner, and current stage.",
  eyebrow = "Add Record",
  initialRecord,
  onAddRecord,
  submitLabel = "Add Lead Or Client",
  title = "Add a lead or client",
}: ClientRecordFormProps) {
  const [values, setValues] = useState<FormValues>(() =>
    buildInitialValues(initialRecord),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");

  function updateField<Key extends keyof FormValues>(
    field: Key,
    value: FormValues[Key],
  ) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
  }

  function updateClientType(clientType: ClientType) {
    const returningClientStatus: ReturningClientStatus =
      clientType === "Returning client"
        ? "Reactivated"
        : clientType === "Past client"
          ? "Dormant"
          : "Not returning";

    setValues((currentValues) => ({
      ...currentValues,
      clientType,
      returningClientStatus,
    }));
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateForm(values);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setSubmissionError("");

    try {
      const result = await onAddRecord({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: "",
        businessName: values.businessName.trim(),
        source: values.source.trim(),
        interest: values.interest.trim(),
        message: values.message.trim(),
        lifecycleStage: values.lifecycleStage,
        priority: values.priority,
        riskLevel: values.riskLevel,
        nextAction: values.nextAction.trim(),
        nextFollowUpAt: values.nextFollowUpAt,
        assignedTo: values.assignedTo.trim(),
        onboardingStatus: "Not started",
        deliveryStatus: "Not started",
        approvalStatus: "Not needed",
        paymentStatus: "Not needed",
        clientType: values.clientType,
        returningClientStatus: values.returningClientStatus,
        lastProjectDate: "",
        estimatedValue: 0,
      });

      if (result === false || result === null) {
        return;
      }

      setValues(buildInitialValues(initialRecord));
      setErrors({});
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "The client record could not be saved.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="rounded-lg border border-[#D9DED8] bg-white p-5"
      onSubmit={submitForm}
    >
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5F6862]">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-bold">{title}</h2>
        <p className="mt-2 leading-7 text-[#5F6862]">{description}</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="font-bold" htmlFor="record-name">
            Name
          </label>
          <input
            className="rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
            id="record-name"
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
          />
          <FieldError message={errors.name} />
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="record-email">
            Email
          </label>
          <input
            className="rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
            id="record-email"
            type="email"
            value={values.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
          <FieldError message={errors.email} />
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="record-business">
            Business name
          </label>
          <input
            className="rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
            id="record-business"
            value={values.businessName}
            onChange={(event) =>
              updateField("businessName", event.target.value)
            }
          />
          <FieldError message={errors.businessName} />
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="record-source">
            Source
          </label>
          <input
            className="rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
            id="record-source"
            placeholder="Example: referral, website form, Instagram DM"
            value={values.source}
            onChange={(event) => updateField("source", event.target.value)}
          />
          <FieldError message={errors.source} />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <label className="font-bold" htmlFor="record-interest">
            Interest
          </label>
          <input
            className="rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
            id="record-interest"
            placeholder="Example: onboarding workflow, monthly support, proposal"
            value={values.interest}
            onChange={(event) => updateField("interest", event.target.value)}
          />
          <FieldError message={errors.interest} />
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="record-client-type">
            Lead or client status
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="record-client-type"
            value={values.clientType}
            onChange={(event) =>
              updateClientType(event.target.value as ClientType)
            }
          >
            {clientTypes.map((clientType) => (
              <option key={clientType} value={clientType}>
                {clientType}
              </option>
            ))}
          </select>
        </div>

        {values.clientType === "Returning client" ||
        values.clientType === "Past client" ? (
          <div className="grid gap-2">
            <label className="font-bold" htmlFor="record-returning-status">
              Returning client status
            </label>
            <select
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
              id="record-returning-status"
              value={values.returningClientStatus}
              onChange={(event) =>
                updateField(
                  "returningClientStatus",
                  event.target.value as ReturningClientStatus,
                )
              }
            >
              {returningClientStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="record-stage">
            Workflow stage
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="record-stage"
            value={values.lifecycleStage}
            onChange={(event) =>
              updateField(
                "lifecycleStage",
                event.target.value as LifecycleStage,
              )
            }
          >
            {lifecycleStages.map((stage) => (
              <option key={stage} value={stage}>
                {getLifecycleStageLabel(stage)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="record-owner">
            Assigned to
          </label>
          <input
            className="rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
            id="record-owner"
            placeholder="Example: Founder, VA, assistant, sales rep"
            value={values.assignedTo}
            onChange={(event) => updateField("assignedTo", event.target.value)}
          />
          <FieldError message={errors.assignedTo} />
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="record-priority">
            Priority
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="record-priority"
            value={values.priority}
            onChange={(event) =>
              updateField("priority", event.target.value as PriorityLevel)
            }
          >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="record-risk">
            Relationship concern
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="record-risk"
            value={values.riskLevel}
            onChange={(event) =>
              updateField("riskLevel", event.target.value as RiskLevel)
            }
          >
            {risks.map((risk) => (
              <option key={risk} value={risk}>
                {risk}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2 md:col-span-2">
          <label className="font-bold" htmlFor="record-next-action">
            Next action
          </label>
          <input
            className="rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
            id="record-next-action"
            placeholder="Example: Send follow-up, confirm approval, update delivery"
            value={values.nextAction}
            onChange={(event) => updateField("nextAction", event.target.value)}
          />
          <FieldError message={errors.nextAction} />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <label className="font-bold" htmlFor="record-follow-up">
            Follow-up date
          </label>
          <input
            className="rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
            id="record-follow-up"
            type="date"
            value={values.nextFollowUpAt}
            onChange={(event) =>
              updateField("nextFollowUpAt", event.target.value)
            }
          />
          <FieldError message={errors.nextFollowUpAt} />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <label className="font-bold" htmlFor="record-message">
            Context note
          </label>
          <textarea
            className="min-h-28 rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
            id="record-message"
            placeholder="Add the key context needed to understand this lead or client."
            value={values.message}
            onChange={(event) => updateField("message", event.target.value)}
          />
          <FieldError message={errors.message} />
        </div>
      </div>

      {submissionError ? (
        <p
          className="mt-5 rounded-md bg-red-50 p-4 font-semibold text-red-700"
          role="alert"
        >
          {submissionError}
        </p>
      ) : null}

      <button
        className="mt-6 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
