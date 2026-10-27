import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCT_CONFIG, getPurchasableComic } from './comicProducts.js';
import { COMIC_PRODUCTS, LEGACY_COMIC_PRODUCTS } from '../src/comicProducts.js';

test('storefront offers map to purchasable bundles with PDF and both video actions', () => {
  assert.equal(COMIC_PRODUCTS.length, 2);
  for (const product of COMIC_PRODUCTS) {
    const config = getPurchasableComic(product.sku);
    assert.ok(config);
    assert.deepEqual(config.entitlements, ['comic-pdf-v1', 'comic-motion-stream-v1', 'comic-motion-download-v1']);
    assert.equal(Boolean(config.requiresShipping), Boolean(product.requiresShipping));
  }
  assert.equal(getPurchasableComic('comic-digital-bundle').fulfillmentType, 'digital');
  assert.equal(getPurchasableComic('comic-physical-bundle').fulfillmentType, 'bundle');
});

test('retired offers cannot start checkout but retain their original entitlements', () => {
  assert.equal(LEGACY_COMIC_PRODUCTS.length, 4);
  for (const product of LEGACY_COMIC_PRODUCTS) {
    assert.equal(getPurchasableComic(product.sku), null);
    assert.ok(PRODUCT_CONFIG[product.sku]);
  }
  assert.deepEqual(PRODUCT_CONFIG['comic-digital'].entitlements, ['comic-pdf-v1']);
  assert.deepEqual(PRODUCT_CONFIG['comic-motion'].entitlements, ['comic-motion-stream-v1', 'comic-motion-download-v1']);
  assert.deepEqual(PRODUCT_CONFIG['comic-physical'].entitlements, []);
  assert.deepEqual(PRODUCT_CONFIG['comic-ultimate-bundle'].entitlements, ['comic-pdf-v1', 'comic-motion-stream-v1', 'comic-motion-download-v1', 'comic-bonus-marker-v1']);
});

test('unknown and inherited property names cannot start checkout', () => {
  for (const sku of ['missing', '__proto__', 'constructor', 'toString', undefined, null]) {
    assert.equal(getPurchasableComic(sku), null);
  }
});
