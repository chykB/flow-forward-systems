import Link from "next/link";

type ProjectCardProps = {
  title: string;
  description: string;
  href: string;
};

export function ProjectCard({ title, description, href }: ProjectCardProps) {
  return (
    <article className="rounded-lg border border-[#D9DED8] bg-white p-6">
      <h3 className="text-lg font-bold text-[#174F42]">{title}</h3>
      <p className="mt-3 leading-7 text-[#5F6862]">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-block font-bold text-[#1F6F5B] hover:text-[#174F42]"
      >
        View project
      </Link>
    </article>
  );
}