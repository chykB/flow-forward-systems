import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";

type SiteShellProps = {
  children: ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="min-h-screen bg-[#F7F8F6] text-[#17201C]">
      <Header />
      {children}
      <Footer />
    </div>
  );
}