"use client";

import { useState } from "react";

import { SectionList } from "@/components/tools/SectionList";
import {
  contentOutputFormats,
  contentPlatforms,
  contentTones,
  generateContentSignalResult,
  initialContentSignalValues,
  signalTypes,
  validateContentSignal,
  type ContentSignalErrors,
  type ContentSignalResult,
  type ContentSignalValues,
} from "@/lib/tools/contentSignal";

export function ContentSignalTool() {
  const [contentSignalValues, setContentSignalValues] =
    useState<ContentSignalValues>(initialContentSignalValues);
  const [contentSignalErrors, setContentSignalErrors] =
    useState<ContentSignalErrors>({});
  const [contentSignalResult, setContentSignalResult] =
    useState<ContentSignalResult | null>(null);
  const [contentSignalMessage, setContentSignalMessage] = useState("");

  function updateContentSignalField(
    field: keyof ContentSignalValues,
    value: string,
  ) {
    setContentSignalValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));

    setContentSignalErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));

    setContentSignalResult(null);
    setContentSignalMessage("");
  }

  function generateContentSignalIdeas() {
    const validationErrors = validateContentSignal(contentSignalValues);
    setContentSignalErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setContentSignalMessage("Please fix the highlighted fields.");
      return;
    }

    setContentSignalResult(generateContentSignalResult(contentSignalValues));
    setContentSignalMessage("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <form
        className="grid gap-5 rounded-lg border border-[#D9DED8] bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          generateContentSignalIdeas();
        }}
      >
        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="content-signal-type">
            Signal type
          </label>
          <select
            id="content-signal-type"
            value={contentSignalValues.signalType}
            onChange={(event) =>
              updateContentSignalField("signalType", event.target.value)
            }
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
          >
            <option value="">Choose a signal type</option>
            {signalTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {contentSignalErrors.signalType ? (
            <p className="text-sm font-semibold text-red-700">
              {contentSignalErrors.signalType}
            </p>
          ) : null}
        </div>

        {contentSignalValues.signalType === "Other" ? (
          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="content-signal-type-other">
              Describe the signal type
            </label>
            <input
              id="content-signal-type-other"
              value={contentSignalValues.signalTypeOther}
              onChange={(event) =>
                updateContentSignalField("signalTypeOther", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
              type="text"
            />
            {contentSignalErrors.signalTypeOther ? (
              <p className="text-sm font-semibold text-red-700">
                {contentSignalErrors.signalTypeOther}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="content-signal-text">
            Content signal
          </label>
          <textarea
            id="content-signal-text"
            value={contentSignalValues.signalText}
            onChange={(event) =>
              updateContentSignalField("signalText", event.target.value)
            }
            className="min-h-36 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="Paste a signal, question, trend, article summary, customer note, or idea."
          />
          {contentSignalErrors.signalText ? (
            <p className="text-sm font-semibold text-red-700">
              {contentSignalErrors.signalText}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="content-source">
            Source or link
          </label>
          <input
            id="content-source"
            value={contentSignalValues.sourceOrLink}
            onChange={(event) =>
              updateContentSignalField("sourceOrLink", event.target.value)
            }
            className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            type="text"
            placeholder="Optional: add a source name or link."
          />
          {contentSignalErrors.sourceOrLink ? (
            <p className="text-sm font-semibold text-red-700">
              {contentSignalErrors.sourceOrLink}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="content-creator-niche">
            Creator niche
          </label>
          <input
            id="content-creator-niche"
            value={contentSignalValues.creatorNiche}
            onChange={(event) =>
              updateContentSignalField("creatorNiche", event.target.value)
            }
            className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            type="text"
            placeholder="Example: AI automation, parenting, fitness, career coaching."
          />
          {contentSignalErrors.creatorNiche ? (
            <p className="text-sm font-semibold text-red-700">
              {contentSignalErrors.creatorNiche}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="content-target-audience">
            Target audience
          </label>
          <input
            id="content-target-audience"
            value={contentSignalValues.targetAudience}
            onChange={(event) =>
              updateContentSignalField("targetAudience", event.target.value)
            }
            className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            type="text"
            placeholder="Example: small business owners, job seekers, parents, executives."
          />
          {contentSignalErrors.targetAudience ? (
            <p className="text-sm font-semibold text-red-700">
              {contentSignalErrors.targetAudience}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="content-brand-pov">
            Brand point of view
          </label>
          <textarea
            id="content-brand-pov"
            value={contentSignalValues.brandPointOfView}
            onChange={(event) =>
              updateContentSignalField("brandPointOfView", event.target.value)
            }
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="Optional: what do you believe about this topic?"
          />
          {contentSignalErrors.brandPointOfView ? (
            <p className="text-sm font-semibold text-red-700">
              {contentSignalErrors.brandPointOfView}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="content-platform">
              Platform
            </label>
            <select
              id="content-platform"
              value={contentSignalValues.preferredPlatform}
              onChange={(event) =>
                updateContentSignalField("preferredPlatform", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
            >
              <option value="">Choose platform</option>
              {contentPlatforms.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
            {contentSignalErrors.preferredPlatform ? (
              <p className="text-sm font-semibold text-red-700">
                {contentSignalErrors.preferredPlatform}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="content-output-format">
              Output format
            </label>
            <select
              id="content-output-format"
              value={contentSignalValues.preferredOutputFormat}
              onChange={(event) =>
                updateContentSignalField("preferredOutputFormat", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
            >
              <option value="">Choose format</option>
              {contentOutputFormats.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
            {contentSignalErrors.preferredOutputFormat ? (
              <p className="text-sm font-semibold text-red-700">
                {contentSignalErrors.preferredOutputFormat}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="content-tone">
              Tone
            </label>
            <select
              id="content-tone"
              value={contentSignalValues.tone}
              onChange={(event) =>
                updateContentSignalField("tone", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
            >
              <option value="">Choose tone</option>
              {contentTones.map((tone) => (
                <option key={tone} value={tone}>
                  {tone}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="content-topics-avoid">
            Topics to avoid
          </label>
          <input
            id="content-topics-avoid"
            value={contentSignalValues.topicsToAvoid}
            onChange={(event) =>
              updateContentSignalField("topicsToAvoid", event.target.value)
            }
            className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            type="text"
            placeholder="Optional: claims, subjects, or angles to avoid."
          />
          {contentSignalErrors.topicsToAvoid ? (
            <p className="text-sm font-semibold text-red-700">
              {contentSignalErrors.topicsToAvoid}
            </p>
          ) : null}
        </div>

        <p className="rounded-md bg-[#EDF3EF] p-4 text-sm leading-6 text-[#5F6862]">
          Use this as a content planning aid. Check claims, cite sources when
          needed, and avoid copying source text directly.
        </p>

        {contentSignalMessage ? (
          <p className="rounded-md bg-[#EDF3EF] p-4 font-semibold text-red-700">
            {contentSignalMessage}
          </p>
        ) : null}

        <button
          className="rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B]"
          type="submit"
        >
          Generate Content Plan
        </button>
      </form>

      <div className="rounded-lg border border-[#D9DED8] bg-white p-5">
        {contentSignalResult ? (
          <div className="grid gap-6">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-[#5F6862]">
                Content decision
              </p>
              <p className="mt-2 rounded-md bg-[#EDF3EF] p-3 font-bold text-[#17201C]">
                {contentSignalResult.contentDecision}
              </p>
            </div>

            <div>
              <h4 className="text-xl font-bold text-[#17201C]">
                Content Signal Summary
              </h4>
              <p className="mt-3 leading-7 text-[#5F6862]">
                {contentSignalResult.signalSummary}
              </p>
            </div>

            <SectionList
              title="Source And Claim Notes"
              items={contentSignalResult.sourceAndClaimNotes}
            />

            <div>
              <h4 className="font-bold text-[#17201C]">Audience Fit</h4>
              <p className="mt-2 leading-7 text-[#5F6862]">
                {contentSignalResult.audienceFit}
              </p>
            </div>

            <div>
              <h4 className="font-bold text-[#17201C]">Content Potential</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {Object.entries(contentSignalResult.contentPotential).map(
                  ([label, value]) => (
                    <div key={label} className="rounded-md bg-[#EDF3EF] p-3">
                      <p className="text-sm font-bold capitalize text-[#17201C]">
                        {label.replace(/([A-Z])/g, " $1")}
                      </p>
                      <p className="mt-1 text-[#5F6862]">{value}</p>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-md bg-[#EDF3EF] p-4">
                <h4 className="font-bold text-[#17201C]">Obvious Take</h4>
                <p className="mt-2 leading-7 text-[#5F6862]">
                  {contentSignalResult.obviousTake}
                </p>
              </div>

              <div className="rounded-md bg-[#EDF3EF] p-4">
                <h4 className="font-bold text-[#17201C]">Deeper Take</h4>
                <p className="mt-2 leading-7 text-[#5F6862]">
                  {contentSignalResult.deeperTake}
                </p>
              </div>

              <div className="rounded-md bg-[#174F42] p-4 text-white">
                <h4 className="font-bold">Fresh Angle</h4>
                <p className="mt-2 leading-7">
                  {contentSignalResult.freshAngle}
                </p>
              </div>

              <div className="rounded-md bg-[#EDF3EF] p-4">
                <h4 className="font-bold text-[#17201C]">Practical Lesson</h4>
                <p className="mt-2 leading-7 text-[#5F6862]">
                  {contentSignalResult.practicalLesson}
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-[#17201C]">Recommended Format</h4>
              <p className="mt-2 leading-7 text-[#5F6862]">
                <span className="font-bold text-[#17201C]">
                  {contentSignalResult.recommendedFormat.format}
                </span>{" "}
                - {contentSignalResult.recommendedFormat.reason}
              </p>
            </div>

            <div className="rounded-md border border-[#D9DED8] p-4">
              <h4 className="text-lg font-bold text-[#17201C]">
                {contentSignalResult.selectedOutput.title}
              </h4>
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#5F6862]">
                {contentSignalResult.selectedOutput.body}
              </pre>
            </div>

            <SectionList
              title="Review Before Publishing"
              items={contentSignalResult.reviewBeforePublishing}
            />
            <SectionList
              title="Publishing Guidance"
              items={contentSignalResult.publishingGuidance}
            />
            <SectionList
              title="Follow-Up Ideas"
              items={contentSignalResult.followUpIdeas}
            />
          </div>
        ) : (
          <div className="rounded-md bg-[#EDF3EF] p-5 leading-7 text-[#5F6862]">
            Add a signal and generate a content plan. The result will help you
            decide whether the idea is worth creating, what fresh angle to use,
            and what to review before publishing.
          </div>
        )}
      </div>
    </div>
  );
}