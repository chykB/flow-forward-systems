import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const workflowAreas = [
  "Sales",
  "Customer Support",
  "Content",
  "RevOps",
  "Operations",
] as const;

const serviceInterests = [
  "Workflow Audit",
  "Workflow Automation Setup",
  "AI-Assisted Workflow Setup",
  "Agentic Automation System Design",
  "RevOps Automation",
  "AI Content Workflow",
  "AI Video Content Workflow",
] as const;

type LeadRequestBody = {
  name?: unknown;
  email?: unknown;
  businessType?: unknown;
  workflowArea?: unknown;
  serviceInterest?: unknown;
  currentChallenge?: unknown;
  message?: unknown;
};

type LeadErrors = Partial<Record<keyof LeadRequestBody, string>>;

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isAllowedValue<T extends readonly string[]>(
  value: string,
  allowedValues: T,
): value is T[number] {
  return allowedValues.includes(value as T[number]);
}

function validateLeadPayload(body: LeadRequestBody) {
  const errors: LeadErrors = {};

  const name = getString(body.name);
  const email = getString(body.email);
  const businessType = getString(body.businessType);
  const workflowArea = getString(body.workflowArea);
  const serviceInterest = getString(body.serviceInterest);
  const currentChallenge = getString(body.currentChallenge);
  const message = getString(body.message);

  if (name.length < 2) {
    errors.name = "Enter your name.";
  } else if (name.length > 80) {
    errors.name = "Name must be 80 characters or less.";
  }

  if (!email) {
    errors.email = "Enter your email.";
  } else if (
    email.length > 160 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    errors.email = "Enter a valid email address.";
  }

  if (businessType.length > 120) {
    errors.businessType = "Business type must be 120 characters or less.";
  }

  if (!isAllowedValue(workflowArea, workflowAreas)) {
    errors.workflowArea = "Choose a workflow area.";
  }

  if (!isAllowedValue(serviceInterest, serviceInterests)) {
    errors.serviceInterest = "Choose a service interest.";
  }

  if (currentChallenge.length < 10) {
    errors.currentChallenge = "Describe the workflow challenge.";
  } else if (currentChallenge.length > 600) {
    errors.currentChallenge = "Current challenge must be 600 characters or less.";
  }

  if (message.length > 600) {
    errors.message = "Message must be 600 characters or less.";
  }

  return {
    errors,
    values: {
      name,
      email,
      business_type: businessType || null,
      workflow_area: workflowArea,
      service_interest: serviceInterest,
      current_challenge: currentChallenge,
      message: message || null,
    },
  };
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return NextResponse.json(
      { message: "Lead storage is not configured yet." },
      { status: 500 },
    );
  }

  let body: LeadRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid request body." },
      { status: 400 },
    );
  }

  const { errors, values } = validateLeadPayload(body);

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { message: "Please fix the highlighted fields.", errors },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
    },
  });

    const duplicateWindowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: duplicateLeads, error: duplicateCheckError } = await supabase
      .from("lead_submissions")
      .select("id")
      .ilike("email", values.email)
      .eq("workflow_area", values.workflow_area)
      .eq("service_interest", values.service_interest)
      .eq("current_challenge", values.current_challenge)
      .gte("created_at", duplicateWindowStart)
      .limit(1);

    const duplicateLead = duplicateLeads?.[0];
    
    if (duplicateCheckError) {
      console.error("Lead duplicate check failed", duplicateCheckError);

      return NextResponse.json(
        {
          message:
            "We could not submit the form right now. Please try again or use the email draft fallback.",
        },
        { status: 500 },
      );
    }

    if (duplicateLead) {
      return NextResponse.json(
        {
          message:
            "This request was already received recently. If you want to send a different request, update the workflow details and submit again.",
        },
        { status: 409 },
      );
    }

  const { error } = await supabase.from("lead_submissions").insert({
    ...values,
    user_agent: request.headers.get("user-agent"),
    submitted_from: request.headers.get("referer"),
  });

  if (error) {
    console.error("Lead submission insert failed", error);

    return NextResponse.json(
      { message: "We could not save your request. Please use the email draft fallback." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { message: "Your workflow audit request has been received. I will review it and follow up." },
    { status: 201 },
  );
}