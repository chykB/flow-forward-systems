const tools = {
  "workflow-audit": {
    fields: [
      { id: "businessType", label: "Business type", type: "text", placeholder: "Example: coaching business, clinic, agency" },
      { id: "workflowArea", label: "Workflow area", type: "select", options: ["Sales", "Customer Support", "Content", "RevOps", "Operations"] },
      { id: "currentProcess", label: "Current process", type: "textarea", placeholder: "Describe how this workflow currently happens." },
      { id: "mainProblem", label: "Main problem", type: "textarea", placeholder: "Example: missed follow-ups, slow replies, manual reporting, unclear ownership." }
    ],
    generate(data) {
      return `Workflow Audit Recommendation

Business type: ${data.businessType || "Not provided"}
Workflow area: ${data.workflowArea || "Not provided"}

Likely workflow gaps:
- Repetitive manual steps may be slowing the process.
- Important work may not be tracked in one place.
- Follow-up may depend too much on memory.
- Human review points may not be clearly defined.

Automation opportunities:
- Capture requests or leads in a structured tracker.
- Add status stages so work does not disappear.
- Use reminders for follow-up and unresolved tasks.
- Use AI later to summarize, classify, draft, or prioritize work.

Human review should stay in:
- Complaints, refunds, legal issues, payment issues, sensitive customer conversations, and final customer-facing messages.

Suggested next action:
Map the current ${data.workflowArea || "workflow"} step by step, then choose one repetitive step to automate first.`;
    }
  },

  "alert-content": {
    fields: [
      { id: "alertTopic", label: "Alert, headline, or topic", type: "textarea", placeholder: "Paste a Google Alert headline, link, or short summary." },
      { id: "audience", label: "Audience", type: "text", placeholder: "Example: small business owners, creators, coaches" },
      { id: "format", label: "Preferred content format", type: "select", options: ["LinkedIn Post", "Blog Outline", "Short Video Script", "X Thread"] }
    ],
    generate(data) {
      return `Content Workflow Recommendation

Topic: ${data.alertTopic || "Not provided"}
Audience: ${data.audience || "Small business owners"}
Format: ${data.format || "Not provided"}

Content angle:
AI is most useful when it improves a real workflow, not when it only generates more content.

Business takeaway:
This topic can be framed around how businesses save time, reduce repeated manual work, or make better workflow decisions.

Suggested structure:
1. What happened?
2. Why does it matter?
3. What does it mean for businesses?
4. What should businesses do next?
5. Where can AI or automation help?
6. Where should humans review?

Suggested next action:
Turn this into a ${data.format || "content piece"} that gives one practical workflow lesson and one clear action step.`;
    }
  },

  "sales-follow-up": {
    fields: [
      { id: "businessType", label: "Business type", type: "text", placeholder: "Example: consultant, agency, event planner" },
      { id: "offer", label: "Offer", type: "text", placeholder: "Example: workflow audit, automation setup, content service" },
      { id: "leadStage", label: "Lead stage", type: "select", options: ["New Lead", "Interested But Not Booked", "No Response", "Proposal Sent"] },
      { id: "tone", label: "Tone", type: "select", options: ["Warm", "Professional", "Friendly", "Direct"] }
    ],
    generate(data) {
      return `Sales Follow-Up Sequence

Business type: ${data.businessType || "Not provided"}
Offer: ${data.offer || "Not provided"}
Lead stage: ${data.leadStage || "Not provided"}
Tone: ${data.tone || "Not provided"}

Follow-up message 1:
Hi [Name], thank you for your interest in ${data.offer || "this offer"}. I wanted to follow up and understand what you are trying to improve right now.

Follow-up message 2:
Hi [Name], a good next step may be to identify the workflow gap, clarify what is slowing things down, and choose one practical improvement to start with.

Reminder workflow:
- Day 0: Acknowledge the inquiry.
- Day 2: Send first follow-up.
- Day 5: Share a useful idea or example.
- Day 9: Send final gentle follow-up.

Human review point:
Review messages before sending, especially for high-value leads, sensitive requests, refunds, complaints, or custom proposals.

Suggested next action:
Create a simple lead tracker with source, stage, last contact date, next follow-up date, and status.`;
    }
  }
};

let activeTool = "workflow-audit";

const tabs = document.querySelectorAll(".tool-tab");
const fieldsContainer = document.querySelector("#tool-fields");
const form = document.querySelector("#tool-form");
const output = document.querySelector("#tool-output");

function renderFields() {
  fieldsContainer.innerHTML = "";

  tools[activeTool].fields.forEach((field) => {
    const wrapper = document.createElement("div");
    wrapper.className = "form-field";

    const label = document.createElement("label");
    label.setAttribute("for", field.id);
    label.textContent = field.label;

    let input;

    if (field.type === "textarea") {
      input = document.createElement("textarea");
      input.placeholder = field.placeholder || "";
    } else if (field.type === "select") {
      input = document.createElement("select");

      field.options.forEach((option) => {
        const optionElement = document.createElement("option");
        optionElement.value = option;
        optionElement.textContent = option;
        input.appendChild(optionElement);
      });
    } else {
      input = document.createElement("input");
      input.type = field.type;
      input.placeholder = field.placeholder || "";
    }

    input.id = field.id;
    input.name = field.id;

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    fieldsContainer.appendChild(wrapper);
  });
}

function setActiveTool(toolKey) {
  activeTool = toolKey;

  tabs.forEach((tab) => {
    const isActive = tab.dataset.tool === activeTool;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-pressed", String(isActive));
  });

  output.textContent = "Add your details and generate a practical starting point.";
  renderFields();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveTool(tab.dataset.tool);
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  output.textContent = tools[activeTool].generate(data);
});


renderFields();