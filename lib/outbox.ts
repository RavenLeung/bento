import { randomUUID } from "node:crypto";
import { sqlClient } from "@/lib/db/client";
import { parseJsonColumn } from "@/lib/db/json";
import { getOrderById } from "@/lib/repositories/orders";
import { sendConfirmation, sendReadyIfNeeded } from "@/lib/email/order-emails";
import { refreshCatalogCache } from "@/lib/catalog";

const MAX_ATTEMPTS = 5;

interface OutboxJobRow {
  id: string;
  kind: string;
  payload: unknown;
  attempts: number | null;
}

export async function enqueueOutbox(
  kind: string,
  payload: Record<string, unknown>,
  runAt = new Date()
): Promise<void> {
  if (!sqlClient) return;
  await sqlClient`
    insert into outbox_jobs (id, kind, payload, status, attempts, run_at, created_at, updated_at)
    values (${randomUUID()}, ${kind}, ${JSON.stringify(payload)}::jsonb, 'pending', 0, ${runAt}, now(), now())
    on conflict do nothing
  `;
}

export async function processOutbox(limit = 20): Promise<{ processed: number; failed: number }> {
  if (!sqlClient) return { processed: 0, failed: 0 };

  await sqlClient`
    update outbox_jobs
    set status = 'pending', updated_at = now(), run_at = now()
    where status = 'processing' and updated_at < now() - interval '10 minutes'
  `;

  const jobs = await sqlClient.begin(async (tx) => {
    const rows = await tx<OutboxJobRow[]>`
      select * from outbox_jobs
      where status = 'pending' and run_at <= now()
      order by run_at asc
      limit ${limit}
      for update skip locked
    `;
    for (const row of rows) {
      await tx`update outbox_jobs set status = 'processing', updated_at = now() where id = ${row.id}`;
    }
    return rows;
  });

  let processed = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      await processJob(
        String(job.kind),
        parseJsonColumn<Record<string, unknown>>(job.payload, {})
      );
      await sqlClient`
        update outbox_jobs set status = 'done', updated_at = now() where id = ${job.id}
      `;
      processed += 1;
    } catch (error) {
      failed += 1;
      const attempts = Number(job.attempts ?? 0) + 1;
      const terminal = attempts >= MAX_ATTEMPTS;
      const backoffSeconds = Math.min(300, 15 * 2 ** attempts);
      await sqlClient`
        update outbox_jobs
        set status = ${terminal ? "failed" : "pending"},
            attempts = ${attempts},
            last_error = ${error instanceof Error ? error.message : String(error)},
            run_at = now() + (${backoffSeconds} || ' seconds')::interval,
            updated_at = now()
        where id = ${job.id}
      `;
      console.error("Outbox job failed", job.kind, job.id, error);
    }
  }
  return { processed, failed };
}

async function processJob(kind: string, payload: Record<string, unknown>): Promise<void> {
  const orderId = typeof payload.orderId === "string" ? payload.orderId : null;
  if (kind === "email.confirmation") {
    if (!orderId) throw new Error("Missing orderId");
    const order = await getOrderById(orderId);
    if (!order) throw new Error("Order not found");
    await sendConfirmation(order);
    return;
  }
  if (kind === "email.ready") {
    if (!orderId) throw new Error("Missing orderId");
    const order = await getOrderById(orderId);
    if (!order) throw new Error("Order not found");
    await sendReadyIfNeeded(order);
    return;
  }
  if (kind === "catalog.refresh") {
    await refreshCatalogCache();
    return;
  }
  throw new Error(`Unknown outbox job kind: ${kind}`);
}
