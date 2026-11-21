import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AuthScreen } from "@/components/auth-screen";
import { Btn, Field } from "@/components/ui";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Could not sign in.");
      return;
    }
    await router.navigate({ to: "/app" });
  }

  return (
    <AuthScreen
      title="Sign in"
      lede="Use email or continue with Google or X."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-semibold text-accent">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-3" onSubmit={onSubmit}>
        <Field label="Email">
          <input className="sf-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className="sf-input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Btn type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Btn>
      </form>
      <Link to="/forgot" className="inline-flex min-h-11 items-center text-sm text-accent">
        Forgot password
      </Link>
      <div className="space-y-2 pt-2">
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
