import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Empty, PageHeader, Btn } from "@/components/ui";
import { actions, errText, useAction, useBoard } from "@/lib/socialflow/hooks";

export const Route = createFileRoute("/app/notifications")({ component: NotesPage });

function NotesPage() {
  const board = useBoard();
  const mark = useAction(actions.markNotesRead);
  if (board.isPending) return <p className="text-sm text-muted">Loading inbox…</p>;
  if (board.isError) return <p className="text-sm text-danger">{errText(board.error)}</p>;
  const notes = board.data?.notifications ?? [];
  return (
    <div>
      <PageHeader
        title="Inbox"
        lede="Publishing results, reminders for the next day, and billing notes land here."
        actions={
          <Btn
            type="button"
            tone="quiet"
            disabled={mark.isPending}
            onClick={() => mark.mutate({ ok: true }, { onError: (error) => toast.error(errText(error)) })}
          >
            Mark all read
          </Btn>
        }
      />
      {notes.length === 0 ? (
        <Empty title="No notifications" body="When a post is blocked, approved, or coming up, it will be listed here." />
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className={`sf-card ${note.read ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-medium">{note.title}</h2>
                <span className="text-xs text-muted">{note.createdAt ? new Date(note.createdAt).toLocaleString() : ""}</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
