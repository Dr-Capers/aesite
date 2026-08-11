# Launch Signup Security Architecture

## Current emergency posture

- Direct client writes to `launchSignups` are denied by Firestore rules.
- The public form fails closed (and displays a paused message) in builds that do not provide a reCAPTCHA Enterprise site key.
- The existing `launchSignups` dataset remains unchanged until its separate manual cleanup is completed.
- No Firestore document created by an anonymous browser may trigger email.

## Target flow

Use a server-controlled, score-gated, double-opt-in flow:

1. The browser executes a score-based reCAPTCHA Enterprise check on form submission without showing a checkbox.
2. The browser posts `email`, the reCAPTCHA token and public site key, a honeypot value, and minimal attribution data to `/api/submitLaunchSignup`.
3. `submitLaunchSignup` creates a server-side assessment and verifies the token, site key, hostname, `launch_signup` action, and minimum 0.5 score.
4. The function normalizes the email and enforces rate limits in a Firestore transaction:
   - at most 3 attempts per privacy-safe IP hash per hour;
   - at most 1 confirmation email per address per 24 hours;
   - at most 40 confirmation emails team-wide per UTC day, preserving at least 60% of the current Resend daily quota for purchases and Library access.
5. The function stores a pending record with a random confirmation-token hash and a 48-hour expiry.
6. Resend sends one confirmation email. The response remains generic so it cannot enumerate subscribers.
7. The recipient opens `/api/confirmLaunchSignup?token=...`.
8. The confirmation function atomically consumes the token and creates the confirmed `launchSignups` record.
9. Only confirmed records are mirrored to the subscriber Sheet. The confirmation page replaces a second welcome email, saving quota.
10. Firestore TTL removes expired pending records and old rate-limit buckets.

## Data model

### `pendingLaunchSignups/{emailHash}`

- `email`: normalized address, encrypted at rest by Firestore.
- `emailHash`: SHA-256 lookup key.
- `confirmationTokenHash`: SHA-256; never store the raw token.
- `requestedAt`, `expiresAt`, `lastConfirmationSentAt`.
- `ipHash`: HMAC-SHA-256 using `SIGNUP_IP_HASH_SECRET`; never store raw IP addresses.
- `sourceUrl`, `referrer`, `utm`: allowlisted and length-limited.

### `launchSignups/{emailHash}`

- `email`: normalized confirmed address.
- `confirmedAt`, `submittedAt`.
- allowlisted attribution fields.
- `consentVersion`: version of the signup disclosure accepted.
- `status`: `subscribed` or `unsubscribed`.

### `signupRateLimits/{bucket}`

- Hourly HMAC IP buckets, per-email cooldowns, and a global daily send-budget counter.
- All counters are updated transactionally by Admin SDK code.
- TTL removes expired buckets.

## Trust boundaries

- Firestore rules continue to deny all public reads and writes for signup collections.
- Admin SDK functions are the only writers.
- reCAPTCHA Enterprise assessment is server-side and fail-closed in production.
- Honeypot and implausibly fast/stale submissions receive a generic success response but do not write data or send email.
- `Origin` and `Referer` are defense-in-depth, not primary authentication.
- Forwarded IP headers are read only in the trusted Firebase/Cloud Run function environment.
- Email creation never occurs from a raw Firestore `onCreate` trigger.
- Confirmation tokens are single-use, expire after 48 hours, and are compared by hash.

## Required configuration

- `VITE_RECAPTCHA_SITE_KEY`: public reCAPTCHA Enterprise score key; dev and production use separate domain-restricted keys.
- `SIGNUP_IP_HASH_SECRET`: randomly generated Firebase Functions secret.
- Firestore TTL policies for pending signup and rate-limit `expiresAt` fields (declared in `firestore.indexes.json`).

## Deployment sequence

1. Create separate, domain-restricted reCAPTCHA Enterprise score keys for production and development.
2. Grant the Functions runtime service account `roles/recaptchaenterprise.agent`; set a random `SIGNUP_IP_HASH_SECRET` with `firebase functions:secrets:set`.
3. Deploy Functions and verify that the obsolete `launchWelcomeEmail` Firestore trigger is absent before enabling the form so confirmation does not send a second email.
4. Deploy Firestore rules/indexes and the dev Hosting rewrites while public Firestore writes remain denied.
5. Build dev Hosting with its `VITE_RECAPTCHA_SITE_KEY`, then exercise successful confirmation, expired token, replay, low-score rejection, per-IP throttling, per-email cooldown, and daily circuit-breaker tests.
6. Build with the production site key and deploy production Hosting.
7. Monitor Resend complaints/bounces and the global confirmation-send counter.

## Cleanup policy

Never bulk-delete subscribers using address patterns alone. Require a documented attack fingerprint, preview counts, and a fail-closed count assertion. Do not create plaintext backups of fraudulent addresses.
