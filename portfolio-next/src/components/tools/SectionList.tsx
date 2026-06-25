type SectionListProps = {
  title: string;
  items: string[];
};

export function SectionList({ title, items }: SectionListProps) {
  return (
    <div>
      <h4 className="font-bold text-[#17201C]">{title}</h4>
      <ul className="mt-3 grid gap-2 text-[#5F6862]">
        {items.map((item) => (
          <li key={item} className="rounded-md bg-[#EDF3EF] p-3">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}