export interface SquareMoney {
  amount?: number;
  currency?: string;
}

export interface SquareCustomAttributeValue {
  type?: string;
  number_value?: string;
  selection_uid_values?: string[];
  boolean_value?: boolean;
  string_value?: string;
}

export interface SquareCustomAttributeDefinition {
  type?: string;
  id: string;
  custom_attribute_definition_data?: {
    key?: string;
    name?: string;
    description?: string;
    type?: string;
    seller_visibility?: string;
    selection_config?: {
      max_allowed_selections?: number;
      allowed_selections?: Array<{ uid: string; name: string }>;
    };
  };
}

export interface SquareCatalogVariation {
  id: string;
  item_variation_data?: {
    name?: string;
    price_money?: SquareMoney;
    sold_out?: boolean;
    location_overrides?: Array<{ location_id?: string; sold_out?: boolean }>;
    present_at_all_locations?: boolean;
    absent_at_location_ids?: string[];
  };
}

export interface SquareCatalogObject {
  id: string;
  type: string;
  updated_at?: string;
  present_at_all_locations?: boolean;
  absent_at_location_ids?: string[];
  category_data?: { name?: string };
  item_data?: {
    name?: string;
    description?: string;
    category_id?: string;
    variations?: SquareCatalogVariation[];
    custom_attribute_values?: Record<string, SquareCustomAttributeValue>;
    image_ids?: string[];
  };
  custom_attribute_definition_data?: SquareCustomAttributeDefinition["custom_attribute_definition_data"];
}

export interface SquareCatalogListResponse {
  objects?: SquareCatalogObject[];
  cursor?: string;
  errors?: Array<{ code?: string; detail?: string; category?: string }>;
}

export interface SquareOrderLineItem {
  uid?: string;
  catalog_object_id?: string;
  quantity?: string;
  name?: string;
  base_price_money?: SquareMoney;
  note?: string;
}

export interface SquareFulfillment {
  uid?: string;
  type?: string;
  state?: string;
  pickup_details?: {
    recipient?: {
      display_name?: string;
      email_address?: string;
      phone_number?: string;
    };
    pickup_at?: string;
    note?: string;
  };
  metadata?: Record<string, string>;
}

export interface SquareOrder {
  id: string;
  location_id?: string;
  version?: number;
  state?: string;
  ticket_name?: string;
  total_money?: SquareMoney;
  line_items?: SquareOrderLineItem[];
  fulfillments?: SquareFulfillment[];
}

export interface SquarePayment {
  id: string;
  status?: string;
  order_id?: string;
  amount_money?: SquareMoney;
  receipt_url?: string;
}

export interface SquareWebhookEvent {
  event_id: string;
  type: string;
  created_at?: string;
  data?: {
    type?: string;
    id?: string;
    object?: Record<string, unknown>;
  };
}
