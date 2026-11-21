import { Link, createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth-screen";

export const Route = createFileRoute("/forgot")({ component: Forgot });

function Forgot() {
  return (
    <AuthScreen
      title="Reset password"
      lede="Password reset email is not configured on this server, so SocialFlow will not pretend a message was sent."
      footer={
        <Link to="/login" className="font-semibold text-accent">
          Back to sign in
        </Link>
      }
    >
      <p className="text-sm leading-6 text-ink">
        Sign in with Google or X, or use the password you chose when you registered. If you are
        locked out of an email account, create a new one only if you do not need the old workspace.
      </p>
    </AuthScreen>
  );
}
