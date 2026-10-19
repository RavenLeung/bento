# Gemeshi Bento Lab

A mobile-first DIY bento ordering app for pickup. Customers scan a QR code, choose a box, fill it with protein, vegetables, starch and optional sauces, pay with Square, and follow a live order status page. The same order is created in Square Orders so the kitchen can use Square Order Manager / KDS and the back office keeps one source of truth.

> This is an MVP reference implementation. Review the payment, authentication, privacy and deployment configuration before using it with real customers.

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the architecture, local setup, environment variables, business rules, testing, deployment and troubleshooting guide.

## What is included

- **Customer builder** — two free box sizes (Regular 6 dishes, Large 9 dishes), per-ingredient quantities, a separate two-sauce tray, capacity meter, dietary and allergen filters, Pick For Me, GST-inclusive pricing and a playful bento board.
- **Checkout** — same-day pickup slots with lead time and capacity, guest details, allergen acknowledgment, Square Web Payments SDK card tokenization and server-side quote revalidation.
- **Order tracking** — private tokenized status page that polls for payment, cooking, ready and collected states. Ready notification is sent by email.
- **Staff fallback** — OTP access for allowlisted emails, today's queue, Ready / Picked up actions, pause orders, and editable prep lead / slot gap / slot capacity / opening hours.
- **Square integration** — Catalog is the source of truth for menu items, prices, descriptions, sold-out state, dietary tags and allergens; paid orders create Square orders; Ready and Picked up update Square fulfillment state.
- **Reliability** — signed quotes, signed staff sessions, database slot locking, idempotent checkout, webhook event deduplication, an outbox for email/catalog jobs, and a cron recovery endpoint.
- **Demo mode** — works without Square, PostgreSQL or Resend. Orders live in process memory and staff access is bypassed for local demos.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js 16 App Router, React 19, TypeScript | One deployable app for the customer UI, APIs, staff screen and webhooks. |
| Styling | Tailwind CSS 3 | Fast, mobile-first visual iteration without a heavy component framework. |
| Database | PostgreSQL (Neon or compatible) via `postgres.js` | Serverless-friendly Postgres, row transactions and advisory locks for slot capacity. |
| ORM/types | Drizzle schema | Typed table definitions; SQL migrations are applied by the included runner. |
| Payments / POS | Square Web Payments SDK + Orders API | Card tokenization in the browser, server-side payment, Orders in Square, KDS-compatible fulfillments. |
| Email | Resend | Transactional confirmation and ready-to-collect messages. |
| Hosting | Vercel + Vercel Cron (or another Node.js host) | Simple Next.js deployment; cron drains the outbox and retries webhook work. |
| Tests | Vitest + Playwright | 54 unit tests plus 15 end-to-end customer, drag-drop and staff scenarios. |

## Local demo

```bash
npm install
cp .env.example .env.local
# Leave DATABASE_URL, Square and Resend blank. Keep DEMO_MODE=true.
npm run dev
```

Open `http://localhost:3000`. The demo catalog is used, checkout creates a paid in-memory order, email sending is logged to the terminal, and `/staff` is available without an OTP. The Playwright flow uses the same demo.

Useful checks:

```bash
npm run typecheck
npm test
npm run test:e2e
```

## Customer flow

1. `GET /api/menu` returns the mapped Square catalog (or demo/cached catalog).
2. The browser posts the box and quantities to `POST /api/quote`; the server validates minimums, capacity, sold-out items and current prices, then returns a signed five-minute quote.
3. Checkout refreshes pickup availability, re-runs the quote against current Square data, creates a `PENDING_PAYMENT` order inside a Postgres transaction that locks the pickup slot, creates a Square order, charges the Square payment token, then marks the order `PAID`.
4. A confirmation email job is queued. The customer is redirected to `/order/<private-token>`.
5. Staff mark the order Ready. This sets the Square pickup fulfillment to `PREPARED`, updates the local order, and queues one Ready email.
6. Staff mark it Picked up. This sets the Square fulfillment and order to `COMPLETED`.

