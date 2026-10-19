import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey(),
    publicToken: text("public_token").notNull(),
    orderCode: text("order_code").notNull(),
    status: text("status").notNull().default("PENDING_PAYMENT"),
    pickupAt: timestamp("pickup_at", { withTimezone: true }).notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    boxItemId: text("box_item_id").notNull(),
    boxName: text("box_name").notNull(),
    boxCapacity: integer("box_capacity").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").notNull().default("AUD"),
    idempotencyKey: text("idempotency_key").notNull(),
    allergenAcknowledged: boolean("allergen_acknowledged").notNull().default(false),
    squareOrderId: text("square_order_id"),
    squarePaymentId: text("square_payment_id"),
    paymentExpiresAt: timestamp("payment_expires_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    readyEmailSentAt: timestamp("ready_email_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("orders_public_token_uq").on(table.publicToken),
    uniqueIndex("orders_order_code_uq").on(table.orderCode),
    uniqueIndex("orders_idempotency_key_uq").on(table.idempotencyKey),
    index("orders_square_order_id_idx").on(table.squareOrderId),
    index("orders_pickup_at_status_idx").on(table.pickupAt, table.status)
  ]
);

export const orderLines = pgTable(
  "order_lines",
  {
    id: uuid("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    catalogItemId: text("catalog_item_id").notNull(),
    name: text("name").notNull(),
    section: text("section").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("order_lines_order_id_idx").on(table.orderId)]
);

export const catalogItems = pgTable(
  "catalog_items",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    section: text("section").notNull(),
    categoryId: text("category_id").notNull(),
    priceCents: integer("price_cents").notNull(),
    capacity: integer("capacity"),
    soldOut: boolean("sold_out").notNull().default(false),
    dietaryTags: jsonb("dietary_tags").$type<string[]>().notNull().default([]),
    allergens: jsonb("allergens").$type<string[]>().notNull().default([]),
    displayOrder: integer("display_order").notNull().default(0),
    imageUrl: text("image_url"),
    emoji: text("emoji").notNull().default("🍱"),
    color: text("color").notNull().default("#f4c95d"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("catalog_items_section_idx").on(table.section, table.displayOrder)]
);

export const catalogSync = pgTable("catalog_sync", {
  id: text("id").primaryKey(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  itemCount: integer("item_count").notNull().default(0)
});

export const settings = pgTable("settings", {
  id: text("id").primaryKey().default("default"),
  acceptingOrders: boolean("accepting_orders").notNull().default(true),
  prepLeadMinutes: integer("prep_lead_minutes").notNull().default(12),
  slotMinutes: integer("slot_minutes").notNull().default(10),
  slotCapacity: integer("slot_capacity").notNull().default(6),
  openTime: text("open_time").notNull().default("10:00"),
  closeTime: text("close_time").notNull().default("20:00"),
  timezone: text("timezone").notNull().default("Australia/Sydney"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const webhookEvents = pgTable(
  "webhook_events",
  {
    eventId: text("event_id").primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true })
  },
  (table) => [index("webhook_events_status_idx").on(table.status, table.receivedAt)]
);

export const outboxJobs = pgTable(
  "outbox_jobs",
  {
    id: uuid("id").primaryKey(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("outbox_jobs_status_run_at_idx").on(table.status, table.runAt)]
);

export const staffOtps = pgTable(
  "staff_otps",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("staff_otps_email_idx").on(table.email, table.createdAt)]
);
