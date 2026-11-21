import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Stat } from "@/components/ui";
import { actions, errText } from "@/lib/socialflow/hooks";

export const Route = createFileRoute("/app/admin")({ component: AdminPage });

function AdminPage() {
  const query = useQuery({
    queryKey: ["sf", "admin"],
    queryFn: () => actions.adminOverview(),
    retry: false,
  });
  return (
    <div>
      <PageHeader title="Operator" lede="Counts only. Captions and tokens are not listed here." />
      {query.isPending ? <p className="text-sm text-muted">Checking access…</p> : null}
      {query.isError ? <p className="text-sm text-muted">{errText(query.error)}</p> : null}
      {query.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Accounts" value={query.data.users} />
            <Stat label="Workspaces" value={query.data.workspaces} />
            <Stat label="Publishing problems" value={query.data.publishingProblems} />
            <Stat label="Database" value={query.data.database} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="font-display text-2xl">Subscriptions</h2>
              <ul className="mt-3 text-sm">
                {query.data.subscriptions.map((row) => (
                  <li key={row.plan} className="flex justify-between py-1">
                    <span>{row.plan}</span>
                    <span className="tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h2 className="font-display text-2xl">Payments</h2>
              <ul className="mt-3 text-sm">
                {query.data.payments.length === 0 ? <li className="text-muted">None</li> : null}
                {query.data.payments.map((row) => (
                  <li key={row.status} className="flex justify-between py-1">
                    <span>{row.status}</span>
                    <span className="tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
