-- Prevent duplicate customer emails when both checkout and a Square webhook
-- observe the same payment transition.
create unique index if not exists outbox_jobs_email_confirmation_uq
  on outbox_jobs (kind, (payload->>'orderId'))
  where kind = 'email.confirmation';

create unique index if not exists outbox_jobs_email_ready_uq
  on outbox_jobs (kind, (payload->>'orderId'))
  where kind = 'email.ready';
