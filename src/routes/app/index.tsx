import { Link, createFileRoute } from "@tanstack/react-router";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { PLATFORM_LABEL, type Platform } from "@/lib/socialflow/domain";
import { errText, useBoard } from "@/lib/socialflow/hooks";

export const Route = createFileRoute("/app/")({ component: Dashboard });

function Dashboard() {
  const board = useBoard();
  if (board.isPending) return <p className="text-sm text-muted">Loading overview…</p>;
  if (board.isError) return <p className="text-sm text-danger">{errText(board.error)}</p>;
  const data = board.data;
  if (!data) return null;
  const live = data.accounts.filter((a) => a.status === "connected").length;
  const waiting = data.accounts.filter((a) => a.status !== "connected").length;
  const scheduled = data.posts.filter((p) => p.status === "scheduled");
  const published = data.posts.filter((p) => p.status === "published").length;
  const failed = data.posts.filter((p) => p.status === "failed" || p.status === "blocked").length;
  const upcoming = [...scheduled].sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "")).slice(0, 5);

  return (
    <div>
      <PageHeader
        title={data.workspace.name}
        lede="Counts come from this workspace. Engagement from networks is not estimated."
        actions={
          <Link to="/app/compose" search={{ post: "" }} className="sf-btn sf-btn-primary">
            New post
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Live connections" value={live} hint={waiting ? `${waiting} waiting on API approval` : "No profiles on file yet"} />
        <Stat label="Scheduled" value={scheduled.length} hint="Queued, not yet sent" />
        <Stat label="Published" value={published} hint="Accepted by an official API" />
        <Stat label="Failed or blocked" value={failed} hint="Visible in history" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl">Upcoming</h2>
          {upcoming.length === 0 ? (
            <div className="mt-4">
              <Empty title="Nothing queued" body="Schedule a post from the composer. Due posts are checked when you open the workspace." />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcoming.map((post) => (
                <li key={post.id} className="flex items-start justify-between gap-3">
                  <div>
                    <Link to="/app/compose" search={{ post: post.id }} className="font-medium">
                      {post.caption.slice(0, 80) || "Untitled"}
                    </Link>
                    <p className="text-xs text-muted">
                      {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : "Unscheduled"}
                    </p>
                  </div>
                  <Badge value={post.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="font-display text-2xl">Recent activity</h2>
          {data.activity.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Actions you take in this workspace show up here.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {data.activity.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span>
                    {item.action}
                    {item.detail ? ` · ${item.detail}` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs leading-5 text-muted">
            Plan in use for this brand: {data.plan}. Profiles {data.usage.profiles}/{data.limits.profiles}. Posts this month{" "}
            {data.usage.postsThisMonth}
            {data.limits.postsPerMonth === null ? "" : `/${data.limits.postsPerMonth}`}.
          </p>
          {data.accounts[0] ? (
            <p className="mt-2 text-xs text-muted">
              Latest profile: {PLATFORM_LABEL[data.accounts[0].platform as Platform]} · {data.accounts[0].displayName}
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
