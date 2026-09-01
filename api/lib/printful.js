export async function createPrintfulOrder({ items, shipping, customer }) {
  const base = 'https://api.printful.com';
  const response = await fetch(`${base}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PRINTFUL_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipients: [
        {
          name: customer.name,
          email: customer.email,
          address1: shipping.address1,
          city: shipping.city,
          state_code: shipping.state,
          country_code: shipping.country,
          zip: shipping.postal_code
        }
      ],
      items: items.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
        files: [
          {
            type: 'default',
            url: item.fileUrl
          }
        ]
      }))
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Printful order failed: ${response.status} ${text}`);
  }
  return response.json();
}
