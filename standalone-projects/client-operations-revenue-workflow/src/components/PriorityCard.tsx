type PriorityCardProps = {
  title: string;
  description: string;
  count: number;
};

export function PriorityCard({
  title,
  description,
  count,
}: PriorityCardProps) {
  return (
    <article className="rounded-lg border border-[#D9DED8] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-bold">{title}</h3>
        <span className="rounded-md bg-[#EDF3EF] px-3 py-2 font-bold text-[#174F42]">
          {count}
        </span>
      </div>
      <p className="mt-3 leading-7 text-[#5F6862]">{description}</p>
    </article>
  );
}