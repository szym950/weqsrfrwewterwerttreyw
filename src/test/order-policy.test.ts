import { describe, expect, it } from "vitest";
import { deliveryPrepaymentThresholdPLN, requiresDeliveryPrepayment } from "@/lib/order-policy";

describe("delivery prepayment policy", () => {
  it("allows cash on delivery at or below 150 PLN", () => {
    expect(requiresDeliveryPrepayment(deliveryPrepaymentThresholdPLN - 0.01)).toBe(false);
    expect(requiresDeliveryPrepayment(deliveryPrepaymentThresholdPLN)).toBe(false);
  });

  it("requires prepayment for delivery orders above 150 PLN", () => {
    expect(requiresDeliveryPrepayment(deliveryPrepaymentThresholdPLN + 0.01)).toBe(true);
  });
});
