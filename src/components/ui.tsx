import type { ButtonHTMLAttributes, ReactNode } from "react";

export function PageHeader({
  title,
  lede,
  actions,
}: {
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight text-ink">{title}</h1>
        {lede ? <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{lede}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`sf-card ${className}`}>{children}</section>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-ink">
      <span>{label}</span>
      {children}
    </label>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "navy" | "quiet" | "danger";
};

export function Btn({ tone = "primary", className = "", ...props }: BtnProps) {
  const toneClass =
    tone === "navy"
      ? "sf-btn-navy"
      : tone === "quiet"
        ? "sf-btn-quiet"
        : tone === "danger"
          ? "bg-danger text-accent-ink"
          : "sf-btn-primary";
  return (
    <button
      {...props}
      className={`sf-btn ${toneClass} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

const BADGE: Record<string, string> = {
  published: "bg-ok/10 text-ok",
  scheduled: "bg-accent/10 text-accent",
  draft: "bg-line text-muted",
  failed: "bg-danger/10 text-danger",
  blocked: "bg-danger/10 text-danger",
  awaiting_credentials: "bg-warn/10 text-warn",
  pending: "bg-warn/10 text-warn",
  approved: "bg-ok/10 text-ok",
  changes: "bg-warn/10 text-warn",
  active: "bg-ok/10 text-ok",
  invited: "bg-line text-muted",
  awaiting_provider: "bg-warn/10 text-warn",
  succeeded: "bg-ok/10 text-ok",
  cancelled: "bg-line text-muted",
};

export function Badge({ value }: { value: string }) {
  const label = value.replaceAll("_", " ");
  return <span className={`sf-badge ${BADGE[value] ?? "bg-line text-muted"}`}>{label}</span>;
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card border border-dashed border-line px-6 py-10 text-center">
      <p className="font-display text-xl text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-dialog bg-card p-6 text-ink"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title" className="font-display text-2xl">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Btn tone="quiet" type="button" onClick={onClose}>
            Cancel
          </Btn>
          <Btn tone={danger ? "danger" : "primary"} type="button" disabled={busy} onClick={onConfirm}>
            {busy ? "Working…" : confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-muted">{hint}</p> : null}
    </Card>
  );
}
