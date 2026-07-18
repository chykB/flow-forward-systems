import { Info } from "lucide-react";
import type { ClientWorkflowRecord } from "@/lib/client-workflow-types";

type PriorityCardProps = {
  clients: Array<
    Pick<ClientWorkflowRecord, "businessName" | "id" | "name">
  >;
  count: number;
  description: string;
  title: string;
};

const visibleClientLimit = 3;

function getClientInitials(name: string) {
  const nameParts = name.trim().split(/\s+/).filter(Boolean);

  if (nameParts.length === 0) {
    return "?";
  }

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase();
  }

  const lastName = nameParts[nameParts.length - 1];

  return `${nameParts[0][0]}${lastName[0]}`.toUpperCase();
}

export function PriorityCard({
  clients,
  count,
  description,
  title,
}: PriorityCardProps) {
  const tooltipId = `priority-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}-description`;
  const visibleClients = clients.slice(0, visibleClientLimit);
  const hiddenClientCount = Math.max(
    0,
    clients.length - visibleClients.length,
  );
  const clientNames = clients.map((client) => client.name);
  const affectedClientLabel =
    clientNames.length > 0
      ? clientNames.join(", ")
      : "Linked client unavailable";
  const visibleClientNames = visibleClients.map(
    (client) => client.name,
  );
  const clientSummary =
    hiddenClientCount > 0
      ? `${visibleClientNames.join(", ")} +${hiddenClientCount} more`
      : affectedClientLabel;

  return (
    <article className="flex min-h-44 flex-col rounded-lg border border-[#D9DED8] bg-white p-5">
      <div className="flex min-w-0 items-center gap-2">
        <h3 className="font-bold text-[#17201C]">
          {title}
        </h3>
        <div className="group relative shrink-0">
          <button
            aria-describedby={tooltipId}
            aria-label={`About ${title}`}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#5F6862] hover:bg-[#EDF3EF] hover:text-[#174F42] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174F42]"
            type="button"
          >
            <Info aria-hidden="true" className="h-4 w-4" />
          </button>
          <span
            className="pointer-events-none invisible absolute left-0 top-9 z-20 w-64 rounded-md bg-[#10372F] p-3 text-sm font-medium leading-5 text-white opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
            id={tooltipId}
            role="tooltip"
          >
            {description}
          </span>
        </div>
      </div>

      <p
        className="mt-4 text-sm leading-5 text-[#5F6862]"
        title={affectedClientLabel}
      >
        {clientSummary}
      </p>

      <div className="mt-auto flex shrink-0 items-center justify-end gap-3 pt-5">
        <div
          aria-label={`Affected clients: ${affectedClientLabel}`}
          className="flex -space-x-2"
          role="group"
        >
          {visibleClients.map((client) => (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#DCE8E3] text-xs font-bold text-[#174F42]"
              key={client.id}
              title={`${client.name}${
                client.businessName
                  ? ` | ${client.businessName}`
                  : ""
              }`}
            >
              {getClientInitials(client.name)}
            </span>
          ))}
          {hiddenClientCount > 0 ? (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#5F6862] text-xs font-bold text-white"
              title={clientNames
                .slice(visibleClientLimit)
                .join(", ")}
            >
              +{hiddenClientCount}
            </span>
          ) : null}
        </div>

        <span
          aria-label={`${count} ${title.toLowerCase()}`}
          className="flex h-11 min-w-11 items-center justify-center rounded-md bg-[#EDF3EF] px-3 text-lg font-bold text-[#174F42]"
        >
          {count}
        </span>
      </div>
    </article>
  );
}
