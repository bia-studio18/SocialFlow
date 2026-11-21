import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarDays, PenLine, ShieldCheck } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PLANS, formatMoney, type Currency } from "@/lib/socialflow/domain";
import type { ReactNode } from "react";
import { useState } from "react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [currency, setCurrency] = useState<Currency>("PKR");
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
        <span className="font-display text-2xl">SocialFlow</span>
        <nav className="flex items-center gap-2 text-sm">
          <a href="#pricing" className="hidden min-h-11 items-center px-3 sm:inline-flex">
            Pricing
          </a>
          <AuthLinks />
        </nav>
      </header>
      <main>
        <section className="mx-auto grid max-w-6xl items-end gap-10 px-4 pb-16 pt-8 md:grid-cols-[1.2fr_0.8fr] md:pt-16">
          <div>
            <p className="text-sm font-medium tracking-wide text-accent">Plan. Publish. Grow.</p>
            <h1 className="mt-3 max-w-xl font-display text-5xl leading-tight font-medium text-navy md:text-6xl">
              One desk for every brand you post for.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted">
              Draft captions, park images, and put posts on a calendar. SocialFlow only marks a
              post published when an official platform API accepts it.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <PrimaryCta />
              <a href="#how" className="sf-btn sf-btn-quiet">
                See how it works
              </a>
            </div>
          </div>
          <aside className="sf-card bg-navy text-accent-ink">
            <p className="text-sm text-accent-ink/80">This week</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <span>Studio launch</span>
                <span className="text-accent-ink/70">Tue · draft</span>
              </li>
              <li className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <span>Menu photo</span>
                <span className="text-accent-ink/70">Thu · scheduled</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Client recap</span>
                <span className="text-accent-ink/70">Fri · needs review</span>
              </li>
            </ul>
            <p className="mt-6 text-xs leading-5 text-accent-ink/70">
              Sample of the calendar, not live account data.
            </p>
          </aside>
        </section>
        <section id="how" className="border-y border-line bg-card">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-3">
            <Feature
              icon={<PenLine className="size-5" />}
              title="Compose once"
              body="Caption, hashtags, and images, with rules for each network before you queue anything."
            />
            <Feature
              icon={<CalendarDays className="size-5" />}
              title="See the month"
              body="Month, week, and day views. Drag a draft onto a day when you are on a larger screen."
            />
            <Feature
              icon={<ShieldCheck className="size-5" />}
              title="Publish honestly"
              body="If Instagram, Facebook, LinkedIn, or TikTok has not approved the connection, the attempt is blocked and recorded. Never a fake success."
            />
          </div>
        </section>
        <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl">Pricing</h2>
              <p className="mt-1 text-sm text-muted">Monthly list prices. A paid plan starts only after a verified payment.</p>
            </div>
            <div className="flex rounded-control border border-line p-1">
              {(["PKR", "USD"] as Currency[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`min-h-11 rounded-control px-4 text-sm font-semibold ${currency === code ? "bg-navy text-accent-ink" : ""}`}
                  onClick={() => setCurrency(code)}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Object.values(PLANS).map((plan) => (
              <article key={plan.id} className="sf-card flex flex-col">
                <h3 className="font-display text-2xl">{plan.name}</h3>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {formatMoney(currency === "PKR" ? plan.pkr : plan.usd, currency)}
                  <span className="text-sm font-normal text-muted"> / month</span>
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">{plan.blurb}</p>
                <ul className="mt-4 flex-1 space-y-1 text-sm text-ink">
                  <li>{plan.workspaces} workspace{plan.workspaces === 1 ? "" : "s"}</li>
                  <li>{plan.profiles} social profiles</li>
                  <li>{plan.postsPerMonth === null ? "Unlimited drafts" : `${plan.postsPerMonth} planned posts / month`}</li>
                  <li>{plan.aiPerMonth} AI assists / month</li>
                </ul>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-line px-4 py-8 text-sm text-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3">
          <span>SocialFlow</span>
          <span>Official APIs only. No scraped sessions.</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="grid size-10 place-items-center rounded-control bg-paper text-navy">{icon}</div>
      <h2 className="mt-3 font-display text-2xl">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}

function AuthLinks() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <span className="inline-block h-11 w-28 animate-pulse rounded-control bg-line" />;
  if (user) {
    return (
      <Link to="/app" className="sf-btn sf-btn-navy">
        Open dashboard
      </Link>
    );
  }
  return (
    <>
      <Link to="/login" className="inline-flex min-h-11 items-center px-3">
        Sign in
      </Link>
      <Link to="/register" className="sf-btn sf-btn-navy">
        Create account
      </Link>
    </>
  );
}

function PrimaryCta() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <span className="inline-block h-11 w-36 animate-pulse rounded-control bg-line" />;
  return (
    <Link to={user ? "/app" : "/register"} className="sf-btn sf-btn-primary">
      {user ? "Go to your brands" : "Start on Free"}
    </Link>
  );
}
