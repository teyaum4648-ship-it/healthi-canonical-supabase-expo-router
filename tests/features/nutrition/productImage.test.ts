import { describe, expect, it, vi } from 'vitest';
import { productThumbnail, safeProductImageUrl } from '../../../src/features/nutrition/productLookup/productImage';
import { normalizeOpenFoodFactsProduct } from '../../../src/features/nutrition/productLookup/normalizeProduct';
import { searchOpenFoodFactsProducts } from '../../../src/features/nutrition/productLookup/openFoodFactsClient';
import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import { toUserFoodProductInsert, type UserFoodProductRow } from '../../../src/features/nutrition/productLibraryPersistence';
import { userFoodProductRowToSnapshot } from '../../../src/features/nutrition/mealBuilder';

const photo = 'https://images.openfoodfacts.org/images/products/408/860/006/0941/front_en.122.200.jpg';
const record = { code: '4088600060941', product_name: 'Plain yogurt', ingredients_text: 'Milk, cultures', categories_tags: ['en:yogurts'], image_front_small_url: photo, serving_size: '100 g', nutriments: { 'energy-kcal_100g': 60, proteins_100g: 8, carbohydrates_100g: 4, fat_100g: 1 } };
describe('product identification photos', () => {
  it('prefers a real small front image, falling back only to other supplied front images', () => {
    const large = photo.replace('.200.jpg', '.400.jpg');
    expect(productThumbnail({ image_front_small_url: photo, image_front_url: large })).toBe(photo);
    expect(productThumbnail({ image_front_url: large })).toBe(large);
    expect(productThumbnail({ image_url: photo, product_name: 'Yogurt' })).toBeNull();
  });
  it.each(['http://images.openfoodfacts.org/images/products/front.jpg', 'https://evil.example/front.jpg', 'https://images.openfoodfacts.org.evil.example/images/products/front.jpg', 'javascript:alert(1)', 'data:image/png;base64,abc', 'https://user:password@images.openfoodfacts.org/images/products/front.jpg', 'https://images.openfoodfacts.org/images/products/front.svg'])('rejects unsafe or unexpected photo URL %s', value => {
    expect(safeProductImageUrl(value)).toBeNull();
  });
  it('requests and normalizes photos for food-name search without extra per-result lookups', async () => {
    const fetcher = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ products: [record] }) }));
    const result = await searchOpenFoodFactsProducts('yogurt', { fetcher });
    expect(result).toMatchObject({ status: 'found', products: [{ image_url: photo }] });
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('fields')).toContain('image_front_small_url');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('keeps missing photos null and never derives an image from a name or barcode', () => {
    expect(normalizeOpenFoodFactsProduct('12345678', { product_name: 'Plain yogurt' })?.image_url).toBeNull();
    expect(productThumbnail({ code: '4088600060941', product_name: 'Plain yogurt' })).toBeNull();
  });
  it('does not change Product Quality when only a photo changes', () => {
    const snapshot = normalizeOpenFoodFactsProduct(record.code, record)!;
    expect(calculateProductQuality(snapshot)).toEqual(calculateProductQuality({ ...snapshot, image_url: null }));
  });
  it('retains the image in existing private saved-food metadata and tolerates older rows', () => {
    const snapshot = normalizeOpenFoodFactsProduct(record.code, record)!;
    const insert = toUserFoodProductInsert({ ...snapshot, quality: calculateProductQuality(snapshot) }, 'user-1');
    const row = { ...insert, id: 'food-1', created_at: '2026-09-10T00:00:00Z', updated_at: '2026-09-10T00:00:00Z' } as UserFoodProductRow;
    expect(userFoodProductRowToSnapshot(row).image_url).toBe(photo);
    expect(userFoodProductRowToSnapshot({ ...row, quality_snapshot: {} }).image_url).toBeNull();
  });
});
