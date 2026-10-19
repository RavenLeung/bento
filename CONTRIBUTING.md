# Contributing

Thanks for taking the time to contribute. This project is an MVP reference implementation, so focused bug fixes, documentation improvements and small, well-tested features are especially welcome.

## Before you start

- Open an issue before starting a large feature or refactor so the approach can be discussed first.
- Do not report security vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md).
- By submitting a contribution, you agree that it is licensed under the project's [MIT License](LICENSE).

## Development setup

Requirements: Node.js 24+ and npm 11+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Leave `DATABASE_URL`, Square and Resend blank to run the in-memory demo. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the full architecture and environment variable reference.

## Checks

Run the checks that match your change before opening a pull request:

```bash
npm run typecheck
npm test
npm run build -- --webpack
```

For UI or checkout changes, also run the Playwright suite when your environment has the Chromium system dependencies:

```bash
npx playwright install chromium
npm run test:e2e
```

## Pull requests

- Keep each pull request focused on one problem.
- Add or update tests for behavior changes.
- Update the README or development guide when setup, configuration or behavior changes.
- Do not commit `.env.local`, `.vercel/`, credentials, customer data or private order tokens.
- Database migrations are append-only. Add a new file instead of editing a migration that may already have run.
- Describe how you tested the change and list any checks you could not run.

## Code style

- Follow the existing TypeScript and React patterns in the repository.
- Keep customer-facing UI on the fixed light palette: red `#C62020`, white `#FFFFFF` and black `#141414`.
- Server-side money values are integer cents; timestamps are stored in UTC and rendered in the store timezone with Luxon.
- Read `AGENTS.md` before changing Next.js APIs or conventions. This project uses Next.js 16.

## Reporting bugs

Use the bug report template and include reproduction steps, the expected result, the actual result, and relevant logs with secrets removed.
