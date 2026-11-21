import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/billing/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleWebhook } = await import("@/lib/socialflow/logic.server");
        return handleWebhook(request);
      },
    },
  },
});
