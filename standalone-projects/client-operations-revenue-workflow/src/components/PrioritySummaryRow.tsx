import { CircleCheck } from "lucide-react";

type PrioritySummaryRowProps = {
  description: string;
  title: string;
};

export function PrioritySummaryRow({
  description,
  title,
}: PrioritySummaryRowProps) {
  return (
    <div
      className="flex min-w-0 items-center gap-2 py-2 text-sm text-[#5F6862]"
      title={description}
    >
      <CircleCheck
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-[#2E7D5B]"
      />
      <span className="font-semibold">{title}</span>
    </div>
  );
}
