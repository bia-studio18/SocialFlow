import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Btn, Card, Field, PageHeader } from "@/components/ui";
import { TIMEZONES } from "@/lib/socialflow/domain";
import { actions, errText, useAction, useBoard, useBoot } from "@/lib/socialflow/hooks";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const boot = useBoot();
  const board = useBoard();
  const save = useAction(actions.updateWorkspace);
  const create = useAction(actions.createWorkspace);
  const remove = useAction(actions.deleteWorkspace);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Karachi");
  const [fresh, setFresh] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (!board.data) return;
    setName(board.data.workspace.name);
    setTimezone(board.data.workspace.timezone);
  }, [board.data]);

  const role = board.data?.workspace.role;
  const admin = role === "owner" || role === "admin";

  return (
    <div>
      <PageHeader title="Workspace" lede="Names and timezones apply to the brand you have selected." />
      <Card>
        <form
          className="grid gap-3 md:max-w-lg"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(
              { name, timezone },
              {
                onSuccess: () => toast.success("Workspace updated"),
                onError: (error) => toast.error(errText(error)),
              },
            );
          }}
        >
          <Field label="Name">
            <input className="sf-input" value={name} disabled={!admin} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Timezone">
            <select className="sf-input" value={timezone} disabled={!admin} onChange={(e) => setTimezone(e.target.value)}>
              {TIMEZONES.map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </Field>
          {admin ? (
            <Btn type="submit" disabled={save.isPending}>
              Save workspace
            </Btn>
          ) : (
            <p className="text-sm text-muted">Only admins can edit workspace settings.</p>
          )}
        </form>
      </Card>
      <Card className="mt-4">
        <h2 className="font-display text-2xl">Another workspace</h2>
        <p className="mt-1 text-sm text-muted">
          You own {boot.data?.usage.ownedWorkspaces ?? 0} of {boot.data ? "your plan limit" : ""}. The limit follows your personal plan, not this brand’s owner, when you create one.
        </p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate(
              { name: fresh, timezone },
              {
                onSuccess: () => {
                  toast.success("Workspace created");
                  setFresh("");
                },
                onError: (error) => toast.error(errText(error)),
              },
            );
          }}
        >
          <input className="sf-input" placeholder="Client name" value={fresh} onChange={(e) => setFresh(e.target.value)} />
          <Btn type="submit" disabled={create.isPending}>
            Create
          </Btn>
        </form>
      </Card>
      {role === "owner" ? (
        <Card className="mt-4">
          <h2 className="font-display text-2xl">Delete workspace</h2>
          <p className="mt-1 text-sm text-muted">Type {board.data?.workspace.name} to delete posts, media, and members in this brand. You need another workspace first.</p>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              remove.mutate(
                { confirmName: confirm },
                {
                  onSuccess: () => toast.success("Workspace deleted"),
                  onError: (error) => toast.error(errText(error)),
                },
              );
            }}
          >
            <input className="sf-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <Btn type="submit" tone="danger" disabled={remove.isPending}>
              Delete
            </Btn>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
