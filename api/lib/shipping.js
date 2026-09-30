export const FREE_US_SHIPPING_AT_CENTS = 3900;
export const STANDARD_US_SHIPPING_CENTS = 699;

export function shippingOptionForSubtotal(subtotalCents) {
  if (subtotalCents >= FREE_US_SHIPPING_AT_CENTS) {
    return { amount: 0, displayName: 'Free US shipping' };
  }
  return { amount: STANDARD_US_SHIPPING_CENTS, displayName: 'Standard US shipping' };
}
