import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge, Btn, Empty, PageHeader } from "@/components/ui";
import { PLATFORM_LABEL, isPlatform } from "@/lib/socialflow/domain";
import { actions, errText, useAction, useBoard } from "@/lib/socialflow/hooks";

export const Route = createFileRoute("/app/history")({ component: HistoryPage });

function HistoryPage() {
  const board = useBoard();
  const retry = useAction(actions.retryAttempt);
  if (board.isPending) return <p className="text-sm text-muted">Loading history…</p>;
  if (board.isError) return <p className="text-sm text-danger">{errText(board.error)}</p>;
  const attempts = board.data?.attempts ?? [];
  const canEdit = board.data?.workspace.role !== "viewer";

  return (
    <div>
      <PageHeader
        title="Publishing history"
        lede="Every attempt is stored. A retry waits out the backoff timer, then calls the official path again. It still will not invent a success."
        actions={
          <Btn type="button" tone="quiet" onClick={() => void board.refetch()}>
            Check due posts
          </Btn>
        }
      />
      {attempts.length === 0 ? (
        <Empty title="No attempts yet" body="Publish or wait until a scheduled time. The result, including a block for missing credentials, is listed here." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-card">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Detail</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => (
                <tr key={attempt.id} className="border-t border-line">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {attempt.createdAt ? new Date(attempt.createdAt).toLocaleString() : ""}
                    <div className="text-xs text-muted">Attempt {attempt.attemptNo}</div>
                  </td>
                  <td className="px-4 py-3">{isPlatform(attempt.platform) ? PLATFORM_LABEL[attempt.platform] : attempt.platform}</td>
                  <td className="px-4 py-3">
                    <Badge value={attempt.status} />
                  </td>
                  <td className="px-4 py-3">
                    <p>{attempt.message}</p>
                    {attempt.errorCode ? <p className="text-xs text-muted">{attempt.errorCode}</p> : null}
                    <Link to="/app/compose" search={{ post: attempt.postId }} className="text-xs text-accent">
                      Open post
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {canEdit && attempt.status !== "published" ? (
                      <Btn
                        type="button"
                        tone="quiet"
                        disabled={retry.isPending}
                        onClick={() =>
                          retry.mutate(
                            { id: attempt.id },
                            {
                              onSuccess: (result) => toast.message((result as { message: string }).message),
                              onError: (error) => toast.error(errText(error)),
                            },
                          )
                        }
                      >
                        Retry
                      </Btn>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
