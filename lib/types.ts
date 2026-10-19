export type BentoSection = "box" | "protein" | "vegetable" | "starch" | "sauce";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "READY"
  | "PICKED_UP"
  | "CANCELED"
  | "REFUNDED"
  | "FAILED";

export interface CatalogItem {
  id: string;
  itemId: string;
  name: string;
  description: string;
  section: BentoSection;
  categoryId: string;
  priceCents: number;
  capacity: number | null;
  soldOut: boolean;
  dietaryTags: string[];
  allergens: string[];
  displayOrder: number;
  imageUrl: string | null;
  emoji: string;
  color: string;
}

export interface CatalogSnapshot {
  items: CatalogItem[];
  source: "square" | "cache" | "demo";
  syncedAt: string;
}

export interface QuoteSelection {
  itemId: string;
  quantity: number;
}

export interface QuoteLine {
  itemId: string;
  name: string;
  section: Exclude<BentoSection, "box">;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  dietaryTags: string[];
  allergens: string[];
}

export interface QuoteDraft {
  boxItemId: string;
  boxName: string;
  boxCapacity: number;
  selections: QuoteSelection[];
  lines: QuoteLine[];
  totalCents: number;
  currency: string;
  totalPortions: number;
}

export interface Quote extends QuoteDraft {
  quoteToken: string;
  expiresAt: string;
}

export interface PickupSlot {
  at: string;
  label: string;
  capacity: number;
  booked: number;
  remaining: number;
}

export interface OrderLineRecord {
  id: string;
  catalogItemId: string;
  name: string;
  section: Exclude<BentoSection, "box">;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface OrderRecord {
  id: string;
  publicToken: string;
  orderCode: string;
  status: OrderStatus;
  pickupAt: string;
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
  squareOrderId: string | null;
  squarePaymentId: string | null;
  paymentExpiresAt: string | null;
  createdAt: string;
  paidAt: string | null;
  readyAt: string | null;
  pickedUpAt: string | null;
  canceledAt: string | null;
  failureReason: string | null;
  readyEmailSentAt: string | null;
  lines: OrderLineRecord[];
}

export interface PublicOrder {
  orderCode: string;
  status: OrderStatus;
  pickupAt: string;
  customerName: string;
  boxName: string;
  totalCents: number;
  currency: string;
  lines: OrderLineRecord[];
  createdAt: string;
  readyAt: string | null;
}

export interface StaffOrderView extends PublicOrder {
  id: string;
  customerEmail: string;
  boxCapacity: number;
  paidAt: string | null;
  pickedUpAt: string | null;
  readyEmailSentAt: string | null;
}

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "OUT_OF_STOCK"
  | "CAPACITY_EXCEEDED"
  | "SAUCE_LIMIT_EXCEEDED"
  | "SLOT_UNAVAILABLE"
  | "PRICE_CHANGED"
  | "PAYMENT_DECLINED"
  | "PAYMENT_RETRY"
  | "PAYMENT_UNCERTAIN"
  | "QUOTE_EXPIRED"
  | "MINIMUM_NOT_MET"
  | "ORDERS_PAUSED"
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export interface StoreSettings {
  acceptingOrders: boolean;
  prepLeadMinutes: number;
  slotMinutes: number;
  slotCapacity: number;
  openTime: string;
  closeTime: string;
  timezone: string;
}

export interface PublicConfig {
  demoMode: boolean;
  showcaseMode: boolean;
  checkoutEnabled: boolean;
  squareApplicationId: string | null;
  squareLocationId: string | null;
  squareEnvironment: "sandbox" | "production";
  currency: string;
  storeName: string;
  storeAddress: string;
  timezone: string;
  appUrl: string;
}
