type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
}: SectionHeaderProps) {
  return (
    <div className="mb-8 max-w-3xl">
      {eyebrow ? (
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#1F6F5B]">
          {eyebrow}
        </p>
      ) : null}

      <h2 className="text-3xl font-bold leading-tight text-[#17201C] md:text-4xl">
        {title}
      </h2>

      {description ? (
        <p className="mt-4 text-lg leading-8 text-[#5F6862]">{description}</p>
      ) : null}
    </div>
  );
}