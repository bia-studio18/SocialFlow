import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  Camera,
  Clapperboard,
  PenLine,
  Share2,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PLANS, formatMoney, type Currency } from "@/lib/socialflow/domain";
import type { ReactNode } from "react";
import { useState } from "react";

export const Route = createFileRoute("/")({ component: Home });

const AUDIENCE = [
  { icon: Store, title: "Shops", body: "One calendar for the store, not a pile of phone drafts." },
  { icon: Camera, title: "Creators", body: "Captions, images, and a week you can actually see." },
  { icon: Users, title: "Freelancers", body: "Separate each client so nothing posts to the wrong brand." },
  { icon: Building2, title: "Agencies", body: "Roles, approvals, and a workspace per client on Agency." },
];

const NETWORKS = [
  { icon: Camera, name: "Instagram", status: "Profile only", note: "Publishing waits on official app review." },
  { icon: Share2, name: "Facebook", status: "Ready with a Page token", note: "A post is published only if the Page API accepts it." },
  { icon: Building2, name: "LinkedIn", status: "Ready with a token", note: "Same rule: no success until the official API says so." },
  { icon: Clapperboard, name: "TikTok", status: "Profile only", note: "Video upload stays off until storage is connected." },
];

const STEPS = [
  { n: "01", title: "Write it once", body: "Caption, hashtags, and images. Rules for each network are checked before anything is queued." },
  { n: "02", title: "Place it on the month", body: "Month, week, and day. On a larger screen, drag a draft onto the day it should go out." },
  { n: "03", title: "Watch the attempt", body: "Due posts run in the background. Failures, blocks, and accepted publishes stay in History." },
];

const QUESTIONS = [
  {
    q: "Will a scheduled post go live by itself?",
    a: "Only if that network is configured and the official API accepts the request. Otherwise the attempt is blocked or failed, and you can see why.",
  },
  {
    q: "Can I connect Instagram or TikTok today?",
    a: "You can record the profile name so the calendar knows the target. Live publishing for those networks is not switched on.",
  },
  {
    q: "Do I get charged from this page?",
    a: "No. A plan request stays unpaid until a payment provider you trust confirms the list price. PKR and USD prices are both shown.",
  },
  {
    q: "Who can open a brand?",
    a: "Only people invited to that workspace. Owners, admins, editors, and viewers do not share data across brands.",
  },
];

