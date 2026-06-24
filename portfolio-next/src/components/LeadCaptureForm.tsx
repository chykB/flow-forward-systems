"use client";

import { useMemo, useState } from "react";

type FormValues = {
  name: string;
  email: string;
  businessType: string;
  workflowArea: string;
  serviceInterest: string;
  currentChallenge: string;
  message: string;
  companyWebsite: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

type FormStep = "editing" | "submitting" | "success" | "error";

const initialValues: FormValues = {
  name: "",
  email: "",
  businessType: "",
  workflowArea: "",
  serviceInterest: "",
  currentChallenge: "",
  message: "",
  companyWebsite: "",
};

const workflowAreas = [
  "Sales",
  "Customer Support",
  "Content",
  "RevOps",
  "Operations",
];

const serviceInterests = [
  "Workflow Audit",
  "Workflow Automation Setup",
  "AI-Assisted Workflow Setup",
  "Agentic Automation System Design",
  "RevOps Automation",
  "AI Content Workflow",
  "AI Video Content Workflow",
];

function validateForm(values: FormValues) {
  const errors: FormErrors = {};

  if (values.name.trim().length < 2) {
    errors.name = "Enter your name.";
  } else if (values.name.trim().length > 80) {
    errors.name = "Name must be 80 characters or less.";
  }

  if (!values.email.trim()) {
    errors.email = "Enter your email.";
  } else if (
    values.email.trim().length > 160 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
  ) {
    errors.email = "Enter a valid email address.";
  }

  if (values.businessType.trim().length > 120) {
    errors.businessType = "Business type must be 120 characters or less.";
  }

  if (!workflowAreas.includes(values.workflowArea)) {
    errors.workflowArea = "Choose a workflow area.";
  }

  if (!serviceInterests.includes(values.serviceInterest)) {
    errors.serviceInterest = "Choose a service interest.";
  }

  if (values.currentChallenge.trim().length < 10) {
    errors.currentChallenge = "Describe the workflow challenge.";
  } else if (values.currentChallenge.trim().length > 600) {
    errors.currentChallenge = "Current challenge must be 600 characters or less.";
  }

  if (values.message.trim().length > 600) {
    errors.message = "Message must be 600 characters or less.";
  }

  return errors;
}

function buildEmailBody(values: FormValues) {
  return `New workflow audit request

Name: ${values.name || "Not provided"}
Email: ${values.email || "Not provided"}
Business type: ${values.businessType || "Not provided"}
Workflow area: ${values.workflowArea || "Not provided"}
Service interest: ${values.serviceInterest || "Not provided"}

Current challenge:
${values.currentChallenge || "Not provided"}

Additional message:
${values.message || "Not provided"}`;
}


type LeadCaptureFormProps = {
  onDone?: () => void;
};

export default function LeadCaptureForm({ onDone }: LeadCaptureFormProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formStep, setFormStep] = useState<FormStep>("editing");
  const [statusMessage, setStatusMessage] = useState("");
  const [showEmailFallback, setShowEmailFallback] = useState(false);

  const emailDraft = useMemo(() => buildEmailBody(values), [values]);

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent("Workflow audit request");
    const body = encodeURIComponent(emailDraft);

    return `mailto:malikchika86@gmail.com?subject=${subject}&body=${body}`;
  }, [emailDraft]);

  function updateField(field: keyof FormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));

    if (formStep !== "editing") {
      setFormStep("editing");
      setStatusMessage("");
      setShowEmailFallback(false);
    }
  }



  async function submitLead() {
    const validationErrors = validateForm(values);
    setShowEmailFallback(false);
    setErrors(validationErrors);
    

    if (Object.keys(validationErrors).length > 0) {
      setFormStep("error");
      setStatusMessage("Please fix the highlighted fields.");
      return;
    }

    setFormStep("submitting");
    setStatusMessage("Submitting your workflow audit request...");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = (await response.json()) as {
        message?: string;
        errors?: FormErrors;
      };

      if (!response.ok) {
        if (result.errors) {
          setErrors(result.errors);
        }

        setFormStep("error");
        setStatusMessage(
          result.message ||
            "We could not submit the form right now. You can still send the same details using the email draft below.",
        );
        setShowEmailFallback(true);
        return;
      }

      setFormStep("success");
      setStatusMessage(
        result.message ||
          "Your workflow audit request has been received. I will review it and follow up.",
      );
    } catch {
      setFormStep("error");
      setShowEmailFallback(true);
      setStatusMessage(
        "We could not submit the form right now. You can still send the same details using the email draft below.",
      );
    }
  }

  function resetForm() {
    setValues(initialValues);
    setErrors({});
    setFormStep("editing");
    setStatusMessage("");
    setShowEmailFallback(false);
  }

  if (formStep === "success") {
    return (
      <div className="rounded-lg border border-[#D9DED8] bg-white p-6">
        <h3 className="text-2xl font-bold text-[#17201C]">
          Request Received
        </h3>
        <p className="mt-3 max-w-2xl leading-7 text-[#5F6862]">
          {statusMessage}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {onDone ? (
            <button
              className="rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B]"
              type="button"
              onClick={onDone}
            >
              Done
            </button>
          ) : null}

          <button
            className="rounded-md border border-[#174F42] px-5 py-3 font-bold text-[#174F42] hover:bg-[#EDF3EF]"
            type="button"
            onClick={resetForm}
          >
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 rounded-lg border border-[#D9DED8] bg-white p-6 md:grid-cols-[1.15fr_0.85fr]">
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submitLead();
        }}
      >
        <div className="hidden" aria-hidden="true">
          <label htmlFor="company-website">Company website</label>
          <input
            id="company-website"
            name="companyWebsite"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values.companyWebsite}
            onChange={(event) =>
              updateField("companyWebsite", event.target.value)
            }
          />
        </div>
        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="lead-name">
            Name
          </label>
          <input
            id="lead-name"
            name="name"
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C] outline-none focus:border-[#174F42]"
            type="text"
            autoComplete="name"
          />
          {errors.name ? (
            <p className="text-sm font-semibold text-red-700">{errors.name}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="lead-email">
            Email
          </label>
          <input
            id="lead-email"
            name="email"
            value={values.email}
            onChange={(event) => updateField("email", event.target.value)}
            className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C] outline-none focus:border-[#174F42]"
            type="email"
            autoComplete="email"
          />
          {errors.email ? (
            <p className="text-sm font-semibold text-red-700">{errors.email}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label
            className="font-bold text-[#17201C]"
            htmlFor="lead-business-type"
          >
            Business type
          </label>
          <input
            id="lead-business-type"
            name="businessType"
            value={values.businessType}
            onChange={(event) =>
              updateField("businessType", event.target.value)
            }
            className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C] outline-none focus:border-[#174F42]"
            type="text"
            placeholder="Example: agency, clinic, coaching business"
          />
          {errors.businessType ? (
            <p className="text-sm font-semibold text-red-700">
              {errors.businessType}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label
            className="font-bold text-[#17201C]"
            htmlFor="lead-workflow-area"
          >
            Workflow area
          </label>
          <select
            id="lead-workflow-area"
            name="workflowArea"
            value={values.workflowArea}
            onChange={(event) =>
              updateField("workflowArea", event.target.value)
            }
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C] outline-none focus:border-[#174F42]"
          >
            <option value="">Choose a workflow area</option>
            {workflowAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
          {errors.workflowArea ? (
            <p className="text-sm font-semibold text-red-700">
              {errors.workflowArea}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label
            className="font-bold text-[#17201C]"
            htmlFor="lead-service-interest"
          >
            Service interest
          </label>
          <select
            id="lead-service-interest"
            name="serviceInterest"
            value={values.serviceInterest}
            onChange={(event) =>
              updateField("serviceInterest", event.target.value)
            }
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C] outline-none focus:border-[#174F42]"
          >
            <option value="">Choose a service</option>
            {serviceInterests.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
          {errors.serviceInterest ? (
            <p className="text-sm font-semibold text-red-700">
              {errors.serviceInterest}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label
            className="font-bold text-[#17201C]"
            htmlFor="lead-current-challenge"
          >
            Current challenge
          </label>
          <textarea
            id="lead-current-challenge"
            name="currentChallenge"
            value={values.currentChallenge}
            onChange={(event) =>
              updateField("currentChallenge", event.target.value)
            }
            className="min-h-36 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C] outline-none focus:border-[#174F42]"
            placeholder="Describe the workflow you want to improve."
          />
          {errors.currentChallenge ? (
            <p className="text-sm font-semibold text-red-700">
              {errors.currentChallenge}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="lead-message">
            Additional message
          </label>
          <textarea
            id="lead-message"
            name="message"
            value={values.message}
            onChange={(event) => updateField("message", event.target.value)}
            className="min-h-28 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C] outline-none focus:border-[#174F42]"
            placeholder="Add any context that would help with the audit."
          />
          {errors.message ? (
            <p className="text-sm font-semibold text-red-700">
              {errors.message}
            </p>
          ) : null}
        </div>

        <button
          className="rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:cursor-not-allowed disabled:opacity-70"
          type="submit"
          disabled={formStep === "submitting"}
        >
          {formStep === "submitting"
            ? "Submitting..."
            : "Submit Workflow Audit Request"}
        </button>
      </form>

      <aside className="rounded-md bg-[#EDF3EF] p-5">
        <h3 className="text-xl font-bold text-[#17201C]">What Happens Next</h3>

        <p className="mt-3 leading-7 text-[#5F6862]">
          Share the workflow you want to improve. I will review the workflow area,
          current challenge, and service interest so the follow-up can be practical.
        </p>
        <div className="mt-5 rounded-md border border-[#D9DED8] bg-white p-4">
          <p className="font-bold text-[#17201C]">Privacy note</p>
          <p className="mt-2 leading-7 text-[#5F6862]">
            Only share details you are comfortable sending for review. Do not include
            passwords, payment details, private customer records, legal documents, or
            confidential business files.
          </p>
        </div>

        {statusMessage ? (
          <p
            className={`mt-5 rounded-md bg-white p-4 font-semibold ${
              formStep === "error" ? "text-red-700" : "text-[#174F42]"
            }`}
          >
            {statusMessage}
          </p>
        ) : (
          <p className="mt-5 rounded-md bg-white p-4 leading-7 text-[#5F6862]">
            After you submit, your request will be reviewed and used to prepare the
            next best workflow audit step.
          </p>
        )}

        {showEmailFallback ? (
          <div className="mt-6">
            <p className="font-bold text-[#17201C]">Email copy</p>
            <p className="mt-2 leading-7 text-[#5F6862]">
              If the form could not be submitted, you can send the same details by
              email.
            </p>
            <a
              href={mailtoHref}
              className="mt-4 inline-block rounded-md bg-[#B8892E] px-5 py-3 font-bold text-[#17201C] hover:bg-[#174F42] hover:text-white"
            >
              Open Email Draft
            </a>

            <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-white p-4 text-sm leading-6 text-[#17201C]">
              {emailDraft}
            </pre>
          </div>
        ) : null}
      </aside>
    </div>
  );
}