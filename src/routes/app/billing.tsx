import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Btn, Card, PageHeader } from "@/components/ui";
import { PLANS, formatMoney, priceFor, type Currency, type Interval, type PlanId } from "@/lib/socialflow/domain";
import { actions, errText, useAction, useBoard, useBoot } from "@/lib/socialflow/hooks";

export const Route = createFileRoute("/app/billing")({ component: BillingPage });

function BillingPage() {
  const boot = useBoot();
  const board = useBoard();
  const request = useAction(actions.requestPlan);
  const [currency, setCurrency] = useState<Currency>("PKR");
  const [interval, setInterval] = useState<Interval>("month");
  const plan = boot.data?.plan ?? "free";

  return (
    <div>
      <PageHeader
        title="Billing"
        lede="Paid plans stay pending until a signed payment webhook confirms the exact list price. Cancelling to Free does not charge anything."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["PKR", "USD"] as Currency[]).map((code) => (
          <button key={code} type="button" className={`sf-btn ${currency === code ? "sf-btn-navy" : "sf-btn-quiet"}`} onClick={() => setCurrency(code)}>
            {code}
          </button>
        ))}
        {(["month", "year"] as Interval[]).map((code) => (
          <button key={code} type="button" className={`sf-btn ${interval === code ? "sf-btn-navy" : "sf-btn-quiet"}`} onClick={() => setInterval(code)}>
            {code === "year" ? "Yearly (10×)" : "Monthly"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const spec = PLANS[id];
          const amount = priceFor(id, currency, interval);
          const current = plan === id;
          return (
            <Card key={id}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl">{spec.name}</h2>
                {current ? <Badge value="active" /> : null}
              </div>
              <p className="mt-2 text-xl tabular-nums">{formatMoney(amount, currency)}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{spec.blurb}</p>
              <Btn
                className="mt-4"
                tone={current ? "quiet" : "primary"}
                type="button"
                disabled={request.isPending || (current && id !== "free")}
                onClick={() =>
                  request.mutate(
                    { plan: id, currency, interval },
                    {
                      onSuccess: (result) => toast.success((result as { message: string }).message),
                      onError: (error) => toast.error(errText(error)),
                    },
                  )
                }
              >
                {id === "free" ? "Move to Free" : current ? "Current plan" : "Request upgrade"}
              </Btn>
            </Card>
          );
        })}
      </div>
      <Card className="mt-6">
        <h2 className="font-display text-2xl">Payment records</h2>
        {(board.data?.payments.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted">No payments yet.</p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {board.data?.payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {payment.plan} · {formatMoney(payment.amount, payment.currency === "USD" ? "USD" : "PKR")} · {payment.detail}
                </span>
                <Badge value={payment.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