function Home() {
  const [currency, setCurrency] = useState<Currency>("PKR");
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="font-display text-2xl text-navy">
            SocialFlow
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <a href="#networks" className="hidden min-h-11 items-center px-3 sm:inline-flex">
              Networks
            </a>
            <a href="#pricing" className="hidden min-h-11 items-center px-3 sm:inline-flex">
              Pricing
            </a>
            <a href="#questions" className="hidden min-h-11 items-center px-3 md:inline-flex">
              Questions
            </a>
            <AuthLinks />
          </nav>
        </div>
      </header>
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1.05fr_0.95fr] md:py-20">
          <div>
            <p className="text-sm font-medium tracking-wide text-accent">Plan. Publish. Grow.</p>
            <h1 className="mt-3 max-w-xl font-display text-5xl leading-tight font-medium text-navy md:text-6xl">
              One desk for every brand you post for.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted">
              Draft captions, keep images with the brand, and put posts on a calendar.
              SocialFlow marks a post published only when Facebook or LinkedIn accepts it.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <PrimaryCta />
              <a href="#how" className="sf-btn sf-btn-quiet">
                See the workflow
              </a>
            </div>
            <p className="mt-4 text-sm text-muted">Free to start. Paid plans stay pending until payment is confirmed.</p>
          </div>
          <DeskPreview />
        </section>

        <section className="border-y border-line bg-card">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCE.map((item) => (
              <div key={item.title}>
                <div className="grid size-10 place-items-center rounded-control bg-paper text-navy">
                  <item.icon className="size-5" />
                </div>
                <h2 className="mt-3 font-display text-2xl">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-3xl text-navy">How a week gets planned</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <article key={step.n} className="sf-card">
                <p className="font-display text-3xl text-accent">{step.n}</p>
                <h3 className="mt-3 font-display text-2xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Feature icon={<PenLine className="size-5" />} title="Compose once" body="One caption, then a check against the networks you picked." />
            <Feature icon={<CalendarDays className="size-5" />} title="See the month" body="Upcoming, drafts, and reviews sit on the same board." />
            <Feature icon={<ShieldCheck className="size-5" />} title="No fake success" body="A blocked network stays blocked. The log says so." />
          </div>
        </section>

        <section id="networks" className="border-y border-line bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="font-display text-3xl text-navy">What each network can do</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Official APIs only. Nothing is scraped from a logged-in browser session.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {NETWORKS.map((network) => (
                <article key={network.name} className="sf-card flex gap-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-control bg-paper text-navy">
                    <network.icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl">{network.name}</h3>
                    <p className="text-sm font-medium text-accent">{network.status}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">{network.note}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl text-navy">Pricing</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
                Monthly list prices. Yearly is ten months. A paid plan starts only after a verified payment.
              </p>
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
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  <li>
                    {plan.workspaces} workspace{plan.workspaces === 1 ? "" : "s"}
                  </li>
                  <li>{plan.profiles} social profiles</li>
                  <li>{plan.postsPerMonth === null ? "Unlimited planned posts" : `${plan.postsPerMonth} planned posts / month`}</li>
                  <li>{plan.aiPerMonth} AI assists / month</li>
                  <li>{plan.team ? "Team invites" : "Just you"}</li>
                  <li>{plan.approval ? "Approval step" : "No approval gate"}</li>
                </ul>
                <PlanCta emphasis={plan.id === "creator"} />
              </article>
            ))}
          </div>
        </section>

        <section id="questions" className="border-t border-line bg-card">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <h2 className="font-display text-3xl text-navy">Questions</h2>
            <div className="mt-6 space-y-3">
              {QUESTIONS.map((item) => (
                <details key={item.q} className="sf-card">
                  <summary className="cursor-pointer font-medium">{item.q}</summary>
                  <p className="mt-3 text-sm leading-6 text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-line px-4 py-10 text-sm text-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-display text-2xl text-navy">SocialFlow</p>
            <p className="mt-1">Plan. Publish. Grow.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <a href="#pricing" className="inline-flex min-h-11 items-center">
              Pricing
            </a>
            <Link to="/login" className="inline-flex min-h-11 items-center">
              Sign in
            </Link>
            <Link to="/register" className="inline-flex min-h-11 items-center">
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DeskPreview() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <aside className="sf-card overflow-hidden bg-navy p-0 text-accent-ink">
      <div className="flex items-center justify-between px-5 py-4">
        <p className="font-display text-2xl">North Studio</p>
        <span className="rounded-full bg-navy-2 px-3 py-1 text-xs">This week</span>
      </div>
      <div className="grid grid-cols-5 gap-2 px-5 pb-4 text-xs">
        {days.map((day) => (
          <div key={day} className="rounded-control bg-navy-2 px-2 py-3">
            <p className="text-accent-ink/70">{day}</p>
            {day === "Tue" ? <p className="mt-2 rounded-control bg-accent px-1.5 py-1 text-accent-ink">Launch</p> : null}
            {day === "Thu" ? <p className="mt-2 rounded-control bg-card px-1.5 py-1 text-ink">Menu</p> : null}
          </div>
        ))}
      </div>
      <ul className="space-y-3 border-t border-accent-ink/15 px-5 py-4 text-sm">
        <li className="flex items-center justify-between gap-3">
          <span>Studio launch</span>
          <span className="text-accent-ink/70">Draft</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span>Menu photo</span>
          <span className="text-accent-ink/70">Scheduled</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span>Client recap</span>
          <span className="text-accent-ink/70">Needs review</span>
        </li>
      </ul>
      <p className="px-5 pb-4 text-xs leading-5 text-accent-ink/70">A picture of the desk, not a live account.</p>
    </aside>
  );
}

function Feature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-card border border-line bg-card p-5">
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

function PlanCta({ emphasis }: { emphasis: boolean }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <span className="mt-5 inline-block h-11 w-full animate-pulse rounded-control bg-line" />;
  return (
    <Link to={user ? "/app/billing" : "/register"} className={`sf-btn mt-5 ${emphasis ? "sf-btn-primary" : "sf-btn-quiet"}`}>
      {user ? "Open billing" : "Start here"}
    </Link>
  );
}
