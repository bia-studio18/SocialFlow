# SocialFlow

Plan. Publish. Grow.

SocialFlow is a social media planning product for small businesses, creators, and teams. People sign in, keep brands in separate workspaces, draft posts, store images, schedule them on a calendar, and review a publishing log.

Publishing does **not** pretend. A post is marked published only when Facebook or LinkedIn accepts it through the official API. Instagram and TikTok stay blocked until those official integrations are approved, and video upload stays off until object storage is connected. Paid plans change only after a signed billing webhook confirms the list price.

## What you can do

- Register and sign in with email, Google, or X
- Create workspaces and invite teammates as admin, editor, or viewer
- Draft, duplicate, and delete posts
- Attach images and preview a caption
- Month, week, and day calendar, including drag-and-drop on a desktop
- Record social profiles without storing tokens in the browser
- Run due posts and retries, with backoff and an attempt history
- See real post counts, and engagement marked unavailable rather than zero
- Request a plan upgrade, cancel back to Free, and store payment records
- Ask for an AI caption when the server key is available, within a monthly cap

## Plans

| Plan | PKR / month | USD / month |
| --- | --- | --- |
| Free | 0 | 0 |
| Creator | 799 | 9 |
| Business | 1,999 | 19 |
| Agency | 4,999 | 49 |

Yearly list price is ten times the monthly price. USD amounts are the international list. Nothing is charged from the billing page itself.

## Stack

React, TypeScript, TanStack Start, Tailwind CSS, Postgres (Neon when deployed, local embedded Postgres in preview), Better Auth.

## Operator configuration

These are server environment variables. Do not put them in frontend code or commit them.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection, injected on deploy |
| `XAI_API_KEY` | Optional AI captions |
| `SOCIALFLOW_ADMIN_EMAILS` | Comma-separated operator emails for the admin counts page |
| `SOCIALFLOW_WEBHOOK_SECRET` | HMAC secret for `POST /api/billing/webhook` |
| `SOCIALFLOW_FB_PAGE_ID` | Facebook Page id, only if you are approved to publish |
| `SOCIALFLOW_FB_PAGE_TOKEN` | Facebook Page token |
| `SOCIALFLOW_LI_AUTHOR_URN` | LinkedIn author URN, such as `urn:li:person:…` |
| `SOCIALFLOW_LI_ACCESS_TOKEN` | LinkedIn token |

Webhook body for a successful payment:

```json
{
  "id": "evt_123",
  "type": "payment.succeeded",
  "userId": "USER_ID",
  "plan": "creator",
  "amount": 799,
  "currency": "PKR",
  "interval": "month"
}
```

Sign the raw body with hex HMAC-SHA256 and send it as `x-socialflow-signature`. The amount must match the list price or the event is rejected. `payment.failed` marks the latest unpaid request as failed and does not change the plan. Replay of the same `id` is ignored.

`GET /api/health` returns `{ "ok": true, "service": "socialflow" }`.

## Local development

```bash
npm install
npm run dev
```

The app listens on port 8080. Schema lives in `migrations/` and is applied on startup.

```bash
npm test
npm run typecheck
npm run build
```

## What is not live yet

- Instagram, Facebook Login, LinkedIn, and TikTok OAuth in the browser. Profiles are recorded as awaiting credentials. Do not scrape or automate a logged-in session.
- Instagram and TikTok publishing. Facebook and LinkedIn publish only when the server variables above are set, and only if the official API accepts the request.
- Video uploads and S3-style media hosting.
- Card payments inside Pakistan or elsewhere. The billing page creates an unpaid record. A provider you trust must call the webhook.
- Password-reset email. The reset page explains that mail is not configured.

## Repository

Source: [github.com/bia-studio18/SocialFlow](https://github.com/bia-studio18/SocialFlow)

```bash
git clone https://github.com/bia-studio18/SocialFlow.git
cd SocialFlow
npm install
npm run dev
```

