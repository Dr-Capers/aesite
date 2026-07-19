# Arcade Earth Site V2 Spec

## Executive Summary

Arcade Earth Site V2 turns the current "launching soon" website into a real product hub for Planetary Games, starting with the launch of `Arcade Earth: Rise of Vector` as a comic commerce product line.

The build has two connected goals:

- Make the public site feel active, navigable, and premium instead of temporary or under construction.
- Create the commerce and Library foundation needed to sell digital comics, motion video comics, physical comics, bundles, and future Arcade Earth/Planetary Games products.

The first implementation pass should deliver a complete end-to-end customer flow: visitors can discover the comic from the homepage/nav, compare the four launch products, buy through Stripe Checkout, return to a success state, receive accountless Library access, and read/watch/download purchased digital media through short-lived signed access URLs. Physical purchases are US-only for v1 and use fixed Stripe shipping.

The product philosophy is intentionally not DRM-heavy. The system should protect paid files from public indexing, anonymous access, and permanent raw URLs, but it should optimize for legitimate customer trust and ease of access. The experience should feel like an Arcade Earth Library, not a one-off download link.

The locked visual direction comes from `style-lab.html`: minimalist black foundation, bold white Arcade Earth typography, restrained UI, and the Planetary Games blue zap video energy as background texture. The implementation agent should build functionality first, then refine page styling against that direction after the commerce, entitlement, and media access flows work.

## Purpose

Rework Arcade Earth from a "launching soon" splash into an active, navigable product hub while adding the comic commerce and Arcade Earth Library foundation.

Site V2 should:

- Keep the current mascot/splash identity, but change the tone from "site under construction" to "we are actively building the Arcade Earth universe."
- Add first-class navigation for Home, Comic, Games, Library, and Community.
- Promote the new comic product line with purchase, read, watch, and Library access flows.
- Give existing game products a real discovery surface instead of hiding them in the bottom-right `Other` dropdown.
- Establish commerce infrastructure that can later support comics, games, music, art books, wallpapers, beta access, and future Planetary Games products.

The comic-oriented product experience must support:

- Digital comic download, assumed PDF plus any bonus image/archive assets.
- Video version download, assumed MP4 or similar downloadable media.
- Physical comic purchase, shipped to the customer.

The site should feel like a first-class Arcade Earth/Planetary Games product experience, not just a payment link collection or a holding page. It needs clear navigation, enough product context to convert visitors, reliable purchase flows, and a library-based fulfillment design that reduces casual file leakage without pretending downloadable media can be made impossible to share.

## Product Decisions Addendum

### Product Philosophy

The goal of the comic store is not to maximize DRM or prevent piracy. The goal is to provide an effortless buying experience for legitimate fans while making casual redistribution inconvenient enough that most customers simply purchase the product.

Every decision should optimize for:

- Low friction.
- Premium presentation.
- Long-term customer trust.
- Scalability to future Arcade Earth and Planetary Games products.

This storefront is intended to become the commerce foundation for future Planetary Games products, not just Comic #1.

### Final Product Line

#### Digital Comic

Positioning: own the comic.

Customer receives:

- Downloadable PDF.
- Future updates if minor corrections are made.
- Ability to redownload from purchase email or Arcade Earth Library access.

This is the ownership product.

#### Motion Comic

Positioning: experience the story.

Customer receives:

- Browser streaming.
- Optional download.

Streaming is primary. Downloads exist because buyers expect ownership, not because downloading is encouraged.

Primary CTA language:

- `Watch instantly`

Secondary CTA language:

- `Download for offline viewing`

#### Physical Comic

Positioning: collect the world.

Customer receives:

- Physical comic.

This is the print-only standalone product. Shipping costs may apply.

#### Bundles

Launch products:

- Digital Comic.
- Motion Comic.
- Physical Comic.
- Ultimate Bundle, including physical, digital, motion, and future bonuses.

Avoid creating too many confusing purchase options.

### Digital Delivery Philosophy

Downloads are a convenience feature. They are not the core experience.

Preferred customer flow:

1. Purchase.
2. Immediate `Read Now` or `Watch Now`.
3. Optional download.

This should feel more like a premium owned media library than a file drop.

### Arcade Earth Library

The user-facing concept should be the Arcade Earth Library, not "download fulfillment."

Example page:

```text
Arcade Earth Library

Purchased:

Arcade Earth Vol. 1

Actions:

Read Online
Watch Motion Comic
Download PDF
Download Video
```

Future purchases should naturally appear here if accessed via the same email or magic link. No permanent customer accounts are required for version one.

Long-term customer expectation:

> Everything I have bought from Planetary Games lives in my Arcade Earth Library.

### Streaming Strategy

Motion comic should live behind purchase access.

Preferred flow:

1. Purchase.
2. Access page.
3. Watch immediately.
4. Optional download.

Users should never receive a raw MP4 URL in email.

### PDF Strategy

Customers should receive a downloadable PDF. Do not use aggressive DRM.

For launch:

- Do not watermark the PDF.
- Use private storage, Library access, short-lived signed URLs, and internal access logs.
- Preserve the beautiful reading experience.

Per-buyer watermarking can be added later if piracy becomes meaningful. If added, it should be subtle footer stamping with purchaser email and/or order ID, not intrusive DRM-style overlay text.

### Video Strategy

Video should not be individually watermarked for v1. The complexity outweighs the benefit.

Instead:

- Private storage.
- Signed URLs.
- Streaming player.
- Optional download.

Video watermarking can become a future enhancement if piracy becomes meaningful.

### Redownload Experience

Version one should support redownloads. Customers should not have to contact support because they bought a new laptop.

Preferred flow:

1. Purchase email.
2. `My Library`.
3. Magic link.
4. Access Library.
5. Download or stream.

### Asset Security Philosophy

Security goals:

- Prevent Google indexing.
- Prevent anonymous downloads.
- Prevent permanent URLs.
- Discourage casual sharing.

Do not attempt to prevent determined piracy. Assume every digital asset can eventually appear online. Focus engineering effort on improving legitimate customer experience.

### Download Limits

Use soft limits only.

Recommended:

- PDF and video are treated as lifetime ownership.
- Signed file URLs expire after 15 minutes.
- Download counters exist internally.
- No hard customer-facing limits in normal use.

If someone downloads many times because they own several devices, that should not become a support ticket. Only investigate obvious abuse.

### Fulfillment Emails

Customer email sequence:

1. Order confirmation immediately.
2. Access email within seconds.

The access email should feel premium and should always send customers back to Arcade Earth.

