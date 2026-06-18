import { InfoCard } from "./InfoCard";

type ProjectMetaItem = {
  title: string;
  description: string;
};

type ProjectMetaGridProps = {
  items: ProjectMetaItem[];
};

export function ProjectMetaGrid({ items }: ProjectMetaGridProps) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      <h2 className="mb-6 text-3xl font-bold leading-tight text-[#17201C] md:text-4xl">
        Project Status
      </h2>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <InfoCard
            key={item.title}
            title={item.title}
            description={item.description}
          />
        ))}
      </div>
    </section>
  );
}