type InfoCardProps = {
  title: string;
  description: string;
};

export function InfoCard({ title, description }: InfoCardProps) {
  return (
    <article className="rounded-lg border border-[#D9DED8] bg-white p-6">
      <h3 className="text-lg font-bold text-[#174F42]">{title}</h3>
      <p className="mt-3 leading-7 text-[#5F6862]">{description}</p>
    </article>
  );
}