type ProjectPageHeaderProps = {
  label: string;
  title: string;
  description: string;
};

export function ProjectPageHeader({
  label,
  title,
  description,
}: ProjectPageHeaderProps) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#1F6F5B]">
        {label}
      </p>
      <h1 className="max-w-4xl text-4xl font-bold leading-tight text-[#174F42] md:text-6xl">
        {title}
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-[#5F6862]">
        {description}
      </p>
    </section>
  );
}