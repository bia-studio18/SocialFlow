import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AuthScreen } from "@/components/auth-screen";
import { Btn, Field } from "@/components/ui";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/register")({ component: Register });

function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await authClient.signUp.email({ name, email, password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Could not create the account.");
      return;
    }
    await router.navigate({ to: "/app" });
  }

  return (
    <AuthScreen
      title="Create your account"
      lede="Free includes one workspace, one profile, and ten planned posts a month."
      footer={
        <>
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-accent">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-3" onSubmit={onSubmit}>
        <Field label="Name">
          <input className="sf-input" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="sf-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className="sf-input" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Btn type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Btn>
      </form>
      <div className="space-y-2">
        {GROK_PROVIDERS.map((provider) => (
          <Btn
            key={provider.providerId}
            type="button"
            tone="quiet"
            className="w-full"
            onClick={() => void signIn(provider.providerId, { callbackURL: "/app" })}
          >
            Continue with {provider.label}
          </Btn>
        ))}
      </div>
    </AuthScreen>
  );
}
