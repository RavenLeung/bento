## Summary

Describe the problem and the change in a few sentences.

## Testing

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build -- --webpack`
- [ ] `npm run test:e2e` (when relevant and the environment supports Chromium)

## Checklist

- [ ] No secrets, `.env.local`, customer data or private order tokens are included.
- [ ] Tests cover the changed behavior.
- [ ] Documentation and `.env.example` are updated when setup or configuration changes.
- [ ] Database changes use a new append-only migration.
