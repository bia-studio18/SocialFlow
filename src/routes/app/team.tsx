import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Btn, Card, Field, PageHeader } from "@/components/ui";
import { actions, errText, useAction, useBoard } from "@/lib/socialflow/hooks";

export const Route = createFileRoute("/app/team")({ component: TeamPage });

function TeamPage() {
  const board = useBoard();
  const invite = useAction(actions.inviteMember);
  const update = useAction(actions.updateMember);
  const remove = useAction(actions.removeMember);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  if (board.isPending) return <p className="text-sm text-muted">Loading team…</p>;
  if (board.isError) return <p className="text-sm text-danger">{errText(board.error)}</p>;
  const data = board.data;
  if (!data) return null;
  const admin = data.workspace.role === "owner" || data.workspace.role === "admin";

  return (
    <div>
      <PageHeader
        title="Team"
        lede={data.limits.team ? "Invite people by email. They join this workspace when they sign in with that address." : "Team seats are on Business and Agency. You can still see who is already here."}
      />
      <Card>
        <ul className="space-y-3">
          {data.members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-muted">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge value={member.status} />
                {admin && member.role !== "owner" ? (
                  <>
                    <select
                      className="sf-input w-auto"
                      value={member.role}
                      onChange={(event) =>
                        update.mutate(
                          { membershipId: member.id, role: event.target.value },
                          { onError: (error) => toast.error(errText(error)) },
                        )
                      }
                    >
                      <option value="admin">admin</option>
                      <option value="editor">editor</option>
                      <option value="viewer">viewer</option>
                    </select>
                    <button type="button" className="text-danger" onClick={() => remove.mutate({ membershipId: member.id }, { onError: (e) => toast.error(errText(e)) })}>
                      Remove
                    </button>
                  </>
                ) : (
                  <Badge value={member.role} />
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {admin ? (
        <form
          className="mt-4 grid gap-3 md:grid-cols-[1fr_10rem_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            invite.mutate(
              { email, role },
              {
                onSuccess: (result) => {
                  toast.success((result as { status: string }).status === "active" ? "They are in the workspace." : "Invite saved. They will join when they register that email.");
                  setEmail("");
                },
                onError: (error) => toast.error(errText(error)),
              },
            );
          }}
        >
          <Field label="Email">
            <input className="sf-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Role">
            <select className="sf-input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </Field>
          <Btn type="submit" className="md:self-end" disabled={invite.isPending}>
            Invite
          </Btn>
        </form>
      ) : null}
    </div>
  );
}