The Square webhook state machine also accepts KDS-driven `PREPARED` / `COMPLETED` fulfillment updates, so the staff screen is a fallback rather than the only way to complete an order.

## Square setup

The app needs a Square application with Orders, Payments and Catalog access, plus a Square location. Use sandbox first.

1. In the Square Developer Dashboard, create/open the application and copy:
   - Access token → `SQUARE_ACCESS_TOKEN`
   - Location ID → `SQUARE_LOCATION_ID`
   - Application ID → `SQUARE_APPLICATION_ID`
   - Set `SQUARE_ENV=sandbox` or `production`.
2. Add the Square credentials to `.env.local`.
3. Create the catalog categories and custom attributes:

```bash
npm run square:bootstrap
```

This idempotently creates five categories (Bento Boxes, Proteins, Vegetables, Starches, Sauces) and these item-level custom attributes:

| Key | Type | Purpose |
| --- | --- | --- |
| `builder_order` | Number | Sort order inside a builder section. |
| `portion_capacity` | Number | Box capacity. Regular = 6, Large = 9. |
| `dietary_tags` | Selection | Values should include `vegetarian`, `vegan`, `gluten-free`, `high-protein`. |
| `allergens` | Selection | Values should include `fish`, `shellfish`, `egg`, `milk`, `soy`, `sesame`, `gluten`, `nuts`. |

Copy the printed category IDs into:

```dotenv
SQUARE_CATEGORY_BOX_ID=...
SQUARE_CATEGORY_PROTEIN_ID=...
SQUARE_CATEGORY_VEGETABLE_ID=...
SQUARE_CATEGORY_STARCH_ID=...
SQUARE_CATEGORY_SAUCE_ID=...
```

4. In Square Dashboard, create the menu items inside those categories. Recommendations:
   - Box items: price `$0`, set `portion_capacity` to 6 or 9, and set `builder_order`.
   - Ingredients: set the GST-inclusive price, description, sold-out state, dietary tags and allergens.
   - Sauces: place curry and sauce items in the Sauces category. They do not count against the box capacity, and customers may add up to two portions.
   - Keep item variations only where the customer should see a separate choice. Multiple variations become separate builder cards.
   - Use the Square sold-out toggle; the app reads `location_overrides[].sold_out`.

Catalog images are rendered with `next/image`. Set `MENU_IMAGE_HOSTS` to a comma-separated list of HTTPS hostnames that serve your images (wildcards such as `**.example.com` are supported). Leave it blank to use the demo host plus Square CDN defaults.
5. Run the verification:

```bash
npm run square:check
```

6. Configure webhooks for the exact public URL:

```text
https://YOUR-DOMAIN/api/square/webhooks
```

Subscribe to `order.updated`, `order.fulfillment.updated`, `payment.updated`, `refund.updated`, and `catalog.version.updated`. Put the signing key in `SQUARE_WEBHOOK_SIGNATURE_KEY`. The signature is verified against the exact notification URL plus the raw request body.

### KDS / Square for Restaurants

Square for Restaurants Plus (or the appropriate Square plan with KDS) is an MVP launch prerequisite. Confirm that Orders API pickup orders appear in Order Manager and KDS for the location, and that completing the fulfillment in KDS emits `order.fulfillment.updated` with `PREPARED` or `COMPLETED`.

The built-in staff page still works as a fallback if KDS is unavailable. If Square cannot be updated from the staff page, the local order and Ready email still complete and the screen shows a warning to reconcile the Square order manually.

## Vercel showcase deployment

Use showcase mode for a public, interactive menu demo without a database, Square account or email provider.

1. Import the repository into Vercel and set the production branch to `main`.
2. Add `SHOWCASE_MODE=true` and set `NEXT_PUBLIC_APP_URL` to the final HTTPS Vercel origin.
3. Keep the store name, address, timezone and currency variables from `.env.example`. Do not set `DEMO_MODE`, `DATABASE_URL`, Square, Resend, staff or cron credentials.
4. Deploy and open `/api/health`. It should return `ok: true`, `showcaseMode: true` and an empty `missingConfig` array.

