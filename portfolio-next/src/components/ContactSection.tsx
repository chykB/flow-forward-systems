"use client";

import { useEffect, useState } from "react";
import LeadCaptureForm from "@/components/LeadCaptureForm";

const consultationBookingHref =
  "https://calendly.com/blessingmalik/flowforward-systems-consultation";

export function ContactSection() {
  const [isAuditFormOpen, setIsAuditFormOpen] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAuditFormOpen(false);
      }
    }

    if (isAuditFormOpen) {
      document.addEventListener("keydown", closeOnEscape);
    }

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isAuditFormOpen]);

  return (
    <section id="contact" className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-lg bg-[#174F42] px-6 py-10 text-white md:px-10">
        <h2 className="max-w-3xl text-3xl font-bold tracking-normal md:text-4xl">
          Contact FlowForward Systems
        </h2>
        <p className="mt-4 max-w-3xl leading-7 text-white/85">
          Choose the next step that fits what you need: schedule a consultation
          or request a workflow audit.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-white p-5 text-[#17201C]">
            <h3 className="text-xl font-bold">Book a Consultation</h3>
            <p className="mt-3 leading-7 text-[#5F6862]">
              Schedule a conversation if you want to discuss an automation idea,
              service fit, project direction, or general consulting support.
            </p>
            <a
              className="mt-5 inline-block rounded-md bg-[#B8892E] px-5 py-3 font-bold text-[#17201C] hover:bg-[#174F42] hover:text-white"
              href={consultationBookingHref}
            >
              Book Consultation
            </a>
          </div>

          <div className="rounded-lg bg-white p-5 text-[#17201C]">
            <h3 className="text-xl font-bold">Book a Workflow Audit</h3>
            <p className="mt-3 leading-7 text-[#5F6862]">
              Share a workflow that feels slow, manual, unclear, or disconnected
              so it can be reviewed for automation opportunities.
            </p>
            <button
              className="mt-5 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B]"
              type="button"
              onClick={() => setIsAuditFormOpen(true)}
            >
              Open Audit Form
            </button>
          </div>
        </div>
      </div>

      {isAuditFormOpen ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/55 px-4 py-8"
          role="presentation"
        >
          <div
            aria-modal="true"
            className="mx-auto max-w-5xl rounded-lg bg-[#F7F8F6] p-4 shadow-xl md:p-6"
            role="dialog"
            aria-labelledby="workflow-audit-dialog-title"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3
                  id="workflow-audit-dialog-title"
                  className="text-2xl font-bold text-[#17201C]"
                >
                  Workflow Audit Request
                </h3>
                <p className="mt-2 max-w-2xl leading-7 text-[#5F6862]">
                  Share the workflow you want to improve and the current
                  challenge you want reviewed.
                </p>
              </div>

              <button
                className="rounded-md border border-[#D9DED8] bg-white px-4 py-2 font-bold text-[#17201C] hover:bg-[#EDF3EF]"
                type="button"
                onClick={() => setIsAuditFormOpen(false)}
              >
                Close
              </button>
            </div>

            <LeadCaptureForm onDone={() => setIsAuditFormOpen(false)} />
          </div>
        </div>
      ) : null}
    </section>
  );
}