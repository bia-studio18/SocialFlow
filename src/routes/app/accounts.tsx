import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Btn, Card, Field, PageHeader } from "@/components/ui";
import { PLATFORM_LABEL, PLATFORMS } from "@/lib/socialflow/domain";
import { actions, errText, useAction, useBoard } from "@/lib/socialflow/hooks";

export const Route = createFileRoute("/app/accounts")({ component: AccountsPage });

function AccountsPage() {
  const board = useBoard();
  const connect = useAction(actions.connectAccount);
  const disconnect = useAction(actions.disconnectAccount);
  const [names, setNames] = useState<Record<string, string>>({});
  if (board.isPending) return <p className="text-sm text-muted">Loading accounts…</p>;
  if (board.isError) return <p className="text-sm text-danger">{errText(board.error)}</p>;
  const data = board.data;
  if (!data) return null;
  const admin = data.workspace.role === "owner" || data.workspace.role === "admin";

  return (
    <div>
      <PageHeader
        title="Social accounts"
        lede="Connecting a profile records the intent. Tokens are never typed into the browser, and a profile is not treated as live until official publishing is configured."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map((platform) => {
          const rows = data.accounts.filter((a) => a.platform === platform);
          const ready = data.platformReady[platform];
          return (
            <Card key={platform}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-2xl">{PLATFORM_LABEL[platform]}</h2>
                <Badge value={ready ? "active" : "awaiting_credentials"} />
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">
                {ready
                  ? "Server credentials are set. A publish attempt will call the official API."
                  : "Server credentials are not set. Attempts stay blocked."}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {rows.length === 0 ? <li className="text-muted">No profile on file.</li> : null}
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2">
                    <span>
                      {row.displayName} <Badge value={row.status} />
                    </span>
                    {admin ? (
                      <button
                        type="button"
                        className="text-danger"
                        onClick={() =>
                          disconnect.mutate(
                            { id: row.id },
                            { onError: (error) => toast.error(errText(error)) },
                          )
                        }
                      >
                        Disconnect
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {admin ? (
                <form
                  className="mt-4 flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    connect.mutate(
                      { platform, displayName: names[platform] ?? "" },
                      {
                        onSuccess: () => {
                          toast.success("Profile recorded. Publishing is still not marked successful.");
                          setNames((prev) => ({ ...prev, [platform]: "" }));
                        },
                        onError: (error) => toast.error(errText(error)),
                      },
                    );
                  }}
                >
                  <Field label="Profile name">
                    <input
                      className="sf-input"
                      value={names[platform] ?? ""}
                      onChange={(e) => setNames((prev) => ({ ...prev, [platform]: e.target.value }))}
                    />
                  </Field>
                  <Btn type="submit" className="sm:self-end" disabled={connect.isPending}>
                    Add profile
                  </Btn>
                </form>
              ) : (
                <p className="mt-3 text-sm text-muted">Viewers cannot change connections.</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
