# Security Policy

## Supported versions

Security fixes are applied to the latest commit on the `main` branch. Forks and older deployments are responsible for their own updates.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Use GitHub's private vulnerability reporting from the repository's **Security** tab (**Report a vulnerability**). If that channel is unavailable, open a minimal issue asking the maintainers for a private contact channel, but do not include vulnerability details in the public issue. In the private report, include:

- the affected route, component or commit;
- reproduction steps or a proof of concept;
- the impact you believe is possible;
- any suggested mitigation.

Do not include live card data, customer personal information, private order tokens, API keys or `.env.local` contents in a report.

## Security-sensitive areas

This application handles payments, staff authentication, customer contact details and private order links. Changes touching any of the following deserve extra review:

- Square payment and webhook handling;
- quote and staff-session signing;
- order lookup tokens;
- staff email allowlists and one-time codes;
- database access and slot locking;
- email templates and outbox retries.

## Secret handling

Never commit `.env.local`, `.vercel/` or real credentials. If a secret is exposed, rotate it with the provider first, then remove it from the repository history. Removing a value from the latest commit alone does not revoke it.
