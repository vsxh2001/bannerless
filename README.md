# Bannerless

A small web app to run a weekly training group: track **attendance** for each
session, collect the **50₪ monthly subscription**, and message members over
**WhatsApp**. Admins get a dashboard; members get a personal view to RSVP and
pay their dues.

## Stack

- **Next.js 16** (App Router) + Tailwind CSS
- **SQLite** via **Drizzle ORM** (`better-sqlite3`)
- **Auth.js (NextAuth v5)** — passwordless email magic links (Resend)
- **Stripe** Checkout for online dues + webhook reconciliation
- **Meta WhatsApp Cloud API** for reminders, RSVP buttons and payment nudges

## Quick start (local)

```bash
npm install
cp .env.example .env.local      # then fill in values (see below)
npx auth secret                 # writes AUTH_SECRET into .env.local
npm run db:migrate              # create the SQLite schema
npm run db:seed                 # seed the first admin (ADMIN_EMAIL)
npm run dev                     # http://localhost:3000
```

Sign in at `/login` with the admin email. **Without a Resend API key, the
magic-link URL is printed to the dev server console** — open it to log in.

## Roles & flow

- The **first admin** is whoever you set as `ADMIN_EMAIL` (seeded once).
- The app is a **closed group**: only emails that exist as members can sign in.
  Admins add members under **Admin → Members**; each member can then request a
  magic link.
- **Sessions**: admins schedule sessions (one-off or "generate weekly"), members
  RSVP from **My sessions**, and admins mark who actually attended.
- **Payments**: admins "generate dues" for a month (one 50₪ row per active
  member). Members pay online via Stripe, or admins mark cash/Bit payments paid
  manually.

## Environment variables

See `.env.example`. Summary:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file path (default `./data/app.db`) |
| `AUTH_SECRET` | Auth.js session encryption (`npx auth secret`) |
| `AUTH_URL`, `NEXT_PUBLIC_BASE_URL` | Public app URL (auth + Stripe redirects) |
| `ADMIN_EMAIL` | Email seeded as the first admin |
| `AUTH_RESEND_KEY`, `EMAIL_FROM` | Resend key + verified sender for magic links |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe API + webhook signing |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN` | Meta WhatsApp Cloud API |

## External setup

### Resend (magic-link email)
1. Create a [Resend](https://resend.com) account and an API key → `AUTH_RESEND_KEY`.
2. Verify a sending domain (or use `onboarding@resend.dev` for testing) → `EMAIL_FROM`.
3. Leave the key empty in development to print links to the console instead.

### Stripe (online dues)
1. Create a [Stripe](https://stripe.com) account; copy the secret key → `STRIPE_SECRET_KEY`.
2. Locally, forward webhooks and copy the signing secret it prints → `STRIPE_WEBHOOK_SECRET`:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
3. In production, add a webhook endpoint pointing to
   `https://<your-domain>/api/webhooks/stripe` for the `checkout.session.completed` event.

### Meta WhatsApp Cloud API
1. In [Meta for Developers](https://developers.facebook.com), create an app with the
   **WhatsApp** product. Note the **Phone Number ID** and a **token**, and your
   **WhatsApp Business Account ID**.
2. Set a **verify token** of your choosing → `WHATSAPP_VERIFY_TOKEN`, and configure
   the webhook URL `https://<your-domain>/api/webhooks/whatsapp` subscribed to
   `messages`.
3. **Constraints to know:**
   - The Cloud API sends **1:1 messages to individual numbers — not WhatsApp
     groups.** Each member needs a phone number on their profile.
   - Free-form text and interactive (RSVP button) messages only deliver inside
     the **24-hour customer-service window** (after the member messages your
     number). For proactive, business-initiated sends outside that window you
     must use an **approved message template**.
   - Members must have opted in to receive messages.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript checks |
| `npm test` | Vitest unit tests |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed the first admin |

## Deployment

SQLite needs a **persistent filesystem** and the app must stay running to receive
webhooks, so deploy to a host with a volume — **Fly.io / Railway / Render**. (For a
fully managed DB later, swap the driver for **Turso/libSQL**.) Vercel's ephemeral
serverless filesystem is not suitable for the SQLite file.

## Deploy to Fly.io

This repo ships a multi-stage `Dockerfile`, a `docker-entrypoint.sh`, and a
`fly.toml` configured for a long-running Node server with a persistent volume.
The build uses `output: "standalone"` (see `next.config.ts`) for a slim image,
and **migrations run at container start** in the entrypoint (not a Fly
`release_command`, since release machines don't mount the app volume).

1. **Install** the [Fly CLI](https://fly.io/docs/flyctl/install/) and `fly auth login`.
2. **Create the app** (edit `app`/`primary_region` in `fly.toml` first, or let
   `launch` set them). The bundled `fly.toml` is used as-is:
   ```bash
   fly launch --no-deploy
   ```
3. **Create the volume** (mounted at `/data`, holds `app.db`):
   ```bash
   fly volumes create data --size 1
   ```
4. **Set secrets + public config** (replace `<app>` and the values):
   ```bash
   fly secrets set \
     AUTH_SECRET=...                       # npx auth secret / openssl rand -base64 32
     STRIPE_SECRET_KEY=... \
     STRIPE_WEBHOOK_SECRET=... \
     AUTH_RESEND_KEY=... \
     EMAIL_FROM="Bannerless <onboarding@resend.dev>" \
     WHATSAPP_TOKEN=... \
     WHATSAPP_PHONE_NUMBER_ID=... \
     WHATSAPP_BUSINESS_ACCOUNT_ID=... \
     WHATSAPP_VERIFY_TOKEN=... \
     AUTH_URL=https://<app>.fly.dev \
     NEXT_PUBLIC_BASE_URL=https://<app>.fly.dev \
     ADMIN_EMAIL=you@example.com
   ```
   `DATABASE_URL=/data/app.db` is already set via `fly.toml` `[env]`.
5. **Deploy.** Migrations apply automatically on boot via the entrypoint:
   ```bash
   fly deploy
   ```
6. **First admin — no manual step needed.** The entrypoint runs migrations and
   then idempotently creates (or promotes) the user in the `ADMIN_EMAIL` secret
   as an admin on every boot. Since you set `ADMIN_EMAIL` in step 4, that account
   is ready to sign in right after `fly deploy`.

Update the Stripe webhook endpoint to
`https://<app>.fly.dev/api/webhooks/stripe` and the WhatsApp webhook to
`https://<app>.fly.dev/api/webhooks/whatsapp` (see **External setup** above).