Example:

```text
Thanks for supporting Arcade Earth.

Your comic is ready.

Read Comic
Watch Motion Comic
Download PDF

Need access again later?

Visit My Library
```

Never email raw download links.

### Long-Term Vision

The commerce system should be generic enough that future products fit naturally:

- Comics.
- Motion comics.
- Art books.
- Soundtrack albums.
- Wallpapers.
- Game builds.
- Beta access.
- Digital collectibles.
- Future Arcade Earth titles.

## Handoff Checklist

Use this document as the starter spec for the next implementation/design pass.

Immediate inputs expected from Stripe/product setup:

- Digital comic Stripe Product ID and Price ID.
- Video comic Stripe Product ID and Price ID.
- Physical comic Stripe Product ID and Price ID, if physical sales are launched through this site.
- Bundle Price IDs, if bundles are launched as Stripe-native products/prices.
- Final prices, product names, and launch/sales state.

Highest-impact decisions still open:

- None currently blocking v1 implementation.

Locked V2 site decisions:

- Keep the mascot/splash homepage identity.
- Add a top navigation hub.
- Use top-level nav items: `Home`, `Comic`, `Games`, `Library`, `Community`.
- Replace the bottom-right `Other` dropdown as the primary discovery mechanism.
- Make `/comic` the homepage primary CTA.
- Make Thumb War download the homepage secondary CTA.
- Add `/games` as a real product hub for Thumb War and future game products.
- Keep `Library` visible in public navigation even before purchase.
- If a non-customer enters the Library flow, show a privacy-safe access state and a Comic CTA instead of a dead end.

## Current Site Context

This repo is a Vite static frontend deployed through Firebase Hosting. It already has Firebase client setup for the launch signup form and a Node Firebase Functions folder for signup side effects.

Important current constraints:

- `index.html` is a single-page launch experience with modal routes for other products.
- `src/main.js` initializes small UI controllers after DOM load.
- `functions/index.js` is Node ESM and already uses Firebase Functions v2, Firestore triggers, SendGrid, and Google Sheets.
- `firebase.json` currently declares the functions runtime as `python313`, while the actual deployed function source in this repo is JavaScript. This should be fixed before adding commerce functions.
- There is no visible customer account/auth flow on this site.

Relevant Stripe reference:

- `/Users/michaelschumaker/GameProjects/ALL_BUILDS/princetyping001/functions/src/index.ts` uses Firebase Functions v2, `stripe.checkout.sessions.create`, Stripe webhook signature verification with `req.rawBody`, webhook idempotency in Firestore, and Firestore payment entitlement writes.
- That reference assumes Firebase Auth and stores a single `users/{uid}/payments/stripe` entitlement. For this site, the likely better first version is accountless checkout using Stripe customer email plus Library access tokens.

## Product Model

### SKUs

Planned Stripe setup:

- The current Stripe account will have dedicated Stripe Products for the digital comic and the video comic.
- Each product should have its own Stripe Price ID exposed to Firebase Functions through server-side environment/secrets.
- The frontend should never submit Stripe Product IDs, Price IDs, or raw amounts directly. It should submit stable app SKUs, and the server should map those SKUs to configured Stripe Price IDs.

Recommended initial app SKUs:

| App SKU | Product | Stripe mode | Fulfillment | Notes |
| --- | --- | --- | --- | --- |
| `comic-digital` | Digital comic | `payment` | Library access plus optional PDF download | Dedicated Stripe Product/Price. PDF stored privately. |
| `comic-motion` | Motion comic | `payment` | Library access with streaming primary and optional download | Dedicated Stripe Product/Price. Prefer protected streaming on site, downloadable purchased file behind entitlement. |
| `comic-physical` | Physical comic | `payment` | Shipping collection plus fulfillment queue | Standalone physical print. Shipping costs may apply. |
| `comic-ultimate-bundle` | Ultimate bundle | `payment` | Physical, digital, motion, and future bonuses | Mega bundle option. |

Stripe Products and Prices from `/Users/michaelschumaker/Downloads/products.csv` and `/Users/michaelschumaker/Downloads/prices.csv`:

| App SKU | Stripe Product ID | Stripe Price ID | Amount | Tax Code |
| --- | --- | --- | --- | --- |
| `comic-digital` | `prod_Utiohi44L9R3OW` | `price_1TtvMUE6KbLJmYKbvXLGiUFD` | `$9.99 USD` | `txcd_10302000` |
| `comic-motion` | `prod_UtipfqhE0j4OHP` | `price_1TtvNzE6KbLJmYKbVET9MoGk` | `$14.99 USD` | `txcd_10804003` |
| `comic-physical` | `prod_UtivbVKP3daOLI` | `price_1TtvTME6KbLJmYKb7FEAaeoQ` | `$29.99 USD` | `txcd_35010000` |
| `comic-ultimate-bundle` | `prod_Utj3C28MrpeyoU` | `price_1TtvazE6KbLJmYKbZXABu2g0` | `$44.99 USD` | `txcd_10303001` |

Stripe product names:

- `comic-digital`: Arcade Earth: Rise of Vector Digital Download.
- `comic-motion`: Arcade Earth: Rise of Vector Video Comic.
- `comic-physical`: Arcade Earth: Rise of Vector Physical Comic.
- `comic-ultimate-bundle`: Arcade Earth: Rise of Vector Ultimate Bundle.

Locked Stripe/product decisions:

- Stripe Tax is enabled for Checkout.
- Product image URLs will be managed in Stripe later and are not required to implement the first pass.
- Motion comic includes both streaming and download access.
- Motion streaming should be the primary customer action; video download should be available but visually secondary and less prominent.
- Physical comic is treated as in-stock; no inventory scarcity or preorder behavior is needed for v1.
- Support email is `hello@arcade.earth`.
- Library should show all active purchases associated with the verified email, not only the purchase tied to the current magic link.
- Shipping is US-only for v1.
- Physical and Ultimate use fixed Stripe shipping: `Standard Shipping`, `$6.99 USD`, `5-10 business days`.
- Stripe Shipping Rate ID: `shr_1TtwPpE6KbLJmYKbqxRpYnQj`.
- Refund policy: all sales are final, with support available for access problems, damaged physical shipments, or fulfillment mistakes.
- Customer-facing shipping copy must state that Physical Edition and Ultimate Bundle shipping is available to United States addresses only for v1.

Locked public-facing product naming:

- Main title: `Arcade Earth: Rise of Vector`
- `comic-digital`: `Digital Edition`
- `comic-motion`: `Motion Video Comic`
- `comic-physical`: `Physical Edition`
- `comic-ultimate-bundle`: `Ultimate Bundle`

