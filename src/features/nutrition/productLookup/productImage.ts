/** Only use provider-supplied product photos, never construct one from a name. */
export function safeProductImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'images.openfoodfacts.org' || url.username || url.password || url.port || !url.pathname.startsWith('/images/products/') || !/\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}

export function productThumbnail(product: Record<string, unknown>): string | null {
  return safeProductImageUrl(product.image_front_small_url)
    ?? safeProductImageUrl(product.image_front_thumb_url)
    ?? safeProductImageUrl(product.image_front_url);
}
