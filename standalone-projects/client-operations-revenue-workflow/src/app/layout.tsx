import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Client Operations & Revenue Workflow System",
  description:
    "Manage client workflows, next actions, delivery, approvals, payments, risks, and handoff context in one durable workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