Expected server config variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_COMIC_DIGITAL_PRODUCT_ID`
- `STRIPE_COMIC_DIGITAL_PRICE_ID`
- `STRIPE_COMIC_MOTION_PRODUCT_ID`
- `STRIPE_COMIC_MOTION_PRICE_ID`
- `STRIPE_COMIC_PHYSICAL_PRODUCT_ID`
- `STRIPE_COMIC_PHYSICAL_PRICE_ID`
- `STRIPE_COMIC_ULTIMATE_PRODUCT_ID`
- `STRIPE_COMIC_ULTIMATE_PRICE_ID`
- `COMIC_SUCCESS_URL_BASE`
- `COMIC_CANCEL_URL_BASE`
- `ARCADE_EARTH_LIBRARY_URL_BASE`
- `COMIC_ASSET_BUCKET`
- `COMIC_PDF_OBJECT_PATH`
- `COMIC_MOTION_VIDEO_OBJECT_PATH`
- `COMIC_ALLOWED_SHIPPING_COUNTRIES`, value: `US`.
- `STRIPE_COMIC_SHIPPING_RATE_ID`, value: `shr_1TtwPpE6KbLJmYKbqxRpYnQj`.

Server-side SKU map:

- `comic-digital` -> `STRIPE_COMIC_DIGITAL_PRICE_ID`, entitlements: `comic-pdf-v1`.
- `comic-motion` -> `STRIPE_COMIC_MOTION_PRICE_ID`, entitlements: `comic-motion-stream-v1`, `comic-motion-download-v1`.
- `comic-physical` -> `STRIPE_COMIC_PHYSICAL_PRICE_ID`, entitlements: physical fulfillment only.
- `comic-ultimate-bundle` -> `STRIPE_COMIC_ULTIMATE_PRICE_ID`, entitlements: `comic-pdf-v1`, `comic-motion-stream-v1`, `comic-motion-download-v1`, physical fulfillment, and future bonus marker.

### Product Copy Inputs Needed

The spec currently needs these business inputs before implementation:

- Cover image and preview pages.
- Product descriptions for PDF, video, and physical edition.

Recommended refund/support copy:

> All Arcade Earth: Rise of Vector purchases are final. If you have trouble accessing your digital edition, motion video comic, or Library, or if your physical order arrives damaged or incorrect, contact us at hello@arcade.earth and we will help make it right.

Recommended shipping copy:

> Physical Edition and Ultimate Bundle shipping is available to United States addresses only. Standard Shipping is $6.99 and usually arrives in 5-10 business days after fulfillment.

## Locked Design Direction

The style guide is locked as the visual direction source for Site V2:

- Local reference page: `style-lab.html`
- Supporting CSS: `src/style-lab.css`
- Style lab assets: `public/assets/style-lab/`

The style lab is the vibe and visual-system contract, not a final component library. Implement real pages using this direction, then tune page-specific components against actual content, route states, and responsive behavior.

### Visual Principles

- Black minimalist base with generous negative space.
- Actual Planetary Games intro zap video as the background/motion language.
- White condensed/block typography for brand and major headings.
- Inter or similarly quiet sans-serif for body/UI text.
- Cyan/blue is an energy accent, not a dominant page wash.
- Product and Library UI should be restrained, sharp, and functional.
- Avoid the old neon-grid/nebula/under-construction look.
- Avoid decorative fake lightning shapes unless they match the PG intro zap quality.
- Do not recreate custom bolt animations from scratch for v1; use the video-backed motion language where motion is needed.
- Keep content layers above the video background with enough contrast for readability.

### Locked Style Decisions

- Top-left nav mark is text-only: `Arcade Earth`.
- The moving background should use `planetary-games-logo-video.mp4` from `public/assets/style-lab/`.
- The background video should sit behind all page content and remain fixed while content scrolls over it.
- No generated SVG bolt overlays in v1 unless a later pass can match the reference precisely.
- The style guide's product cards, Library shell, media shell, and nav are starting points for layout tone, but individual components can change during real page implementation.
- The real site should feel more like a premium product hub than a splash page or construction notice.

## Frontend Page Scope

Firebase Hosting already rewrites all routes to `index.html`, so the frontend can render these pages based on `window.location.pathname`, or the repo can grow to additional Vite HTML entries if cleaner. Version one should prefer a small route controller over a full framework migration unless the frontend scope grows substantially.

### Route Map

| Route | Audience | Purpose | V1 Priority |
| --- | --- | --- | --- |
| `/` | Public visitors | Site hub with mascot identity, product navigation, comic CTA, and Thumb War secondary CTA. | Required |
| `/comic` | Public buyers | Comic sales page and Stripe Checkout entry point. | Required |
| `/games` | Public visitors | Games hub for Thumb War and future Arcade Earth games. | Required |
| `/comic/success` | Recent buyers | Post-checkout confirmation and Library handoff. | Required |
| `/library` | Customers | Owned-product shelf for read/watch/download actions. | Required |
| `/library/access` | Customers | Request a magic link for Library access by email. | Required |
| `/library/session` | Customers from email | Verify magic-link token and establish Library session. | Recommended |
| `/read/:productSlug` | Customers | Simple browser reading experience for purchased comic using a signed PDF URL. | Required |
| `/watch/:productSlug` | Customers | Streaming experience for purchased motion comic. | Required if streaming launches day one |

The user-facing language should treat these pages as a premium Library system. Avoid raw "download portal" or "file access" framing.

### Site Navigation

Site V2 should replace the current bottom-right `Other` dropdown as the primary discovery mechanism.

Top-level navigation:

- `Home` -> `/`
- `Comic` -> `/comic`
- `Games` -> `/games`
- `Library` -> `/library`
- `Community` -> Discord/community destination or a community section if one exists in v1.

Navigation requirements:

- Add persistent top nav on desktop.
- Add compact mobile navigation if links do not fit comfortably.
- Keep the Planetary Games/Arcade Earth brand visible.
- Highlight the active route when possible.
- Keep footer links for Instagram, Discord/community, legal, support, and secondary links such as music.
- Remove, retire, or demote the `Other` popover once the top nav and Games hub exist.
- Existing `/thumb-war` should remain valid, but discovery should happen through `/games`, not a hidden dropdown.

Navigation design criteria:

- The site should feel active and explorable, not parked or under construction.
- Top nav should be visually integrated with the current arcade/sci-fi identity but quieter than the primary product CTAs.
- Mobile nav must be keyboard-operable and not overlap page CTAs or forms.

### `/` Home Page

Purpose:

- Preserve the current mascot/splash identity.
- Reframe the site from "launching soon" to "Arcade Earth is being built; explore what is active now."
- Route visitors to the most important product areas.

Required content:

- Existing Arcade Earth brand and mascot/splash visual.
- Updated copy that communicates active world-building instead of under-construction status.
- Primary CTA: `Explore the Comic` linking to `/comic`.
- Secondary CTA: `Download Thumb War` leading to the Thumb War area of `/games` or `/thumb-war`.
- Secondary product/navigation band with entries for Comic, Games, Library, and Community.
- Email signup remains available, but should no longer be the only meaningful page action.

Homepage copy direction:

- Avoid `Launching soon`, `stay tuned`, and similar parked-site phrasing as the main message.
- Prefer language around building, exploring, and expanding the Arcade Earth universe.
- Make it clear there are real places to go now: comic, games, Library, and community.

Homepage design criteria:

- Keep the mascot as a first-viewport identity signal.
- Add enough navigation and content structure that the page feels like a hub, not a placeholder.
- The comic CTA should be the strongest commercial action.
- Thumb War download should be a visible secondary action.
- Signup should be visually present but lower priority than product exploration.

### `/games` Games Hub

Purpose:

- Provide a first-class discovery page for Thumb War and future Arcade Earth game products.
- Move Thumb War out of hidden footer discovery.

Required content:

- Page title and concise intro for Arcade Earth games.
- Thumb War product card:
  - Short description.
  - App Store CTA.
  - Google Play CTA.
  - Link or anchor for more detail.
- No 1UP Quiz surface in v1.
- Future-ready empty/product slots only if they look intentional and not like broken placeholders.

Route compatibility:

- `/thumb-war` should route to the Thumb War section/card or a dedicated Thumb War detail view.
- Existing modal content can be reused, but v1 discovery should be route/page based.

Games design criteria:

- Product cards should be informative and action-oriented, not decorative-only tiles.
- Thumb War should make download actions obvious.
- The page should be generic enough for future games without needing another nav redesign.

### Global Frontend Criteria

- Use the locked style lab direction from `style-lab.html` as the visual source of truth.
- Maintain Arcade Earth's premium arcade/sci-fi identity while giving commerce pages clearer hierarchy than the current teaser homepage.
- Make the product itself the first-viewport signal: cover art, title, edition choice, and purchase action should be visible quickly.
- Use dense, scannable product information for commerce decisions; avoid turning the store into a marketing-only landing page.
- Keep checkout calls-to-action explicit: `Buy Digital Comic`, `Watch Instantly`, `Collect Physical Edition`, `Open Library`.
- Use the PG intro video background thoughtfully; reduce or mask it where it hurts readability.
- Never expose direct file URLs, Stripe Price IDs, or entitlement internals in visible UI.
- Every async action needs loading, success, empty, and error states.
- Every Library/action page should provide a path back to `/comic`, `/library`, and support.
- Mobile must be first-class. Product cards, Library actions, reader/player controls, and email forms must fit without clipped text or overlapping controls.
- Accessibility baseline: semantic headings, visible focus states, form labels, useful error copy, keyboard-operable controls, and no color-only status communication.

### `/comic` Product Page

Purpose:

- Sell the comic product line.
- Explain the emotional difference between digital, motion, physical, and bundle products.
- Start Stripe Checkout.

Required sections:

- Hero with cover art, comic title, release/sales state, and primary purchase CTA.
- Edition selector or pricing section with:
  - Digital Comic: `Own the comic.`
  - Motion Comic: `Experience the story.`
  - Physical Comic: `Collect the world.`
  - Ultimate Bundle, if launched.
- Preview gallery with 3-6 sample pages or panels.
- Motion comic trailer/preview area if available.
- Product details: format, page count, language, age rating if applicable, approximate file size, and update policy.
- Physical details: trim size, binding, estimated ship window, shipping regions, and clear note that standalone physical is print-only.
- Ultimate Bundle details: physical, digital PDF, motion comic, and future bonus access.
- FAQ focused on Library access, redownloads, refunds, shipping, support, and digital ownership.
- Legal/support links consistent with the existing site.

Purchase UI requirements:

- Buy buttons call `createComicCheckoutSession` with app SKU only.
- Disable buttons while a checkout session is being created.
- Show short, actionable errors if Checkout cannot be started.
- Redirect to Stripe-hosted Checkout on success.
- Respect not-yet-live states from server-provided product config.
- If the Ultimate Bundle includes digital and motion access, state that clearly near the CTA.

Design criteria:

- The cover/product art should carry the page visually, not decorative gradients alone.
- Product options should be easy to compare without feeling like a pricing spreadsheet.
- Physical should feel like the definitive edition, not just another SKU.
- Downloads should be secondary language; `Read Now`, `Watch Instantly`, and `Open Library` are the preferred experience cues.

### `/comic/success` Success Page

Purpose:

- Confirm that checkout completed or is being verified.
- Set expectations for Library access and email delivery.
- Avoid using the redirect alone as proof of payment.

Required states:

- `verifying`: session ID present, checking server state.
- `confirmed`: webhook/order exists and Library access can be offered.
- `pending`: checkout return happened before webhook processing; tell the user access email should arrive shortly.
- `cancelled`: user returned from cancelled checkout.
- `error`: session cannot be verified or server unavailable.

Required actions:

- `Open Library` if access token/session can be established.
- `Send Library Email` if direct access is not available.
- `Back to Comic`.
- Support link.

Design criteria:

- Keep this page calm and transactional.
- Do not expose Stripe session details unless needed for support copy.
- Do not trigger asset access from this page; route customers into the Library.

### `/library`

Purpose:

- Serve as the customer's owned-product shelf.
- Let customers read, watch, and download purchased products.
- Become the future home for all Planetary Games purchases.

Authentication/access model:

- No permanent account required for v1.
- Access is based on a verified magic-link token or temporary Library session.
- A verified Library session should show all active purchases associated with the normalized verified email.
- Refunded, revoked, disputed, or inactive entitlements should be hidden or marked unavailable.
- If no valid session exists, show the Library access request state rather than a dead error page.

Required states:

- Authenticated with purchases.
- Authenticated with no purchases.
- No valid session yet.
- Access request submitted with no purchase disclosed.
- Token expired.
- Invalid token.
- Loading.
- Server error.

Required content:

- Page title: `Arcade Earth Library`.
- Verified email or short "signed in by magic link" indicator.
- Purchased product list grouped by product family.
- For each comic product:
  - Product artwork.
  - Product title and edition.
  - Purchase date.
  - Included access: PDF, motion comic, physical shipment if applicable.
  - Actions: `Read Online`, `Watch Motion Comic`, `Download PDF`, `Download Video`.
- Physical order status when relevant: processing, shipped, tracking, delivered if available.
- Support/access resend links.

Design criteria:

- This should feel like a shelf or library, not an admin table.
- Empty/no-session states should guide users to `/library/access`.
- If an access request does not lead to visible purchases, show privacy-safe copy and a strong `/comic` CTA instead of saying whether the email exists.
- Action buttons should be clearly prioritized: read/watch first, downloads second.
- The route must be generic enough to later show comics, soundtracks, art books, wallpapers, game builds, beta access, and future Arcade Earth titles.

### `/library/access`

Purpose:

- Let customers request a Library magic link by email.
- Provide the redownload recovery path without requiring support.

Required UI:

- Email form.
- Submit loading state.
- Generic success state: `If purchases exist for that email, we will send Library access.`
- Error state for invalid email or network failure.
- Link back to `/comic`.

Security/privacy criteria:

- Do not reveal whether an email has purchases.
- Rate limit server endpoint.
- Use short, calm copy to avoid making the flow feel like account recovery.

### `/library/session`

Purpose:

- Receive Library magic links from email.
- Verify token server-side.
- Establish frontend Library session or redirect to `/library`.

Implementation options:

- Dedicated route: `/library/session?t=...`
- Simpler variant: `/library?t=...`

Dedicated route is preferred because it keeps token verification and Library rendering concerns separate.

Required states:

- Verifying token.
- Token accepted; redirecting/opening Library.
- Token expired; offer to request a new link.
- Token invalid; offer access request and support link.

Design criteria:

- Minimal UI.
- Never display the raw token.
- Remove token from browser-visible URL after successful verification if feasible.

### `/read/:productSlug`

Purpose:

- Provide an in-browser reading experience for purchased comics.
- Required for v1 as a simple native signed-PDF reader shell.

Required capabilities when implemented:

- Verify Library session/entitlement before loading content.
- Render comic pages or a protected PDF/PDF-like reader.
- Page navigation.
- Mobile-friendly portrait reading.
- Back to Library.
- Download PDF as secondary action.

Reader wiring:

- Do not build a full custom comic reader from scratch for v1.
- Recommended v1 path: use browser-native PDF rendering in an embedded viewer fed by a short-lived signed PDF URL.
- The page should request read access from `createAssetAccess` with an action like `{ action: "read", assetId: "comic-pdf-v1" }`.
- The server should verify the Library session and entitlement before returning read data.
- For a simple v1 PDF flow, the server can return a short-lived signed PDF URL and the frontend can embed it for reading.
- If browser-native PDF embedding is inconsistent on mobile, allow the signed PDF to open cleanly in the browser or platform viewer.
- Use a proven rendering library such as PDF.js only if native PDF behavior is unusable after implementation testing.
- If optional PDF download is included, the download action should call `createAssetAccess` separately with `{ action: "download" }`; do not reuse the reader URL as the download link.
- The reader should refresh asset access when signed URLs expire, as long as the Library session is still valid.

Required reader states:

- Loading entitlement.
- Loading comic.
- Ready.
- Page load error.
- Expired Library session.
- Entitlement missing.
- Signed URL expired and retrying.

Design criteria:

- Optimize for reading comfort over decoration.
- Avoid controls covering panels.
- Preserve image quality and page aspect ratio.
- On mobile, page controls must be reachable without hiding comic content.
- Verify the mobile experience before launch; some browsers may prefer opening the PDF externally, which is acceptable for v1 if the flow is clean.

### `/watch/:productSlug`

Purpose:

- Provide the primary motion comic experience.
- Required if motion comic streaming is part of launch.

Required capabilities:

- Verify Library session/entitlement before playback.
- Use a streaming player or signed media URL that is generated server-side.
- Standard controls: play/pause, seek, volume, fullscreen, captions if available.
- Back to Library.
- Download video as a secondary, less-prominent action.

Video player wiring:

- Do not build a custom video player from scratch for v1.
- Recommended v1 path: use the native HTML `<video>` element with the browser's built-in controls, fed by a short-lived signed MP4 URL from `createAssetAccess`.
- If the motion comic needs adaptive bitrate streaming, resume across devices, DRM-like controls, or better analytics than basic client events, use a managed streaming service rather than building that infrastructure in-house.
- If HLS is used without a managed player, use a proven browser playback library for cross-browser support rather than hand-rolling stream parsing.
- The page should request playback access from `createAssetAccess` with an action like `{ action: "stream", assetId: "comic-motion-1080p-v1" }`.
- The server should verify the Library session and entitlement before returning playback data.
- For a simple v1 MP4 flow, the server can return a short-lived signed URL and the frontend can wire it into a native HTML `<video>` element.
- For an HLS/adaptive streaming flow, the server should return a signed manifest/playback URL and the frontend should use a player that supports HLS across browsers.
- Safari can generally play HLS natively. Chrome/Firefox typically need a JavaScript HLS layer such as `hls.js` if HLS is chosen.
- The player should refresh playback access when a signed URL expires, as long as the Library session is still valid.
- The player must never render raw permanent storage URLs in email or static markup.
- The download action should call `createAssetAccess` separately with `{ action: "download" }`; do not reuse the streaming URL as the download link.
- The download action should be available from the Library/watch surface but visually de-emphasized compared with `Watch Motion Comic`.

Required player states:

- Loading entitlement.
- Loading video metadata.
- Ready.
- Playback error.
- Expired Library session.
- Entitlement missing.
- Signed URL expired and retrying.
- Captions unavailable, if no captions are shipped.

Player telemetry:

- Track watch page opened.
- Track playback started.
- Track 25/50/75/100 percent progress milestones.
- Track playback errors.
- Track download video clicked, if available.

Design criteria:

- Player should be the focus, with minimal surrounding UI.
- Avoid emailing or exposing a raw MP4 URL.
- Handle expired asset URLs by refreshing access through the server without forcing a new purchase.
- On mobile, controls must not overlap product navigation or Library actions.
- If captions are available, expose them through normal player controls rather than custom inaccessible UI.

## Checkout Architecture

### Recommended First Version

Use Stripe-hosted Checkout with Firebase Functions:

1. User selects an edition on `/comic`.
2. Frontend calls `POST /createComicCheckoutSession` with `{ sku, quantity }`.
3. Function validates SKU against a server-side product map.
4. Function creates a Stripe Checkout Session.
5. Stripe redirects the user to hosted Checkout.
6. Stripe redirects back to `/comic/success?session_id={CHECKOUT_SESSION_ID}`.
7. Webhook receives `checkout.session.completed`.
8. Function verifies the webhook signature, checks idempotency, and writes an order record plus entitlements.
9. Function sends the customer a receipt/access email that routes them back to their Arcade Earth Library.

This mirrors the proven shape of the Prince Typing Stripe integration while removing the Firebase Auth requirement.

### Why Accountless First

The current site has no account system, and requiring account creation just to buy a comic would add friction and scope. Stripe Checkout already collects email. Accountless Library access can support:

- Receipt emails.
- Secure read/watch/download actions.
- Later Library access via magic link.
- Admin/manual order lookup by Stripe session ID or email.

Add accounts only if we need a persistent customer library, subscriptions, community access, or cross-product entitlements.

### Firebase Function Endpoints

Proposed functions:

- `createComicCheckoutSession`
  - Method: `POST`
  - Input: `{ sku: string, quantity?: number }`
  - Validates SKU, quantity, availability, physical/digital requirements.
  - Creates Stripe Checkout Session.
  - For physical SKUs, enables shipping address collection and shipping rates.
  - Enables automatic tax if configured.
  - Returns `{ url }`.

- `stripeComicWebhook`
  - Method: `POST`
  - Verifies Stripe signature using raw body.
  - Stores processed Stripe event IDs for idempotency.
  - Handles at minimum `checkout.session.completed`.
  - Also handles `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`, `charge.dispute.created`, and related refund/dispute events if those payment methods are enabled.

- `createAssetAccess`
  - Method: `POST` or `GET`
  - Input: Library access token, entitlement ID, and asset action.
  - Verifies entitlement and token validity.
  - Returns a protected reader/player route, a short-lived signed URL, or redirects to the asset depending on action.

- `resendComicAccess`
  - Optional.
  - Input: customer email.
  - Sends a Library magic link if matching paid orders exist.
  - Response should be generic to avoid email enumeration.

### Stripe Checkout Session Fields

Digital/motion sessions:

- `mode: "payment"`
- `line_items: [{ price: serverMappedPriceId, quantity: 1 }]`
- `customer_creation: "always"` if we want Stripe Customer records for future redownloads.
- `customer_email` only if prefilled from a form; otherwise let Checkout collect it.
- `success_url: ${COMIC_SUCCESS_URL_BASE}/comic/success?session_id={CHECKOUT_SESSION_ID}`
- `cancel_url: ${COMIC_CANCEL_URL_BASE}/comic?checkout=cancelled`
- `automatic_tax: { enabled: true }`
- `metadata: { sku, productFamily: "comic", entitlementSet }`

Physical sessions:

- Same base fields as digital.
- Add `shipping_address_collection: { allowed_countries: ["US"] }`.
- Add `shipping_options: [{ shipping_rate: STRIPE_COMIC_SHIPPING_RATE_ID }]`.
- Consider `phone_number_collection` if the fulfillment vendor needs it.
- Add `automatic_tax: { enabled: true }`.
- No limited-inventory reservation system is needed for v1 because physical comic stock is assumed available.

## Data Model

Firestore collections:

### `comicOrders/{orderId}`

Recommended `orderId`: Stripe Checkout Session ID.

Fields:

- `stripeSessionId`
- `stripePaymentIntentId`
- `stripeCustomerId`
- `stripeEventId`
- `email`
- `status`: `paid | pending | fulfilled | refunded | disputed | cancelled`
- `items`: array of `{ sku, quantity, priceId, amountSubtotal, amountTotal, currency, fulfillmentType }`
- `amountTotal`
- `currency`
- `createdAt`
- `paidAt`
- `updatedAt`
- `shipping`: normalized address and chosen shipping rate for physical orders.
- `fulfillment`: status, carrier, tracking number, shippedAt, notes.

### `comicEntitlements/{entitlementId}`

Recommended `entitlementId`: stable generated ID, not email.

Fields:

- `orderId`
- `email`
- `sku`
- `assetIds`: e.g. `comic-pdf-v1`, `comic-video-1080p-v1`
- `status`: `active | revoked | refunded`
- `createdAt`
- `lastAccessedAt`
- `downloadCount`
- `maxDownloadCount`
- `expiresAt`, optional.

### `comicAccessTokens/{tokenHash}`

Store hashes, not raw tokens.

Fields:

- `entitlementId`
- `orderId`
- `email`
- `assetId`
- `createdAt`
- `expiresAt`
- `usedAt`, optional.
- `downloadCount`
- `maxDownloadCount`
- `revoked`

### `stripeWebhookEvents/{eventId}`

Same idea as the reference project:

- `type`
- `processedAt`
- `stripeSessionId`
- `orderId`
- `duplicateCount`, optional.

## Download Protection Consultation

### Baseline Reality

If customers can download a PDF or MP4, they can copy, screen-record, re-upload, or forward it. The practical goal is not perfect prevention. The goal is to:

- Prevent public unauthenticated access.
- Prevent casual link sharing.
- Make leaked copies traceable enough to discourage abuse.
- Keep the legitimate buyer experience smooth.

### Recommended Protection Level

Use private storage plus Library access and expiring signed links.

For PDF:

- Store the source PDF outside public hosting, preferably Firebase/Google Cloud Storage with no public read access.
- After purchase, provide an access page or email link containing an opaque token.
- The token calls a Function, which verifies entitlement.
- The Function returns a signed URL valid for a short window, such as 10-30 minutes.
- Do not watermark PDFs at launch. Keep the download path structured so subtle per-buyer footer stamping can be added later if needed.

For video:

- Do not host the MP4 in `public/` or `dist/`.
- If the video is meant to be watched more than downloaded, use a video platform with signed playback URLs, such as Mux, Vimeo OTT/private video, Cloudflare Stream, or similar.
- If the product promise is a downloadable video file, provide a private MP4 through the same signed URL mechanism.
- Add invisible or visible watermarking only if the workflow is practical. Per-buyer video watermarking is heavier than PDF watermarking and may require an encoding pipeline.

### Link and Token Policy

Suggested defaults:

- Library magic links expire in 7-30 days, then can be regenerated by email.
- Each generated signed file URL expires after 15 minutes.
- Download counters exist internally, but no hard customer-facing limits should be enforced in normal use.
- Provide a support/manual reset path for obvious edge cases.
- Store `downloadCount`, timestamps, IP/user-agent snapshots, and order ID.

### What Not To Do

- Do not place PDFs or MP4s in `/public`, `/assets`, or Firebase Hosting.
- Do not rely on obscured filenames.
- Do not send a permanent raw storage URL in email.
- Do not make the site depend on frontend-only checks for fulfillment.
- Do not promise DRM-level protection unless using a true DRM-capable streaming/download vendor.

## Physical Fulfillment

The physical comic path needs decisions separate from Stripe:

- Manual fulfillment from Firestore/admin dashboard.
- Spreadsheet export to a print/ship vendor.
- ShipStation/Pirate Ship/Shippo integration.
- Print-on-demand integration if the comic is manufactured per order.
- Physical stock is assumed available for v1; no customer-facing preorder, sold-out, or backorder state is required.

Minimum viable flow:

1. Stripe Checkout collects shipping address and payment.
2. Webhook writes a `comicOrders` document with shipping details.
3. Send internal fulfillment email or mirror order to Google Sheets.
4. Staff ships manually.
5. Staff updates tracking manually in Firestore/Stripe or via an admin script.
6. Customer receives shipment email.

For launch, manual fulfillment is acceptable if order volume is expected to be low. If volume may spike, use a shipping tool from day one.

If inventory constraints appear later, add `availableQuantity`, `reservedQuantity`, `soldQuantity`, and `salesState` to product config. Do not build that reservation system for v1.

## Email Requirements

Transactional emails:

- Purchase confirmation.
- Library access email with secure magic link.
- Physical order confirmation.
- Shipping/tracking notification.
- Refund/revocation notice, if applicable.

The repo already uses SendGrid in `functions/index.js`, so commerce emails can reuse SendGrid once sender/domain setup is confirmed.

Email links should point to the Arcade Earth Library, not directly to a file.

## Admin and Operations

At minimum, operators need:

- Ability to search an order by Stripe session ID, email, or order ID.
- Ability to resend Library access.
- Ability to revoke entitlements on refund/dispute.
- Ability to reset download count.
- Ability to mark physical orders fulfilled and store tracking.
- Error logging for webhook failures and email failures.

This can start as Firebase console plus small scripts, but a lightweight internal admin page will become worthwhile if physical sales grow.

## Existing Site Cleanup and Compatibility

Current site elements that need explicit handling:

- The `Other` footer dropdown should no longer be the primary way to discover products.
- `src/ui/footerOther.js` can be removed or reduced once top navigation and `/games` replace it.
- Existing Thumb War modal content should be reused in `/games` or a routeable Thumb War detail state.
- 1UP Quiz should be removed from visible v1 navigation and product surfaces.
- `/thumb-war` should continue to work for old links.
- `/1upquiz` can route to a not-found, coming-later, or archived state; it should not be promoted in v1.
- Existing legal modal/link behavior can remain if it still fits the footer, but legal links should not be hidden only inside a retired dropdown.
- Existing signup behavior should remain functional on the homepage and any retained modal/route forms.
- Page title and meta description should be updated away from `Launching Soon`.
- Add route-specific title/description handling for Home, Comic, Games, Library, Watch, and Read if the route controller supports it.
- Add a real not-found state for unknown routes instead of silently showing unrelated content.
- Keep `style-lab.html` available during design iteration, but do not make it a public production route unless intentionally linked as an internal reference.

## Legal and Policy Requirements

Needed before launch:

- Update Terms with digital product license, download limits, refund policy, and acceptable use.
- Update Privacy Policy for payment processor, fulfillment vendor, shipping data, and email processing.
- Clearly state whether digital purchases are refundable.
- Clearly state shipping regions, estimated delivery timing, taxes, and duties.
- Confirm Stripe Tax is enabled in Checkout sessions.

## Analytics

Track:

- Product page view.
- Edition selector changes.
- Checkout started by SKU.
- Checkout cancelled.
- Checkout success return page viewed.
- Webhook-confirmed purchases by SKU.
- Library asset access generated.
- Read, watch, or download action completed.

Do not treat the success redirect alone as fulfillment proof. Use the webhook as the source of truth.

## Prescriptive Agent Handoff

The build agent should execute Site V2 in this order. Do not start by polishing components; first make the route shell, data flow, and commerce contract work end to end.

### 1. Stabilize Project Foundation

- Fix `firebase.json` so Firebase Functions use the Node runtime that matches `functions/index.js`; remove or ignore the stale Python runtime path.
- Keep Vite as the frontend build system; do not migrate frameworks for v1.
- Add a small route controller for `/`, `/comic`, `/games`, `/comic/success`, `/library`, `/library/access`, `/library/session`, `/read/:productSlug`, and `/watch/:productSlug`.
- Keep `style-lab.html` as a local visual reference, not a public production route.
- Promote approved style-lab assets from `public/assets/style-lab/` into the production styling where appropriate.

### 2. Build Site V2 Shell

- Replace the `Other` dropdown as primary navigation with top nav: `Home`, `Comic`, `Games`, `Library`, `Community`.
- Rework the homepage into an active Arcade Earth hub using the locked style direction.
- Add `/games` focused on Thumb War only; remove 1UP Quiz from v1 visible surfaces.
- Preserve `/thumb-war` route compatibility by routing it into `/games` or a Thumb War detail state.
- Route `/1upquiz` to an archived, coming-later, or not-found state without promoting it.

### 3. Build Comic Commerce Frontend

- Build `/comic` with four product options only:
  - `Digital Edition`
  - `Motion Video Comic`
  - `Physical Edition`
  - `Ultimate Bundle`
- Use server app SKUs only: `comic-digital`, `comic-motion`, `comic-physical`, `comic-ultimate-bundle`.
- Show prices from the locked Stripe price table.
- Clearly state US-only physical shipping and final-sale/support policy.
- Treat `Watch Motion Comic` and `Read Online` as premium actions; de-emphasize raw downloads.

### 4. Implement Stripe Checkout

- Add Stripe server dependency to `functions`.
- Configure all Stripe/product/shipping/env variables listed in Product Model.
- Implement `createComicCheckoutSession`.
- Implement `stripeComicWebhook` with raw-body signature verification and idempotency.
- Use webhook-confirmed payment as the source of truth for orders and entitlements.
- Enable `automatic_tax: { enabled: true }` on Checkout Sessions.
- For physical/ultimate, use US-only shipping and `STRIPE_COMIC_SHIPPING_RATE_ID`.

### 5. Implement Library and Entitlements

- Store orders, entitlements, magic-link/access tokens, and processed webhook events in Firestore using the data model in this spec.
- Library magic link verifies the customer email.
- `/library` shows all active purchases associated with the normalized verified email.
- Hide or mark unavailable refunded, revoked, disputed, or inactive entitlements.
- `resendComicAccess` must not reveal whether an email has purchases.

### 6. Implement Media Access

- Store paid PDF and motion video assets outside public hosting.
- Implement `createAssetAccess` for `read`, `stream`, and `download` actions.
- `/read/:productSlug` is required as a simple native signed-PDF reader shell.
- `/watch/:productSlug` is required and should use native `<video>` with signed MP4 access for v1.
- PDF and video downloads are available through Library actions but should use separate signed URLs from read/stream actions.
- Do not watermark PDFs at launch.

### 7. Finish QA Before Polish

- Verify routes, navigation, mobile layout, keyboard access, and route-specific empty/error states.
- Verify each app SKU maps to the correct Stripe Price ID, entitlement set, and Checkout metadata.
- Verify webhook idempotency, success/cancel/pending checkout states, refunds/disputes, and Library access emails.
- Verify no paid assets are present in `public/`, `dist/`, or any Firebase Hosting output.
- Only after the above passes, tune spacing, component styling, and copy against the real pages.

## Implementation Plan

### Phase 1: Spec and Product Inputs

- Finalize remaining product assets and launch state.
- Decide whether to sell bundles.
- Decide video delivery mode: download-only, streaming-only, or both.
- Decide download policy: expiration window and internal download logging.

### Phase 2: Site Foundation

- Fix Firebase functions runtime in `firebase.json` to Node.
- Apply the locked style lab direction from `style-lab.html` and `src/style-lab.css` as the Site V2 visual baseline.
- Move or reuse approved style-lab assets from `public/assets/style-lab/` as needed for production page backgrounds and product surfaces.
- Add frontend route controller for `/`, `/comic`, `/games`, `/comic/success`, `/library`, `/library/access`, `/library/session`, `/read/:productSlug`, and `/watch/:productSlug`.
- Replace the bottom-right `Other` dropdown as primary navigation with a top nav: `Home`, `Comic`, `Games`, `Library`, `Community`.
- Reposition the homepage copy from parked/launching-soon language to active Arcade Earth world-building.
- Add homepage primary CTA to `/comic` and secondary CTA to Thumb War download/game area.
- Add `/games` hub for Thumb War and future game products.
- Preserve `/thumb-war` route compatibility by routing it into `/games` or a dedicated Thumb War detail state.
- Remove 1UP Quiz from visible v1 navigation/product scope.
- Add `/comic` product layout, edition selector, preview gallery, FAQ, purchase states, and not-yet-live states.
- Add `/comic/success` verification, pending, cancelled, and error states.
- Add `/library/access` magic-link request form.
- Add `/library/session` token verification handoff.
- Add `/library` shell with owned-product cards and read/watch/download actions.
- Add `/read/:productSlug` as a simple native signed-PDF reader shell.
- Add `/watch/:productSlug` for motion comic streaming.

### Phase 3: Stripe Checkout

- Add Stripe dependency to `functions/package.json`.
- Configure Firebase secrets:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_COMIC_DIGITAL_PRODUCT_ID`
  - `STRIPE_COMIC_DIGITAL_PRICE_ID`
  - `STRIPE_COMIC_MOTION_PRODUCT_ID`
  - `STRIPE_COMIC_MOTION_PRICE_ID`
  - `STRIPE_COMIC_PHYSICAL_PRODUCT_ID`
  - `STRIPE_COMIC_PHYSICAL_PRICE_ID`
  - `STRIPE_COMIC_ULTIMATE_PRODUCT_ID`
  - `STRIPE_COMIC_ULTIMATE_PRICE_ID`
  - `STRIPE_COMIC_SHIPPING_RATE_ID`
  - `COMIC_SUCCESS_URL_BASE`
  - `COMIC_CANCEL_URL_BASE`
  - `ARCADE_EARTH_LIBRARY_URL_BASE`
