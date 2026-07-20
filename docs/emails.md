# Arcade Earth Emails

This site uses Resend for transactional email from Firebase Functions.

Default sender: `hello@arcade.earth`

Verified Resend domain: `arcade.earth`

## Required Configuration

Firebase Functions needs these values before commerce email will send:

- `RESEND_API_KEY`: Firebase secret used by the Functions runtime.
- `RESEND_FROM`: optional. Defaults to `hello@arcade.earth`.
- `FULFILLMENT_NOTIFY_EMAIL`: where internal physical-order notices go.
- `ARCADE_EARTH_SUPPORT_EMAIL`: optional. Defaults to `hello@arcade.earth`.

The local Resend CLI is authenticated with the `default` profile through macOS Keychain. The CLI can confirm auth and domain status, but Resend API tokens are only shown at creation time and cannot be retrieved later.

Useful checks:

```sh
/Users/michaelschumaker/Documents/resend-cli-tool/bin/resend whoami --json
/Users/michaelschumaker/Documents/resend-cli-tool/bin/resend doctor --json
/Users/michaelschumaker/Documents/resend-cli-tool/bin/resend domains list --json
```

## Customer Emails

### Purchase Confirmation

Trigger: Stripe webhook confirms a paid Checkout Session.

This is one variable template. It changes based on the purchased SKU:

- `comic-digital`: confirms purchase and includes a secure Library link for reading/downloading.
- `comic-motion`: confirms purchase and includes a secure Library link for watching/downloading.
- `comic-physical`: confirms purchase and includes physical shipping expectations. No Library link is created.
- `comic-ultimate-bundle`: confirms purchase, includes the secure Library link, and includes physical shipping expectations.

The email never links directly to paid files. Digital access always routes through the Arcade Earth Library.

### Library Access Resend

Trigger: customer submits the Library access form.

If active purchases exist for that email, the system sends a fresh secure Library link. The API response stays generic either way, so the site does not reveal whether an email has purchases.

### Shipping / Tracking Notification

Trigger: a physical order document gets tracking information or is marked `shipped` / `fulfilled`.

The email includes the order ID, carrier, tracking number, and tracking URL when available.

### Refund / Revocation Notice

Trigger: Stripe sends a refund or dispute webhook event.

The email tells the customer the order status changed and that related Library access was updated.

## Internal Emails

### Physical Fulfillment Notification

Trigger: Stripe webhook confirms a paid `comic-physical` or `comic-ultimate-bundle` order.

Recipient: `FULFILLMENT_NOTIFY_EMAIL`

The email includes the Stripe session ID, customer email, purchased edition, total, and shipping address. It is for manual shipping operations, not for customers.

## Current Implementation Files

- Email provider and templates: `functions/index.js`
- Library access frontend form: `src/siteV2.js`
- Commerce/email product scope: `docs/site-v2-spec.md`

