type PrioritySummaryRowProps = {
  title: string;
  description: string;
  count: number;
};

export function PrioritySummaryRow({
  title,
  description,
  count,
}: PrioritySummaryRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-[#EDF3EF] p-4">
      <div>
        <p className="font-bold text-[#17201C]">{title}</p>
        <p className="mt-1 text-sm text-[#5F6862]">{description}</p>
      </div>
      <span className="rounded-md bg-white px-3 py-2 font-bold text-[#174F42]">
        {count}
      </span>
    </div>
  );
}