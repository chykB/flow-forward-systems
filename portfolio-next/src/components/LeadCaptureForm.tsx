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
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
  name: "",
  email: "",
  businessType: "",
  workflowArea: "",
  serviceInterest: "",
  currentChallenge: "",
  message: "",
};

const workflowAreas = ["Sales", "Customer Support", "Content", "RevOps", "Operations"];

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

  if (!values.name.trim()) errors.name = "Name is required.";
  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.workflowArea) errors.workflowArea = "Choose a workflow area.";
  if (!values.serviceInterest) errors.serviceInterest = "Choose a service interest.";
  if (!values.currentChallenge.trim()) {
    errors.currentChallenge = "Describe the current workflow challenge.";
  }

  if (values.name.length > 80) errors.name = "Name must be 80 characters or less.";
  if (values.businessType.length > 120) {
    errors.businessType = "Business type must be 120 characters or less.";
  }
  if (values.currentChallenge.length > 600) {
    errors.currentChallenge = "Current challenge must be 600 characters or less.";
  }
  if (values.message.length > 600) {
    errors.message = "Message must be 600 characters or less.";
  }

  return errors;
}

function buildEmailBody(values: FormValues) {
  return [
    "New workflow audit request",
    "",
    `Name: ${values.name}`,
    `Email: ${values.email}`,
    `Business type: ${values.businessType || "Not provided"}`,
    `Workflow area: ${values.workflowArea}`,
    `Service interest: ${values.serviceInterest}`,
    "",
    "Current challenge:",
    values.currentChallenge,
    "",
    "Additional message:",
    values.message || "Not provided",
  ].join("\n");
}

export function LeadCaptureForm() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isReadyToSend, setIsReadyToSend] = useState(false);

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent("Workflow audit request");
    const body = encodeURIComponent(buildEmailBody(values));

    return `mailto:malikchika86@gmail.com?subject=${subject}&body=${body}`;
  }, [values]);
  const emailDraft = useMemo(() => buildEmailBody(values), [values]);

  function updateField(field: keyof FormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));

    setIsReadyToSend(false);
  }

  function prepareRequest() {
    const nextErrors = validateForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      setIsReadyToSend(true);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          prepareRequest();
        }}
        className="rounded-lg border border-[#D9DED8] bg-white p-6"
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="name" className="font-bold text-[#17201C]">
              Name
            </label>
            <input
              id="name"
              name="name"
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
              className="rounded-md border border-[#D9DED8] bg-white p-3 text-[#17201C]"
            />
            {errors.name ? <p className="text-sm text-red-700">{errors.name}</p> : null}
          </div>

          <div className="grid gap-2">
            <label htmlFor="email" className="font-bold text-[#17201C]">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={values.email}
              onChange={(event) => updateField("email", event.target.value)}
              className="rounded-md border border-[#D9DED8] bg-white p-3 text-[#17201C]"
            />
            {errors.email ? <p className="text-sm text-red-700">{errors.email}</p> : null}
          </div>

          <div className="grid gap-2">
            <label htmlFor="businessType" className="font-bold text-[#17201C]">
              Business type
            </label>
            <input
              id="businessType"
              name="businessType"
              value={values.businessType}
              onChange={(event) => updateField("businessType", event.target.value)}
              placeholder="Example: agency, clinic, coaching business"
              className="rounded-md border border-[#D9DED8] bg-white p-3 text-[#17201C]"
            />
            {errors.businessType ? (
              <p className="text-sm text-red-700">{errors.businessType}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label htmlFor="workflowArea" className="font-bold text-[#17201C]">
              Workflow area
            </label>
            <select
              id="workflowArea"
              name="workflowArea"
              value={values.workflowArea}
              onChange={(event) => updateField("workflowArea", event.target.value)}
              className="rounded-md border border-[#D9DED8] bg-white p-3 text-[#17201C]"
            >
              <option value="">Choose a workflow area</option>
              {workflowAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            {errors.workflowArea ? (
              <p className="text-sm text-red-700">{errors.workflowArea}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label htmlFor="serviceInterest" className="font-bold text-[#17201C]">
              Service interest
            </label>
            <select
              id="serviceInterest"
              name="serviceInterest"
              value={values.serviceInterest}
              onChange={(event) => updateField("serviceInterest", event.target.value)}
              className="rounded-md border border-[#D9DED8] bg-white p-3 text-[#17201C]"
            >
              <option value="">Choose a service</option>
              {serviceInterests.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
            {errors.serviceInterest ? (
              <p className="text-sm text-red-700">{errors.serviceInterest}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label htmlFor="currentChallenge" className="font-bold text-[#17201C]">
              Current challenge
            </label>
            <textarea
              id="currentChallenge"
              name="currentChallenge"
              value={values.currentChallenge}
              onChange={(event) => updateField("currentChallenge", event.target.value)}
              placeholder="Describe the workflow problem, delay, manual task, or revenue leak."
              className="min-h-32 rounded-md border border-[#D9DED8] bg-white p-3 text-[#17201C]"
            />
            {errors.currentChallenge ? (
              <p className="text-sm text-red-700">{errors.currentChallenge}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label htmlFor="message" className="font-bold text-[#17201C]">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              value={values.message}
              onChange={(event) => updateField("message", event.target.value)}
              placeholder="Add any extra context."
              className="min-h-28 rounded-md border border-[#D9DED8] bg-white p-3 text-[#17201C]"
            />
            {errors.message ? (
              <p className="text-sm text-red-700">{errors.message}</p>
            ) : null}
          </div>
        </div>

        <button
          type="submit"
          className="mt-6 w-full rounded-md bg-[#1F6F5B] px-5 py-3 font-bold text-white hover:bg-[#174F42]"
        >
          Prepare Email Draft
        </button>
      </form>

      <aside className="rounded-lg border border-[#D9DED8] bg-white p-6">
        <h3 className="text-lg font-bold text-[#174F42]">What Happens Next</h3>
        <p className="mt-3 leading-7 text-[#5F6862]">
          Your details are used to prepare a structured workflow audit request.
          You can review the email draft before sending it.
        </p>

        {isReadyToSend ? (
        <div className="mt-6 rounded-md bg-[#EDF3EF] p-4">
            <p className="font-bold text-[#17201C]">Review your email draft.</p>
            <p className="mt-2 leading-7 text-[#5F6862]">
            The form has prepared a structured email with your workflow details. If
            the button does not open your email app, copy the draft below and send it
            manually.
            </p>
            <a
            href={mailtoHref}
            className="mt-4 inline-block rounded-md bg-[#B8892E] px-5 py-3 font-bold text-[#17201C] hover:bg-[#174F42] hover:text-white"
            >
            Review Email Draft
            </a>

            <div className="mt-5">
            <p className="font-bold text-[#17201C]">Email draft</p>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-white p-4 text-sm leading-6 text-[#17201C]">
                {emailDraft}
            </pre>
            </div>
        </div>
        ) : (
        <p className="mt-6 rounded-md bg-[#EDF3EF] p-4 leading-7 text-[#5F6862]">
            Fill out the form to prepare a structured workflow audit email.
        </p>
        )}
      </aside>
    </div>
  );
}