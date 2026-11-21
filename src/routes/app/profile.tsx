import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Btn, Field, PageHeader } from "@/components/ui";
import { TIMEZONES } from "@/lib/socialflow/domain";
import { actions, errText, useAction, useBoot } from "@/lib/socialflow/hooks";

export const Route = createFileRoute("/app/profile")({ component: ProfilePage });

function ProfilePage() {
  const boot = useBoot();
  const save = useAction(actions.updateProfile);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Karachi");
  useEffect(() => {
    if (!boot.data) return;
    setName(boot.data.profile.displayName);
    setTimezone(boot.data.profile.timezone);
  }, [boot.data]);

  return (
    <div>
      <PageHeader title="Profile" lede="This name is for SocialFlow. It is not pushed to Instagram or any other network." />
      <form
        className="grid max-w-lg gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(
            { displayName: name, timezone },
            {
              onSuccess: () => toast.success("Profile saved"),
              onError: (error) => toast.error(errText(error)),
            },
          );
        }}
      >
        <Field label="Display name">
          <input className="sf-input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Timezone preference">
          <select className="sf-input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>
        </Field>
        <p className="text-sm text-muted">Signed in as {boot.data?.user.email || "your account"}.</p>
        <Btn type="submit" disabled={save.isPending}>
          Save profile
        </Btn>
      </form>
    </div>
  );
}
