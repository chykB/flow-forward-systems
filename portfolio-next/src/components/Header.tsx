import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/#services", label: "Services" },
  { href: "/#tools", label: "Tools" },
  { href: "/#projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "/resources", label: "Resources" },
  { href: "/about", label: "About" },
  { href: "/#contact", label: "Contact" },
];

export function Header() {
  return (
    <header className="border-b border-[#D9DED8] bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr] items-center gap-x-12 gap-y-4 px-6 py-4 max-md:flex max-md:flex-col max-md:items-start">
        <Link
          href="/"
          aria-label="FlowForward Systems home"
          className="inline-flex items-center gap-3 font-extrabold text-[#174F42]"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#174F42] text-sm tracking-normal text-white">
            FF
          </span>
          <span className="whitespace-nowrap">FlowForward Systems</span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="flex flex-wrap items-center justify-center gap-2 justify-self-center max-md:justify-start"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-semibold text-[#17201C] hover:bg-[#EDF3EF] hover:text-[#174F42]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

      </div>
    </header>
  );
}