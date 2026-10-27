# Comic offers

Current offer as of October 27, 2026: Digital Comic Bundle ($14.99) and Physical Comic Bundle ($25 plus $6.99 shipping). Both include PDF, streaming motion comic, and video download. Physical also includes the printed book. Applicable tax is calculated in Checkout.

## Catalog and historical purchases

- `src/comicProducts.js`: `COMIC_PRODUCTS` drives the current storefront. `LEGACY_COMIC_PRODUCTS` preserves all four original cards, descriptions, prices, and artwork references for future reuse.
- `functions/comicProducts.js`: retains every historical SKU and its original entitlements. Only entries with `availableForPurchase: true` can start new checkout sessions.
- Never remove a historical mapping or change its entitlements to repurpose a SKU. Paid sessions and webhook retries still need those mappings.
- Existing artwork files are retained. The current cards reuse the digital and ultimate-bundle artwork.

## Stripe

Planetary Games live account: `acct_1T9TEiE6KbLJmYKb`.

| SKU | Product | Price |
| --- | --- | --- |
| comic-digital-bundle | prod_VWIvmuN4n6ob9S | price_1UVGJzE6KbLJmYKbAa14p0hT |
| comic-physical-bundle | prod_VWIvOrQ2tq2Bzr | price_1UVGK5E6KbLJmYKblQXSs3Yl |

Uses hosted Checkout sessions, not Payment Links. Physical shipping uses the existing configured shipping rate. New products retain the former Ultimate Bundle's Stripe tax code and use exclusive tax.

The four former products and their prices are archived in Stripe, not deleted. To restore an offer, reactivate the appropriate Stripe product and price, enable its server purchase flag, and select its saved storefront card. Deploy all affected commerce functions and hosting together. Do not rely on hiding a card to prevent new sales.

## Validation

Run `npm test --prefix functions` and `npm run build`. Catalog tests cover the two new bundles, shipping selection, retired offer rejection, unknown SKUs, and preserved legacy entitlements. Live checkout smoke checks create unpaid sessions only; expire those sessions after verification.
