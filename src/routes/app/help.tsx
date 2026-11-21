import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui";

export const Route = createFileRoute("/app/help")({ component: HelpPage });

const ITEMS = [
  {
    q: "Why did my post not publish?",
    a: "Open History. If credentials are missing, the status is blocked and the post was not sent. SocialFlow does not mark a post published unless Facebook or LinkedIn accepts it through the official API.",
  },
  {
    q: "Where is Instagram and TikTok?",
    a: "You can file a profile so the calendar can target it. Live publishing for those networks is pending official app review, and video files need object storage that is not connected.",
  },
  {
    q: "Why did an upgrade not change my plan?",
    a: "A request records an unpaid payment. The plan changes only after a signed billing webhook confirms the list price, or immediately if you move back to Free.",
  },
  {
    q: "Who can see my posts?",
    a: "Only members of that workspace. Every request checks your membership on the server.",
  },
  {
    q: "What does AI use?",
    a: "Caption, hashtag, and idea buttons call the server. The key never reaches the browser. Each success counts toward the workspace monthly limit.",
  },
];

function HelpPage() {
  return (
    <div>
      <PageHeader title="Help" lede="Straight answers about what is live and what is waiting on an outside approval." />
      <div className="space-y-3">
        {ITEMS.map((item) => (
          <article key={item.q} className="sf-card">
            <h2 className="font-display text-2xl">{item.q}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{item.a}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
