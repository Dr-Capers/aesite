// Retain legacy mappings for existing orders, webhook retries, and Library access.
export const PRODUCT_CONFIG = {
  'comic-digital': {
    availableForPurchase: false,
    name: 'Digital Edition',
    productId: process.env.STRIPE_COMIC_DIGITAL_PRODUCT_ID || 'prod_Utiohi44L9R3OW',
    priceId: process.env.STRIPE_COMIC_DIGITAL_PRICE_ID || 'price_1TtvMUE6KbLJmYKbvXLGiUFD',
    entitlements: ['comic-pdf-v1'],
    fulfillmentType: 'digital',
  },
  'comic-motion': {
    availableForPurchase: false,
    name: 'Motion Video Comic',
    productId: process.env.STRIPE_COMIC_MOTION_PRODUCT_ID || 'prod_UtipfqhE0j4OHP',
    priceId: process.env.STRIPE_COMIC_MOTION_PRICE_ID || 'price_1TtvNzE6KbLJmYKbVET9MoGk',
    entitlements: ['comic-motion-stream-v1', 'comic-motion-download-v1'],
    fulfillmentType: 'digital',
  },
  'comic-physical': {
    availableForPurchase: false,
    name: 'Physical Edition',
    productId: process.env.STRIPE_COMIC_PHYSICAL_PRODUCT_ID || 'prod_UtivbVKP3daOLI',
    priceId: process.env.STRIPE_COMIC_PHYSICAL_PRICE_ID || 'price_1UVFS2E6KbLJmYKbb9dVhYFS',
    entitlements: [],
    fulfillmentType: 'physical',
    requiresShipping: true,
  },
  'comic-ultimate-bundle': {
    availableForPurchase: false,
    name: 'Ultimate Bundle',
    productId: process.env.STRIPE_COMIC_ULTIMATE_PRODUCT_ID || 'prod_Utj3C28MrpeyoU',
    priceId: process.env.STRIPE_COMIC_ULTIMATE_PRICE_ID || 'price_1UVFS2E6KbLJmYKbEg6vsqed',
    entitlements: ['comic-pdf-v1', 'comic-motion-stream-v1', 'comic-motion-download-v1', 'comic-bonus-marker-v1'],
    fulfillmentType: 'bundle',
    requiresShipping: true,
  },
  'comic-digital-bundle': {
    name: 'Digital Comic Bundle',
    availableForPurchase: true,
    productId: 'prod_VWIvmuN4n6ob9S',
    priceId: 'price_1UVGJzE6KbLJmYKbAa14p0hT',
    entitlements: ['comic-pdf-v1', 'comic-motion-stream-v1', 'comic-motion-download-v1'],
    fulfillmentType: 'digital',
  },
  'comic-physical-bundle': {
    name: 'Physical Comic Bundle',
    availableForPurchase: true,
    productId: 'prod_VWIvOrQ2tq2Bzr',
    priceId: 'price_1UVGK5E6KbLJmYKblQXSs3Yl',
    entitlements: ['comic-pdf-v1', 'comic-motion-stream-v1', 'comic-motion-download-v1'],
    fulfillmentType: 'bundle',
    requiresShipping: true,
  },
};

export function getPurchasableComic(sku) {
  return Object.hasOwn(PRODUCT_CONFIG, sku) && PRODUCT_CONFIG[sku].availableForPurchase === true
    ? PRODUCT_CONFIG[sku] : null;
}
