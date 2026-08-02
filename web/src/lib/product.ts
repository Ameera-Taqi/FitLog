export interface Product {
  id: string;
  name: string;
  category: string;
  flavor: string | null;
  price: number;
  currency: string;
  rating: number | null;
  badge: string | null;
  description: string | null;
  color: string;
  in_stock: boolean;
  position: number;
  image: string | null;
}

export function formatPrice(price: number, currency = "USD"): string {
  const symbol = currency === "USD" ? "$" : currency === "AED" ? "AED " : `${currency} `;
  return `${symbol}${price.toFixed(2)}`;
}

// Product images live in web/public/products/<slug>.png. Returns null when a
// product has no image so the UI can fall back to the gradient tile.
export function productImageSrc(image: string | null): string | null {
  return image ? `/products/${image}.png` : null;
}
