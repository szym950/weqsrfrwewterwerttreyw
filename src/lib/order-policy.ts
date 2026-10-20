export const deliveryPrepaymentThresholdPLN = 150;

export function requiresDeliveryPrepayment(productTotalPLN: number): boolean {
  return productTotalPLN > deliveryPrepaymentThresholdPLN;
}
