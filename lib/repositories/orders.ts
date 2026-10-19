import { randomBytes, randomUUID } from "node:crypto";
import { sqlClient } from "@/lib/db/client";
import { endOfTodayUtc, startOfTodayUtc } from "@/lib/domain/slots";
import type {
  OrderLineRecord,
  OrderRecord,
  OrderStatus,
  QuoteLine
} from "@/lib/types";

const PAYMENT_WINDOW_MINUTES = 5;

const globalForOrders = globalThis as unknown as {
  bentoMemoryOrders?: Map<string, OrderRecord>;
};

function memoryOrders(): Map<string, OrderRecord> {
  return (globalForOrders.bentoMemoryOrders ??= new Map());
}

export interface CreateOrderInput {
  pickupAt: Date;
  customerName: string;
  customerEmail: string;
  boxItemId: string;
  boxName: string;
  boxCapacity: number;
  subtotalCents: number;
  totalCents: number;
  currency: string;
  idempotencyKey: string;
  allergenAcknowledged: boolean;
  lines: QuoteLine[];
  slotCapacity: number;
}

export async function createOrderWithSlot(input: CreateOrderInput): Promise<OrderRecord | null> {
  const existing = await findOrderByIdempotencyKey(input.idempotencyKey);
  if (existing) return existing;

  if (!sqlClient) {
    return createMemoryOrder(input);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = randomUUID();
    const publicToken = randomToken();
    const orderCode = newOrderCode();
    try {
      const result = await sqlClient.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(hashtext(${`bento-slot:${input.pickupAt.toISOString()}`}))`;
        const [countRow] = await tx<Array<{ count: number }>>`
          select count(*)::int as count
          from orders
          where pickup_at = ${input.pickupAt}
            and status in ('PENDING_PAYMENT', 'PAID', 'READY')
            and (status <> 'PENDING_PAYMENT' or payment_expires_at > now())
        `;
        if (Number(countRow?.count ?? 0) >= input.slotCapacity) {
          return null;
        }

        const [orderRow] = await tx<Array<Record<string, unknown>>>`
          insert into orders (
            id, public_token, order_code, status, pickup_at, customer_name, customer_email,
            box_item_id, box_name, box_capacity, subtotal_cents, total_cents, currency,
            idempotency_key, allergen_acknowledged, payment_expires_at, created_at, updated_at
          ) values (
            ${id}, ${publicToken}, ${orderCode}, 'PENDING_PAYMENT', ${input.pickupAt},
            ${input.customerName}, ${input.customerEmail}, ${input.boxItemId}, ${input.boxName},
            ${input.boxCapacity}, ${input.subtotalCents}, ${input.totalCents}, ${input.currency},
            ${input.idempotencyKey}, ${input.allergenAcknowledged},
            now() + interval '5 minutes', now(), now()
          )
          returning *
        `;

        for (const line of input.lines) {
          await tx`
            insert into order_lines (
              id, order_id, catalog_item_id, name, section, unit_price_cents, quantity, line_total_cents
            ) values (
              ${randomUUID()}, ${id}, ${line.itemId}, ${line.name}, ${line.section},
              ${line.unitPriceCents}, ${line.quantity}, ${line.lineTotalCents}
            )
          `;
        }
        return orderRow;
      });

      if (!result) return null;
      return await getOrderById(String(result.id));
    } catch (error) {
      if (isUniqueViolation(error, "orders_idempotency_key_uq")) {
        const found = await findOrderByIdempotencyKey(input.idempotencyKey);
        if (found) return found;
      }
      if (!isUniqueViolation(error, "orders_order_code_uq")) {
        throw error;
      }
    }
  }

  throw new Error("Unable to allocate a unique daily order code.");
}

export async function getOrderByToken(token: string): Promise<OrderRecord | null> {
  if (!sqlClient) {
    return (
      [...memoryOrders().values()].find((order) => order.publicToken === token) ?? null
    );
  }
  const [row] = await sqlClient<Array<Record<string, unknown>>>`
    select * from orders where public_token = ${token} limit 1
  `;
  return row ? hydrateOrder(row) : null;
}

export async function getOrderById(id: string): Promise<OrderRecord | null> {
  if (!sqlClient) return memoryOrders().get(id) ?? null;
  const [row] = await sqlClient<Array<Record<string, unknown>>>`
    select * from orders where id = ${id} limit 1
  `;
  return row ? hydrateOrder(row) : null;
}

export async function getOrderBySquareOrderId(squareOrderId: string): Promise<OrderRecord | null> {
  if (!sqlClient) {
    return (
      [...memoryOrders().values()].find((order) => order.squareOrderId === squareOrderId) ?? null
    );
  }
  const [row] = await sqlClient<Array<Record<string, unknown>>>`
    select * from orders where square_order_id = ${squareOrderId} limit 1
  `;
  return row ? hydrateOrder(row) : null;
}

export async function getOrderBySquarePaymentId(squarePaymentId: string): Promise<OrderRecord | null> {
  if (!sqlClient) {
    return (
      [...memoryOrders().values()].find((order) => order.squarePaymentId === squarePaymentId) ?? null
    );
  }
  const [row] = await sqlClient<Array<Record<string, unknown>>>`
    select * from orders where square_payment_id = ${squarePaymentId} limit 1
  `;
  return row ? hydrateOrder(row) : null;
}

export async function findOrderByIdempotencyKey(key: string): Promise<OrderRecord | null> {
  if (!sqlClient) {
    return (
      [...memoryOrders().values()].find((order) => order.idempotencyKey === key) ?? null
    );
  }
  const [row] = await sqlClient<Array<Record<string, unknown>>>`
    select * from orders where idempotency_key = ${key} limit 1
  `;
  return row ? hydrateOrder(row) : null;
}

export async function listOrdersForToday(timezone: string): Promise<OrderRecord[]> {
  const from = startOfTodayUtc(timezone);
  const to = endOfTodayUtc(timezone);
  if (!sqlClient) {
    return [...memoryOrders().values()]
      .filter((order) => new Date(order.pickupAt) >= from && new Date(order.pickupAt) <= to)
      .sort((a, b) => a.pickupAt.localeCompare(b.pickupAt));
  }
  const rows = await sqlClient<Array<Record<string, unknown>>>`
    select * from orders
    where pickup_at between ${from} and ${to}
    order by pickup_at asc
  `;
  return Promise.all(rows.map((row) => hydrateOrder(row)));
}

export async function countBookingsBySlot(timezone: string): Promise<Map<string, number>> {
  const from = startOfTodayUtc(timezone);
  const to = endOfTodayUtc(timezone);
  if (!sqlClient) {
    const counts = new Map<string, number>();
    for (const order of memoryOrders().values()) {
      if (order.status === "PENDING_PAYMENT" && order.paymentExpiresAt && new Date(order.paymentExpiresAt) <= new Date()) {
        continue;
      }
      if (!["PENDING_PAYMENT", "PAID", "READY"].includes(order.status)) continue;
      const at = new Date(order.pickupAt);
      if (at < from || at > to) continue;
      const key = at.toISOString();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }
  const rows = await sqlClient<Array<{ pickup_at: Date; count: number }>>`
    select pickup_at, count(*)::int as count
    from orders
    where pickup_at between ${from} and ${to}
      and status in ('PENDING_PAYMENT', 'PAID', 'READY')
      and (status <> 'PENDING_PAYMENT' or payment_expires_at > now())
    group by pickup_at
  `;
  return new Map(rows.map((row) => [new Date(row.pickup_at).toISOString(), Number(row.count)]));
}

export async function attachSquareOrder(
  orderId: string,
  squareOrderId: string,
  totalCents?: number
): Promise<void> {
  if (!sqlClient) {
    const order = memoryOrders().get(orderId);
    if (order) {
      order.squareOrderId = squareOrderId;
      if (typeof totalCents === "number") order.totalCents = totalCents;
    }
    return;
  }
  await sqlClient`
    update orders
    set square_order_id = ${squareOrderId},
        total_cents = coalesce(${totalCents ?? null}, total_cents),
        updated_at = now()
    where id = ${orderId}
  `;
}

export async function markOrderPaid(
  orderId: string,
  squarePaymentId: string | null
): Promise<OrderRecord | null> {
  if (!sqlClient) {
    const order = memoryOrders().get(orderId);
    if (order && order.status !== "PAID" && ["PENDING_PAYMENT", "FAILED"].includes(order.status)) {
      order.status = "PAID";
      order.squarePaymentId = squarePaymentId;
      order.paidAt = new Date().toISOString();
      order.paymentExpiresAt = null;
      order.failureReason = null;
    }
    return order ?? null;
  }
  await sqlClient`
    update orders
    set status = 'PAID', square_payment_id = ${squarePaymentId}, paid_at = now(),
        payment_expires_at = null, failure_reason = null, updated_at = now()
    where id = ${orderId} and status in ('PENDING_PAYMENT', 'FAILED')
  `;
  return getOrderById(orderId);
}

export async function markOrderPaidBySquareId(
  squareOrderId: string,
  squarePaymentId: string | null
): Promise<OrderRecord | null> {
  const order = await getOrderBySquareOrderId(squareOrderId);
  if (!order) return null;
  return markOrderPaid(order.id, squarePaymentId);
}

export async function markOrderFailed(orderId: string, reason: string): Promise<void> {
  if (!sqlClient) {
    const order = memoryOrders().get(orderId);
    if (order?.status === "PENDING_PAYMENT") {
      order.status = "FAILED";
      order.failureReason = reason;
      order.paymentExpiresAt = null;
    }
    return;
  }
  await sqlClient`
    update orders
    set status = 'FAILED', failure_reason = ${reason}, payment_expires_at = null, updated_at = now()
    where id = ${orderId} and status = 'PENDING_PAYMENT'
  `;
}

export async function markOrderReady(orderId: string): Promise<OrderRecord | null> {
  if (!sqlClient) {
    const order = memoryOrders().get(orderId);
    if (order && ["PAID", "READY"].includes(order.status)) {
      order.status = "READY";
      order.readyAt ??= new Date().toISOString();
    }
    return order ?? null;
  }
  await sqlClient`
    update orders
    set status = 'READY', ready_at = coalesce(ready_at, now()), updated_at = now()
    where id = ${orderId} and status in ('PAID', 'READY')
  `;
  return getOrderById(orderId);
}

export async function markOrderPickedUp(orderId: string): Promise<OrderRecord | null> {
  if (!sqlClient) {
    const order = memoryOrders().get(orderId);
    if (order && ["READY", "PAID"].includes(order.status)) {
      order.status = "PICKED_UP";
      order.pickedUpAt = new Date().toISOString();
    }
    return order ?? null;
  }
  await sqlClient`
    update orders
    set status = 'PICKED_UP', picked_up_at = now(), updated_at = now()
    where id = ${orderId} and status in ('READY', 'PAID')
  `;
  return getOrderById(orderId);
}

export async function markOrderCanceled(orderId: string): Promise<void> {
  if (!sqlClient) {
    const order = memoryOrders().get(orderId);
    if (order && ["PENDING_PAYMENT", "PAID", "READY"].includes(order.status)) {
      order.status = "CANCELED";
      order.canceledAt = new Date().toISOString();
    }
    return;
  }
  await sqlClient`
    update orders
    set status = 'CANCELED', canceled_at = now(), updated_at = now()
    where id = ${orderId}
      and status in ('PENDING_PAYMENT', 'PAID', 'READY')
  `;
}

export async function markOrderRefunded(orderId: string): Promise<void> {
  if (!sqlClient) {
    const order = memoryOrders().get(orderId);
    if (order) order.status = "REFUNDED";
    return;
  }
  await sqlClient`
    update orders set status = 'REFUNDED', updated_at = now() where id = ${orderId}
  `;
}

export async function markReadyEmailSent(orderId: string): Promise<void> {
  if (!sqlClient) {
    const order = memoryOrders().get(orderId);
    if (order) order.readyEmailSentAt ??= new Date().toISOString();
    return;
  }
  await sqlClient`
    update orders
    set ready_email_sent_at = coalesce(ready_email_sent_at, now())
    where id = ${orderId}
  `;
}

export async function cleanupExpiredPendingOrders(): Promise<number> {
  if (!sqlClient) {
    let count = 0;
    for (const order of memoryOrders().values()) {
      if (
        order.status === "PENDING_PAYMENT" &&
        order.paymentExpiresAt &&
        new Date(order.paymentExpiresAt) <= new Date()
      ) {
        order.status = "FAILED";
        order.failureReason = "Payment window expired.";
        count += 1;
      }
    }
    return count;
  }
  const rows = await sqlClient<Array<{ id: string }>>`
    update orders
    set status = 'FAILED', failure_reason = 'Payment window expired.', payment_expires_at = null, updated_at = now()
    where status = 'PENDING_PAYMENT' and payment_expires_at <= now()
    returning id
  `;
  return rows.length;
}

function createMemoryOrder(input: CreateOrderInput): OrderRecord | null {
  const orders = memoryOrders();
  const activeAtSlot = [...orders.values()].filter(
    (order) =>
      order.pickupAt === input.pickupAt.toISOString() &&
      ["PENDING_PAYMENT", "PAID", "READY"].includes(order.status) &&
      (order.status !== "PENDING_PAYMENT" ||
        !order.paymentExpiresAt ||
        new Date(order.paymentExpiresAt) > new Date())
  ).length;
  if (activeAtSlot >= input.slotCapacity) return null;

  const id = randomUUID();
  const now = new Date();
  const lines: OrderLineRecord[] = input.lines.map((line) => ({
    id: randomUUID(),
    catalogItemId: line.itemId,
    name: line.name,
    section: line.section,
    unitPriceCents: line.unitPriceCents,
    quantity: line.quantity,
    lineTotalCents: line.lineTotalCents
  }));
  const order: OrderRecord = {
    id,
    publicToken: randomToken(),
    orderCode: newOrderCode(),
    status: "PENDING_PAYMENT",
    pickupAt: input.pickupAt.toISOString(),
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    boxItemId: input.boxItemId,
    boxName: input.boxName,
    boxCapacity: input.boxCapacity,
    subtotalCents: input.subtotalCents,
    totalCents: input.totalCents,
    currency: input.currency,
    idempotencyKey: input.idempotencyKey,
    allergenAcknowledged: input.allergenAcknowledged,
    squareOrderId: null,
    squarePaymentId: null,
    paymentExpiresAt: new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000).toISOString(),
    createdAt: now.toISOString(),
    paidAt: null,
    readyAt: null,
    pickedUpAt: null,
    canceledAt: null,
    failureReason: null,
    readyEmailSentAt: null,
    lines
  };
  orders.set(id, order);
  return order;
}

async function hydrateOrder(row: Record<string, unknown>): Promise<OrderRecord> {
  const id = String(row.id);
  const lineRows = sqlClient
    ? await sqlClient<Array<Record<string, unknown>>>`
        select id, catalog_item_id, name, section, unit_price_cents, quantity, line_total_cents
        from order_lines where order_id = ${id} order by created_at asc
      `
    : [];
  const lines: OrderLineRecord[] = lineRows.map((line) => ({
    id: String(line.id),
    catalogItemId: String(line.catalog_item_id),
    name: String(line.name),
    section: String(line.section) as OrderLineRecord["section"],
    unitPriceCents: Number(line.unit_price_cents),
    quantity: Number(line.quantity),
    lineTotalCents: Number(line.line_total_cents)
  }));

  return {
    id,
    publicToken: String(row.public_token),
    orderCode: String(row.order_code),
    status: String(row.status) as OrderStatus,
    pickupAt: new Date(String(row.pickup_at)).toISOString(),
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    boxItemId: String(row.box_item_id),
    boxName: String(row.box_name),
    boxCapacity: Number(row.box_capacity),
    subtotalCents: Number(row.subtotal_cents),
    totalCents: Number(row.total_cents),
    currency: String(row.currency),
    idempotencyKey: String(row.idempotency_key),
    allergenAcknowledged: Boolean(row.allergen_acknowledged),
    squareOrderId: row.square_order_id ? String(row.square_order_id) : null,
    squarePaymentId: row.square_payment_id ? String(row.square_payment_id) : null,
    paymentExpiresAt: row.payment_expires_at
      ? new Date(String(row.payment_expires_at)).toISOString()
      : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    paidAt: row.paid_at ? new Date(String(row.paid_at)).toISOString() : null,
    readyAt: row.ready_at ? new Date(String(row.ready_at)).toISOString() : null,
    pickedUpAt: row.picked_up_at ? new Date(String(row.picked_up_at)).toISOString() : null,
    canceledAt: row.canceled_at ? new Date(String(row.canceled_at)).toISOString() : null,
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
    readyEmailSentAt: row.ready_email_sent_at
      ? new Date(String(row.ready_email_sent_at)).toISOString()
      : null,
    lines
  };
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

function newOrderCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = randomBytes(4);
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }
  return `B-${code}`;
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505" &&
    String((error as { constraint_name?: string }).constraint_name ?? "").includes(constraint)
  );
}