- Implement `createComicCheckoutSession`.
- Implement `stripeComicWebhook` with idempotency.
- Add order and entitlement writes.
- Configure Stripe webhook endpoint for deployed function URL.

### Phase 4: Digital Fulfillment

- Configure asset storage variables:
  - `COMIC_ASSET_BUCKET`
  - `COMIC_PDF_OBJECT_PATH`
  - `COMIC_MOTION_VIDEO_OBJECT_PATH`
- Move digital assets into private storage.
- Implement token generation.
- Implement `createAssetAccess`.
- Send Library access emails.
- Connect Arcade Earth Library actions to entitlement checks and signed asset URLs.
- Add download counting, access logs, and signed URL expiration.
- Add basic manual resend/reset script.

### Phase 5: Physical Fulfillment

- Configure Stripe shipping collection and shipping rates.
- Write shipping info to Firestore.
- Send internal fulfillment notification or Google Sheets row.
- Add manual tracking/status update workflow.
- Send shipping email.

### Phase 6: QA and Launch

- Test desktop and mobile top navigation, active states, keyboard access, and route changes.
- Test homepage primary Comic CTA, secondary Thumb War CTA, product/navigation band, and signup form.
- Test `/games` and `/thumb-war` discovery/route compatibility.
- Test `/1upquiz` is not promoted in v1 and resolves to the chosen archived/not-found/coming-later state.
- Test Stripe happy path, cancellation, failed payment, duplicate webhook, refund, and replayed webhook.
- Test every configured app SKU maps to the intended Stripe Price ID and entitlement set.
- Test physical shipping addresses and tax calculations.
- Test Library magic-link request, token verification, expired token, invalid token, no-session, and no-purchase CTA states.
- Test signed asset URL expiration and download count logging.
- Test mobile layout and accessibility across `/`, `/games`, `/comic`, `/comic/success`, `/library`, `/library/access`, and watch/read routes if included.
- Confirm that no paid assets are present in the built public output.
- Deploy to staging or preview channel before production.

## Initial Recommendation

Build version one as accountless Stripe Checkout with server-side SKU mapping, webhook-based order writes, private-storage digital assets, Arcade Earth Library access, and expiring signed asset URLs behind Library actions. Do not watermark PDFs at launch. For the motion comic, prioritize protected streaming plus an optional downloadable file.

This keeps launch scope manageable, avoids introducing account auth prematurely, and closes the biggest security hole: paid files accidentally becoming public static assets.
