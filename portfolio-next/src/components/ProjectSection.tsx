import type { ReactNode } from "react";

type ProjectSectionProps = {
  title: string;
  children: ReactNode;
};

export function ProjectSection({ title, children }: ProjectSectionProps) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      <h2 className="mb-6 text-3xl font-bold leading-tight text-[#17201C] md:text-4xl">
        {title}
      </h2>
      <div className="grid gap-5">{children}</div>
    </section>
  );
}