Showcase mode uses the committed demo catalog and keeps the full builder, filters, drag and drop, Pick For Me and pricing interactions. Checkout, staff routes and staff APIs are disabled. `vercel.json` intentionally has no cron schedule because the demo has no background jobs; Vercel Hobby also rejects schedules more frequent than once per day.

## Full production deployment

1. Create a PostgreSQL database (Neon or a compatible provider) in a region close to the store.
2. Set `DATABASE_URL` (include `?sslmode=require`) and run:

```bash
npm run db:migrate
```

The runner records applied files in `schema_migrations`, so it is safe to run on every deploy. The initial migration creates orders, order lines, catalog cache, settings, webhook events, outbox jobs and staff OTP tables.
3. Create a Resend account, verify the sending domain, and set `RESEND_API_KEY` and `EMAIL_FROM`.
4. Set a long random `AUTH_SECRET` (32+ bytes), the comma-separated `STAFF_EMAILS` allowlist, and a random `CRON_SECRET`.
5. Deploy to Vercel and set every value from `.env.example` in the project environment. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS origin and set `DEMO_MODE=false`.
   On server start, `instrumentation.ts` rejects production deployments that are missing the app URL, database, auth secret, staff allowlist, Square credentials or webhook key, Resend, or cron secret. This prevents a production instance from silently falling back to demo mode or in-memory orders.
6. Restore the `/api/cron/process-outbox` schedule in `vercel.json`. The endpoint needs minute-level recovery, so use a Vercel Pro plan or an external scheduler. The endpoint requires `Authorization: Bearer $CRON_SECRET`.
7. Add the deployed webhook URL and signing key in Square, then run a sandbox card payment and verify:
   - the order appears in Square Order Manager / KDS;
   - confirmation and Ready emails arrive;
   - marking Ready in KDS updates the customer tracker;
   - marking Picked up in the app completes the Square order.

## Operations

- **Pause orders:** `/staff` → Pause orders. The menu remains visible but checkout is blocked.
- **Service capacity:** `/staff` → Settings. Prep lead, slot gap, orders per slot and opening hours are stored in Postgres.
- **Catalog changes:** Square remains authoritative. Catalog webhooks queue a cache refresh; sold-out state is checked again at checkout.
- **Private links:** a customer order token is a bearer key. Do not log or share it publicly.
- **GST:** prices are treated as GST-inclusive. Square item prices must be configured accordingly. The customer UI states “GST included”.
- **Allergens:** the UI shows item allergens and requires acknowledgment. The kitchen must keep item allergen metadata current in Square.

## Known MVP limits

- Single store, same-day pickup, English and AUD only.
- No customer accounts, SMS, delivery, loyalty, multi-store UI or customer-initiated refunds.
- Abandoned card payments are marked failed by the cleanup job; there is no custom refund workflow.
- With `DATABASE_URL` blank, demo orders are in memory and are not shared across serverless instances. A preview deployment can use PostgreSQL to persist demo orders.
- Demo mode is only auto-enabled outside production. `DEMO_MODE=true` bypasses staff authentication, so production startup validation rejects it.

## Project map

```text
app/                    Customer, order tracker, staff UI and API routes
components/             Builder, checkout, payment, tracker and staff screens
lib/domain/             Quote validation and pickup slot rules
lib/repositories/       Atomic order persistence and slot counting
lib/services/           Checkout, availability and staff actions
lib/square/             Catalog mapping, Orders/Payments client and setup tools
lib/db/migrations/      Forward-only SQL migrations
scripts/                Migration, Square bootstrap and verification commands
tests/                  Vitest domain and demo checkout tests
e2e/                    Playwright demo order flow
```

## Demo content and trademarks

The `Gemeshi Bento Lab` name, sample store details, menu copy, `demo-data/` CSV and externally hosted demo images are included so the demo is usable out of the box. They are example content and are not licensed under the MIT License. The license does not grant trademark, brand or third-party image rights. Replace them with assets you own before a public production deployment.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report vulnerabilities privately according to [SECURITY.md](SECURITY.md), and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Released under the [MIT License](LICENSE).
