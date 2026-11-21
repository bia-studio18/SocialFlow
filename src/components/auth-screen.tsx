import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AuthScreen({
  title,
  lede,
  children,
  footer,
}: {
  title: string;
  lede: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-paper md:grid-cols-2">
      <section className="hidden flex-col justify-between bg-navy p-10 text-accent-ink md:flex">
        <Link to="/" className="font-display text-3xl">
          SocialFlow
        </Link>
        <div>
          <p className="font-display text-4xl leading-tight">Plan. Publish. Grow.</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-accent-ink/75">
            Workspaces, a content calendar, and a publishing log that refuses to invent success.
          </p>
        </div>
        <p className="text-xs text-accent-ink/60">For brands, creators, and small teams.</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="font-display text-2xl text-navy md:hidden">
            SocialFlow
          </Link>
          <h1 className="mt-4 font-display text-4xl text-ink">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{lede}</p>
          <div className="mt-6 space-y-3">{children}</div>
          <div className="mt-6 text-sm text-muted">{footer}</div>
        </div>
      </section>
    </main>
  );
}
