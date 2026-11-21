import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card, PageHeader, Stat } from "@/components/ui";
import { actions, errText, useBoard } from "@/lib/socialflow/hooks";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/app/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  const board = useBoard();
  const [platform, setPlatform] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = useQuery({
    queryKey: ["sf", "analytics", platform, from, to, board.data?.workspace.id],
    enabled: Boolean(board.data),
    queryFn: () => actions.loadAnalytics({ data: { platform: platform === "all" ? "" : platform, from, to } }),
  });

  return (
    <div>
      <PageHeader
        title="Analytics"
        lede="Post counts are calculated from your workspace. Network engagement is shown as unavailable, not as zero."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="sf-input w-auto" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="all">All platforms</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="linkedin">LinkedIn</option>
          <option value="tiktok">TikTok</option>
        </select>
        <input className="sf-input w-auto" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="sf-input w-auto" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {query.isPending ? <p className="text-sm text-muted">Loading counts…</p> : null}
      {query.isError ? <p className="text-sm text-danger">{errText(query.error)}</p> : null}
      {query.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total posts" value={query.data.totals.total} />
            <Stat label="Scheduled" value={query.data.totals.scheduled} />
            <Stat label="Published" value={query.data.totals.published} />
            <Stat label="Failed or blocked" value={query.data.totals.failed} />
          </div>
          {query.data.advanced ? (
            <Card className="mt-4 h-72">
              <h2 className="font-display text-2xl">Status mix</h2>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart
                  data={[
                    { name: "Draft", n: query.data.totals.draft },
                    { name: "Scheduled", n: query.data.totals.scheduled },
                    { name: "Published", n: query.data.totals.published },
                    { name: "Problems", n: query.data.totals.failed },
                  ]}
                >
                  <XAxis dataKey="name" stroke="var(--color-muted)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--color-muted)" fontSize={12} />
                  <Bar dataKey="n" fill="var(--color-accent)" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          ) : (
            <p className="mt-4 text-sm text-muted">The status chart is included on Business and Agency.</p>
          )}
          <Card className="mt-4">
            <h2 className="font-display text-2xl">Engagement</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries({
                Likes: query.data.engagement.likes,
                Comments: query.data.engagement.comments,
                Shares: query.data.engagement.shares,
                Reach: query.data.engagement.reach,
                Impressions: query.data.engagement.impressions,
              }).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-line py-2">
                  <dt>{label}</dt>
                  <dd className="font-medium text-warn">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm leading-6 text-muted">{query.data.engagement.reason}</p>
          </Card>
        </>
      ) : null}
    </div>
  );
}
