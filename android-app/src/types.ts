export type Station = "kitchen" | "bar";
export type OrderStatus = "new" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";

export type OrderItemRow = {
  id: string;
  dish_name: string;
  category: string;
  station: Station;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type OrderRow = {
  id: string;
  order_number: number;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  fulfillment: "delivery" | "pickup";
  delivery_address: string | null;
  payment_method: "cash_delivery" | "onsite" | "payu";
  payment_status: "not_required" | "pending" | "paid" | "failed";
  status: OrderStatus;
  subtotal: number;
  delivery_cost: number;
  total: number;
  created_at: string;
  order_items: OrderItemRow[];
};
